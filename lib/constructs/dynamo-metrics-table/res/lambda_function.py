
import boto3
from os import environ
from botocore.exceptions import ClientError
from hashlib import sha1
import base64
import json

DYNAMODB_TABLE_NAME = environ.get('DYNAMODB_TABLE_NAME')
DYNAMODB_PARTITION_KEY = environ.get('DYNAMODB_PARTITION_KEY')

dynamodb = boto3.client('dynamodb')

def lambda_handler(event, context):
    print("Processing Event For DynamoDB Metrics")
    print(event)

    sqs_records = event["Records"]
    for sqs_record in sqs_records:
        dynamodb_event = json.loads(sqs_record["body"])

        '''
        Event Shape

        {
            bucket: string
            key: string
            bucketArn: string
            featureName: string
            featureData: object
        }

        DynamoDB Entry Shape

        {
            id: number
            hash: string (sha1 of bucket+key)
            bucket: string
            key: string
            bucketArn: string
            featuresApplied: Array<string>
            featureData: Dict<string, object> (key is featureName)
        }
        '''

        # query whether an entry exists
        hash = dynamodb_event['hash']
        event_bucket = dynamodb_event['bucket']
        event_bucket_arn = dynamodb_event['bucketArn']
        event_key = dynamodb_event['key']
        bucket_key_string = event_bucket + event_key
        feature_name = dynamodb_event["featureName"]
        feature_data = dynamodb_event["featureData"]
        hash = base64.urlsafe_b64encode(sha1().update(bucket_key_string).digest()).decode('utf-8')
        table = dynamodb.Table(DYNAMODB_TABLE_NAME)

        print("Tables Found. Hashes Generated")

        try:
            response = table.get_item(Key={
                hash: hash
            })
            print("Retrieved Possible Entry")
            print(response)

            if "Item" in response:
                # Entry exists
                print("E ntry Exists. Updating")
                entry_data = dict()
                entry_data[ feature_name ] = feature_data

                table.update_item(
                    Key={
                        'hash': hash
                    },
                    UpdateExpression="SET featureData.{} = :fd, featuresApplied = list_append(:fa, featuresApplied)".format(feature_name),
                    ExpressionAttributeValues={
                        ':fd': entry_data,
                        ':fa': feature_name
                    },
                    ReturnValues="UPDATED_NEW"
                )

            else:
                # Entry does not exist
                print("Entry Does Not Exist. Inserting")
                entry_data = dict()
                entry_data[ feature_name ] = feature_data
                features_applied = [ feature_name ]
                table.put_item(
                    Item={
                        'hash': hash,
                        'bucket': event_bucket,
                        'key': event_key,
                        'bucketArn': event_bucket_arn,
                        'featuresApplied': features_applied,
                        'featureData': feature_data
                    }
                )

        except ClientError as ce:
            print(ce.response['Error']['Message'])
            print(ce)
            raise ce
    
