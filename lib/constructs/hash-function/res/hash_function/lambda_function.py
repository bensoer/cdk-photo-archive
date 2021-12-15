import json
import urllib.parse
import boto3
from hashlib import md5, sha1, sha256, sha512
import base64

s3 = boto3.client('s3')

def lambda_handler(event, context):

    # Get the object from the event and show its content type
    sqs_records = event['Records']
    for sqs_record in sqs_records:
        s3_event = json.loads(sqs_record["body"])
        print(s3_event)

        for s3_record in s3_event['Records']:

            bucket = s3_record['s3']['bucket']['name']
            key = urllib.parse.unquote_plus(s3_record['s3']['object']['key'], encoding='utf-8')
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
            response = s3.put_object_tagging(
                Bucket=bucket,
                Key=key,
                Tagging={
                    'TagSet': [
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
                    ]
                }
            )