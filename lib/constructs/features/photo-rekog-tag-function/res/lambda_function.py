import json
import boto3
from hashlib import md5, sha1, sha256, sha512
import base64
from os import environ

s3 = boto3.client('s3')
sqs = boto3.client('sqs')
rekog = boto3.client('rekognition')

# As of writing Rekognition only works for JPG/JPEG and PNG photos
PHOTO_FILE_TYPES = ["jpg", "jpeg", "png"]

FEATURE_NAME = environ.get("FEATURE_NAME")
REQUEST_QUEUE_URL = environ.get("REQUEST_QUEUE_URL")
REQUEST_QUEUE_ARN = environ.get("REQUEST_QUEUE_ARN")

REKOG_MIN_CONFIDENCE = float(environ.get('REKOG_MIN_CONFIDENCE', '75.0'))
REKOG_MAX_LABELS = int(environ.get('REKOG_MAX_LABELS', '10'))

def lambda_handler(event, context):

    print(event)

    bucket = event["bucketName"]
    key = event["key"]
    key_file_format = (key.split(".")[len(key.split("."))-1]).strip()

    if key_file_format.lower() not in PHOTO_FILE_TYPES:
        print("File {} Is Not A Valid Photo Image. Can Not Process".format(key))
        print("Invalid File: {} in Bucket: {}".format(key, bucket))
    else:
        print("Running Rekognition For File: {} in Bucket: {}".format(key, bucket))
        
        response = rekog.detect_labels(
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
        print(response)
        labels = [ x["Name"] for x in response["Labels"]]
        labels_string = ','.join(labels)

        get_object_tagging_response = s3.get_object_tagging(
            Bucket=bucket,
            Key=key,
        )
        tagset = list(filter(lambda tagset: tagset['Key'] not in ['ItemsInPhoto'], get_object_tagging_response['TagSet']))

        tagset.extend([
            {
                'Key': 'DetectedInPhoto',
                'Value': labels_string
            }
        ])

        response = s3.put_object_tagging(
            Bucket=bucket,
            Key=key,
            Tagging={
                'TagSet': tagset
            }
        )

    current_number_features_completed = event["numberOfFeaturesCompleted"] + 1
    if current_number_features_completed < len(event["features"]):
        # there are more features to complete.

        # mark ours as done
        for index, feature in enumerate(event["features"]):
            if feature["name"] == FEATURE_NAME:
                event["features"][index]["completed"] = True
                event["numberOfFeaturesCompleted"] = current_number_features_completed
                break

        # put into the requestQueue
        sqs.send_message(
            QueueUrl=REQUEST_QUEUE_URL,
            MessageBody=json.dumps(event)
        )
    
    print("Feature Processing Complete. Terminating")