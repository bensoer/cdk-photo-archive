import json
import boto3
from hashlib import md5, sha1, sha256, sha512
import base64
from os import environ

s3 = boto3.client('s3')
sqs = boto3.client('sqs')

FEATURE_NAME = environ.get("FEATURE_NAME")
REQUEST_QUEUE_URL = environ.get("REQUEST_QUEUE_URL")
REQUEST_QUEUE_ARN = environ.get("REQUEST_QUEUE_ARN")

def lambda_handler(event, context):

    # Get the object from the event and show its content type
    print(event)

    bucket = event["bucketName"]
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
    tagset = get_object_tagging_response['TagSet']

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
            sqs.send_message(
                QueueUrl=REQUEST_QUEUE_URL,
                MessageBody=json.dumps(event)
            )
        )
    
    print("Feature Processing Complete. Terminating")