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
    sqsQueueArn = props["sqsQueueArn"]
    lambdaArn = props["lambdaArn"]

    s3_client = boto3.client('s3')
    lambda_client = boto3.client('lambda')

    print("Linking Bucket Events To SQS")
    try:
        bucket_linking_response = s3_client.put_bucket_notification_configuration(
            Bucket=bucketName,
            NotificationConfiguration={
                "QueueConfigurations": [
                    {
                        'QueueArn': sqsQueueArn,
                        'Events': [
                            's3:ObjectCreated:*',
                        ]
                    }
                ]
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

    print("Linking SQS Events To Lambda")
    lambda_linking_response = lambda_client.create_event_source_mapping(
        EventSourceArn=sqsQueueArn,
        FunctionName=lambdaArn,
    )
    print("Linking SQS Events To Lambda Complete")
    print(lambda_linking_response)


    return { "Status": "SUCCESS" }

def on_update(event):
    physical_id = event["PhysicalResourceId"]
    props = event["ResourceProperties"]
    oldProps = event["OldResourceProperties"]
    print("update resource %s with props %s" % (physical_id, props))
    
    bucketArn = props["bucketArn"]
    bucketName = props["bucketName"]
    sqsQueueArn = props["sqsQueueArn"]
    lambdaArn = props["lambdaArn"]

    oldBucketArn = oldProps["bucketArn"]
    oldBucketName = oldProps["bucketName"]
    oldSqsQueueArn = oldProps["sqsQueueArn"]
    oldLambdaArn = oldProps["lambdaArn"]

    s3_client = boto3.client('s3')
    lambda_client = boto3.client('lambda')

    print("Updating Linking Bucket Events To SQS")
    try:
        bucket_linking_response = s3_client.put_bucket_notification_configuration(
            Bucket=bucketName,
            NotificationConfiguration={
                "QueueConfigurations": [
                    {
                        'QueueArn': sqsQueueArn,
                        'Events': [
                            's3:ObjectCreated:*',
                        ]
                    }
                ]
            }
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

    print("Deleting Old Linking SQS Events To Lambda")
    event_sources = lambda_client.list_event_source_mappings(
        EventSourceArn=oldSqsQueueArn,
        FunctionName=oldLambdaArn
    )
    for event_source in event_sources['EventSourceMappings']:
        lambda_client.delete_event_source_mapping(
            UUID=event_source["UUID"]
        )

    print("Linking SQS Events To Lambda")
    lambda_linking_response = lambda_client.create_event_source_mapping(
        EventSourceArn=sqsQueueArn,
        FunctionName=lambdaArn,
    )
    print("Linking SQS Events To Lambda Complete")
    print(lambda_linking_response)

    return { "Status": "SUCCESS" }

def on_delete(event):
    physical_id = event["PhysicalResourceId"]
    props = event["ResourceProperties"]
    print("delete resource %s" % physical_id)
    
    bucketArn = props["bucketArn"]
    bucketName = props["bucketName"]
    sqsQueueArn = props["sqsQueueArn"]
    lambdaArn = props["lambdaArn"]

    s3_client = boto3.client('s3')
    lambda_client = boto3.client('lambda')

    print("Unlinking Bucket Events To SQS")
    bucket_linking_response = s3_client.put_bucket_notification_configuration(
        Bucket=bucketName,
        NotificationConfiguration={
            "QueueConfigurations": []
        }
    )
    print("Unlinking Bucket Events To SQS Complete")
    print(bucket_linking_response)

    print("Deleting Old Linking SQS Events To Lambda")
    event_sources = lambda_client.list_event_source_mappings(
        EventSourceArn=sqsQueueArn,
        FunctionName=lambdaArn
    )
    for event_source in event_sources['EventSourceMappings']:
        lambda_client.delete_event_source_mapping(
            UUID=event_source["UUID"]
        )

    return { "Status": "SUCCESS"}