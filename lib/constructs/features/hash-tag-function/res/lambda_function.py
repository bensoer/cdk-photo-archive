import boto3
from hashlib import md5, sha1, sha256, sha512
import base64
from os import environ
from feature_processing import FeatureProcessing
from dynamo_helper import DynamoHelper, DynamoEvent
import common

s3 = boto3.client('s3')
sqs = boto3.client('sqs')
ssm = boto3.client('ssm')

FEATURE_NAME = environ.get("FEATURE_NAME")
SETTINGS_PREFIX = environ.get("SETTINGS_PREFIX")
DYNAMODB_METRICS_QUEUE_URL = environ.get("DYNAMODB_METRICS_QUEUE_URL", "Invalid")

def lambda_handler(event, context):

    if not common.is_feature_enabled(ssm, SETTINGS_PREFIX, FEATURE_NAME):
        print("{} Has Been Disabled. Skipping Execution".format(FEATURE_NAME))
        return event

    # Get the object from the event and show its content type
    print(event)

    bucket = event["bucketName"]
    bucketArn = event["bucketArn"]
    key = event["key"]
    print("Processing Tagging For File: {} in Bucket: {}".format(key, bucket))
    
    response = s3.get_object(Bucket=bucket, Key=key)
    content_stream = response['Body']
    
    # Init Buffer
    buffer_size_bytes = 1024 * 100 # 100 MB
    buffer = content_stream.read(buffer_size_bytes)
    
    # Init Hashes
    md5_hash = md5()
    sha1_hash = sha1()
    sha256_hash = sha256()
    sha512_hash = sha512()
    
    # Process Buffer and Generate Hashes
    while buffer:
        md5_hash.update(buffer)
        sha1_hash.update(buffer)
        sha256_hash.update(buffer)
        sha512_hash.update(buffer)
        
        buffer = content_stream.read(buffer_size_bytes)
        
    print("Hash Generation Complete. Putting Tagging")
    print("Now Fetching And Updating Tags")
    get_object_tagging_response = s3.get_object_tagging(
        Bucket=bucket,
        Key=key,
    )
    tagset = list(filter(lambda tagset: tagset['Key'] not in ['MD5', 'SHA1', 'SHA256', 'SHA512'], get_object_tagging_response['TagSet']))

    tagset.extend([
        {
            'Key': 'MD5',
            'Value': base64.urlsafe_b64encode(md5_hash.digest()).decode('utf-8')
        },
        {
            'Key': 'SHA1',
            'Value': base64.urlsafe_b64encode(sha1_hash.digest()).decode('utf-8')
        },
        {
            'Key': 'SHA256',
            'Value': base64.urlsafe_b64encode(sha256_hash.digest()).decode('utf-8')
        },
        {
            'Key': 'SHA512',
            'Value': base64.urlsafe_b64encode(sha512_hash.digest()).decode('utf-8')
        }
    ])

    response = s3.put_object_tagging(
        Bucket=bucket,
        Key=key,
        Tagging={
            'TagSet': tagset
        }
    )

    print("Tags Applied. Evaluating Event Features")

    fp = FeatureProcessing(event)
    updated_fp = fp.generate_updated_request_queue_object(FEATURE_NAME)

    de = DynamoEvent()
    de.bucket = bucket
    de.key = key
    de.bucketArn = bucketArn
    de.featureName = FEATURE_NAME
    de.featureData = { x["Key"]:x["Value"] for x in tagset }
    DynamoHelper(DYNAMODB_METRICS_QUEUE_URL, sqs).create_entry(de)
        
    print("Processing Complete. Terminating")

    return updated_fp.get_request_queue_object()