import json
import boto3
from os import environ
from feature_processing import FeatureProcessing
from dynamo_helper import DynamoHelper, DynamoEvent

s3 = boto3.client('s3')
sqs = boto3.client('sqs')
rekog = boto3.client('rekognition')

# As of writing Rekognition only works for JPG/JPEG and PNG photos
PHOTO_FILE_TYPES = ["jpg", "jpeg", "png"]

FEATURE_NAME = environ.get("FEATURE_NAME")
REQUEST_QUEUE_URL = environ.get("REQUEST_QUEUE_URL")
REQUEST_QUEUE_ARN = environ.get("REQUEST_QUEUE_ARN")
DYNAMODB_METRICS_QUEUE_URL = environ.get("DYNAMODB_METRICS_QUEUE_URL", "Invalid")

REKOG_MIN_CONFIDENCE = float(environ.get('REKOG_MIN_CONFIDENCE', '75.0'))
REKOG_MAX_LABELS = int(environ.get('REKOG_MAX_LABELS', '10'))

def lambda_handler(event, context):

    print(event)

    bucket = event["bucketName"]
    bucketArn = event["bucketArn"]
    key = event["key"]
    key_file_format = (key.split(".")[len(key.split("."))-1]).strip()

    if key_file_format.lower() not in PHOTO_FILE_TYPES:
        print("File {} Is Not A Valid Photo Image. Can Not Process".format(key))
        print("Invalid File: {} in Bucket: {}".format(key, bucket))
    else:
        print("Running Rekognition For File: {} in Bucket: {}".format(key, bucket))
        
        rekog_response = rekog.detect_labels(
            Image={
                "S3Object":{
                    "Bucket": bucket,
                    "Name": key
                }
            },
            MinConfidence=REKOG_MIN_CONFIDENCE,
            MaxLabels=REKOG_MAX_LABELS
        )

        print("Rekognition Complete. Applying Tagging")
        print(rekog_response)

        # Grab the labels
        labels = rekog_response["Labels"]
        # Sort them from highest confidence to lowest
        labels.sort(key=lambda x: x.get("Confidence"), reverse=True)
        # Grab all the names, but only as many as the REKOG_MAX_LABELS amount. This is the amount that will be tagged onto the S3 blob
        label_names = [ x["Name"] for x in labels[:REKOG_MAX_LABELS]]
        # Merge the tags into a single string
        labels_string = ','.join(label_names)

        # Grab the current tagging for the S3 object
        get_object_tagging_response = s3.get_object_tagging(
            Bucket=bucket,
            Key=key,
        )
        # Keep all tag values except for the DetectedInPhoto tag value
        tagset = list(filter(lambda tagset: tagset['Key'] not in ['DetectedInPhoto'], get_object_tagging_response['TagSet']))
        tagset.extend([
            {
                'Key': 'DetectedInPhoto',
                'Value': labels_string
            }
        ])
        # Update the tags
        response = s3.put_object_tagging(
            Bucket=bucket,
            Key=key,
            Tagging={
                'TagSet': tagset
            }
        )

    fp = FeatureProcessing(event)
    updated_fp = fp.generate_updated_request_queue_object(FEATURE_NAME)
    if updated_fp.has_more_processing():
        updated_fp.send_request_object_to_queue(REQUEST_QUEUE_URL, sqs)

    de = DynamoEvent()
    de.bucket = bucket
    de.key = key
    de.bucketArn = bucketArn
    de.featureName = FEATURE_NAME
    de.featureData = rekog_response["Labels"]
    DynamoHelper(DYNAMODB_METRICS_QUEUE_URL, sqs).create_entry(de)
    
    print("Feature Processing Complete. Terminating")