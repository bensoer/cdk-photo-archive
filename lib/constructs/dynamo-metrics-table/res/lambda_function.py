
import boto3
from os import environ
from botocore.exceptions import ClientError
from hashlib import sha1
import base64

DYNAMODB_TABLE_NAME = environ.get('DYNAMODB_TABLE_NAME')
DYNAMODB_PARTITION_KEY = environ.get('DYNAMODB_PARTITION_KEY')

dynamodb = boto3.client('dynamodb')

def lambda_handler(event, context):

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
    hash = event['hash']
    event_bucket = event['bucket']
    event_key = event['key']
    bucket_key_string = event_bucket + event_key
    hash = base64.urlsafe_b64encode(sha1().update(bucket_key_string).digest()).decode('utf-8')
    table = dynamodb.Table(DYNAMODB_TABLE_NAME)

    try:
        response = table.get_item(Key={
            hash: hash
        })

        if "Item" in response:
            # Entry exists
            bucket_key_string = event['bucket'] + event['key']
            feature_data = dict()
            feature_data[ event['featureName'] ] = event['featureData']
            features_applied = [ event['featureName'] ]

            table.update_item(
                Key={
                    'hash': hash
                },
                UpdateExpression="SET featureData.{} = :fd, featuresApplied = list_append(:fa, featuresApplied)".format(event["featureName"]),
                ExpressionAttributeValues={
                    ':fd': feature_data,
                    ':fa': event['featureName']
                },
                ReturnValues="UPDATED_NEW"
            )

        else:
            # Entry does not exist
            bucket_key_string = event['bucket'] + event['key']
            feature_data = dict()
            feature_data[ event['featureName'] ] = event['featureData']
            features_applied = [ event['featureName'] ]
            table.put_item(
                Item={
                    'hash': hash,
                    'bucket': event['bucket'],
                    'key': event['key'],
                    'bucketArn': event['bucketArn'],
                    'featuresApplied': features_applied,
                    'featureData': feature_data
                }
            )

        # Check if the record exists

    except ClientError as ce:
        print(ce.response['Error']['Message'])
        print(ce)

    
