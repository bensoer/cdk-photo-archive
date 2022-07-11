
import boto3
import json
import urllib.parse
from os import environ

ssm = boto3.client("ssm")
sqs = boto3.client("sqs")

REQUEST_QUEUE_ARN = environ.get('REQUEST_QUEUE_ARN')
REQUEST_QUEUE_URL = environ.get('REQUEST_QUEUE_URL')
SSM_PREFIX = environ.get('SSM_PREFIX', 'pa')

def valid_event(s3_event) -> bool:
    if "Records" not in s3_event:
        if "Event" in s3_event and s3_event['Event'] == 's3:TestEvent':
            print("TestEvent Entry Received. Doing Nothing With It")
            print(s3_event)
            return False
        print("Records not found within s3_event. Cant Parse")
        print(s3_event)
        return False

    return True

def get_feature_lambda_arn_if_enabled(feature_ssm_name:str):
    feature_enabled_reponse = ssm.get_parameter(
        Name="/{}/features/{}/enabled".format(SSM_PREFIX, feature_ssm_name)
    )
    if feature_enabled_reponse["Parameter"]["Value"] == "TRUE":
        feature_lambda_arn_response = ssm.get_parameter(
            Name="/{}/features/{}/lambda/arn".format(SSM_PREFIX, feature_ssm_name)
        )
        return feature_lambda_arn_response["Parameter"]["Value"]

    return None

def generate_available_features() -> list:
    '''
    SSM Parameter Store Feature Data:

    /pa/features - StringList of features

    /pa/features/hashtaglambda/enabled - TRUE|FALSE
    /pa/features/hashtaglambda/lambda/arn - STRING

    /pa/features/photometataglambda/enabled - TRUE|FALSE
    /pa/features/photometataglambda/lambda/arn - STRING

    /pa/features/rekogntaglambda/enabled - TRUE|FALSE
    /pa/features/rekogntaglambda/lambda/arn - STRING
    '''

    available_features = []

    features_list_response = ssm.get_parameter(
        Name="/{}/features".format(SSM_PREFIX)
    )
    features_list = features_list_response["Parameter"]["Value"].split(",")

    for feature in features_list:
        feature_lambda_arn = get_feature_lambda_arn_if_enabled(feature)

        available_features.append({
            "name": feature,
            "completed": False,
            "available": True if feature_lambda_arn is not None else False,
            "lambdaArn": feature_lambda_arn
        })

    return available_features


def lambda_handler(event, context):

    # parse information from EventQueue
    message = event['Message']
    parsed_message = json.loads(message)
    sqs_records = parsed_message['Records']
    print("Processing SQS Records")
    for sqs_record in sqs_records:
        s3_event = json.loads(sqs_record["body"])

        # validate the event
        print("Validating Event")
        if not valid_event(s3_event):
            print("Event Is Not Valid. Cant Process")
            print(event)
            return

        print("Processing Records")
        for s3_record in s3_event['Records']:

            bucket_name = s3_record['s3']['bucket']['name']
            bucket_arn = s3_record['s3']['bucket']['arn']
            key = urllib.parse.unquote_plus(s3_record['s3']['object']['key'], encoding='utf-8')
            

            # then build out the payload
            payload = {
                "bucketName": bucket_name,
                "bucketArn": bucket_arn,
                "key": key,
                "features": generate_available_features(),
                "numberOfFeaturesCompleted": 0
            }

            payload_string = json.dumps(payload)
            sqs.send_message(
                QueueUrl=REQUEST_QUEUE_URL,
                MessageBody=payload_string
            )
        
    print("Processing Complete. Terminating")

