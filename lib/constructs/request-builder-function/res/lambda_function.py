
import boto3
import json
import urllib.parse
from os import environ

ssm = boto3.client("ssm")
sqs = boto3.client("sqs")
sf = boto3.client('stepfunctions')

STATE_MACHINE_ARN = environ.get('STATE_MACHINE_ARN')
SETTINGS_PREFIX = environ.get('SETTINGS_PREFIX', 'pt')

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
        Name="/{}/features/{}/enabled".format(SETTINGS_PREFIX, feature_ssm_name)
    )
    if feature_enabled_reponse["Parameter"]["Value"] == "TRUE":
        feature_lambda_arn_response = ssm.get_parameter(
            Name="/{}/features/{}/lambda/arn".format(SETTINGS_PREFIX, feature_ssm_name)
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
        Name="/{}/features".format(SETTINGS_PREFIX)
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

    sqs_event_records = event['Records']
    for sqs_event_record in sqs_event_records:
        sns_event = json.loads(sqs_event_record['body'])

        s3_event = json.loads(sns_event['Message'])

        # validate the event
        print("Validating Event")
        if not valid_event(s3_event):
            print("Event Is Not Valid. Cant Process")
            print(event)
            return
        
        print("Processing Event Records")
        for s3_event_record in s3_event['Records']:

            event_source = s3_event_record['eventSource']
            event_region = s3_event_record['awsRegion']
            event_time = s3_event_record['eventTime']
            event_name = s3_event_record['eventName']

            bucket_name = s3_event_record['s3']['bucket']['name']
            bucket_arn = s3_event_record['s3']['bucket']['arn']
            key = urllib.parse.unquote_plus(s3_event_record['s3']['object']['key'], encoding='utf-8')

            print("{} - {}@{} in {} - {}/{}".format(event_source, event_name, event_time, event_region, bucket_name, key))
            
            # then build out the payload
            payload = {
                "meta": {
                    "s3Event": s3_event_record,
                    "snsEvent": {k:v for k,v in sns_event.items() if k != 'Message'}, # Grab everything but the s3Event data
                    "sqsEvent": {k:v for k,v in sqs_event_record.items() if k != 'body'}, # Grab everything but the snsEvent data
                    "lambdaEvent": {k:v for k,v in event.items() if k != 'Records'} # Grab everything but the sqsEvent data
                },
                "bucketName": bucket_name,
                "bucketArn": bucket_arn,
                "key": key,
                "features": generate_available_features(),
                "numberOfFeaturesCompleted": 0
            }

            response = sf.start_execution(
                stateMachineArn=STATE_MACHINE_ARN,
                input=json.dumps(payload)
            )
            print("State Machine {} Started. Execution ARN: {}".format(STATE_MACHINE_ARN, response['executionArn']))


    print("Processing Complete. Terminating")

