import boto3
import botocore

def on_event(event, context):
    print(event)
    request_type = event['RequestType']
    if request_type == 'Create': return on_create(event)
    if request_type == 'Update': return on_update(event)
    if request_type == 'Delete': return on_delete(event)
    raise Exception("Invalid request type: %s" % request_type)

def on_create(event):
    props = event["ResourceProperties"]
    print("create new resource with props %s" % props)

    bucketArn = props["bucketArn"]
    bucketName = props["bucketName"]
    snsTopicArn = props["snsTopicArn"]

    s3_client = boto3.client('s3')

    print("Linking Bucket Events To SNS")
    try:
        bucket_linking_response = s3_client.put_bucket_notification_configuration(
            Bucket=bucketName,
            NotificationConfiguration={
                'TopicConfigurations': [
                    {
                        'TopicArn': snsTopicArn,
                        'Events': [
                            's3:ObjectCreated:*',
                        ]
                    },
                ],
            }
        )
        print("Linking Bucket Events To SQS Complete")
        print(bucket_linking_response)
    except botocore.exceptions.ClientError as error:
        print(error)
        print(error.response)
        raise error
    except Exception as e:
        print(e)
        raise e

    return { "Status": "SUCCESS" }

def on_update(event):
    physical_id = event["PhysicalResourceId"]
    props = event["ResourceProperties"]
    oldProps = event["OldResourceProperties"]
    print("update resource %s with props %s" % (physical_id, props))
    
    bucketArn = props["bucketArn"]
    bucketName = props["bucketName"]
    snsTopicArn = props["snsTopicArn"]

    oldBucketArn = oldProps["bucketArn"]
    oldBucketName = oldProps["bucketName"]
    oldSnsTopicArn = oldProps["snsTopicArn"]

    s3_client = boto3.client('s3')

    print("Updating Linking Bucket Events To SNS")
    try:
        bucket_linking_response = s3_client.put_bucket_notification_configuration(
            Bucket=bucketName,
            NotificationConfiguration={
                'TopicConfigurations': [
                    {
                        'TopicArn': snsTopicArn,
                        'Events': [
                            's3:ObjectCreated:*',
                        ]
                    },
                ]
            },
            
        )
        print("Updating Linking Bucket Events To SQS Complete")
        print(bucket_linking_response)
    except botocore.exceptions.ClientError as error:
        print(error)
        print(error.response)
        raise error
    except Exception as e:
        print(e)
        raise e

    return { "Status": "SUCCESS" }

def on_delete(event):
    physical_id = event["PhysicalResourceId"]
    props = event["ResourceProperties"]
    print("delete resource %s" % physical_id)
    
    bucketArn = props["bucketArn"]
    bucketName = props["bucketName"]
    snsTopicArn = props["snsTopicArn"]

    s3_client = boto3.client('s3')

    try:
        bucket_linking_response = s3_client.put_bucket_notification_configuration(
            Bucket=bucketName,
            NotificationConfiguration={}
        )
        print("Updating Linking Bucket Events To SNS Complete")
        print(bucket_linking_response)
    except botocore.exceptions.ClientError as error:
        print(error)
        print(error.response)
        raise error
    except Exception as e:
        print(e)
        raise e

    return { "Status": "SUCCESS"}