import boto3

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
    snsQueueArn = props["snsQueueArn"]
    lambdaArn = props["lambdaArn"]

    s3_client = boto3.client('s3')
    lambda_client = boto3.client('lambda')

    print("Linking Bucket Events To SNS")
    bucket_linking_response = s3_client.put_bucket_notification_configuration(
        Bucket=bucketName,
        NotificationConfiguration={
            "TopicConfigurations": [],
            "QueueConfigurations": [
                {
                    'QueueArn': snsQueueArn,
                    'Events': [
                        's3:ObjectCreated:*',
                    ]
                }
            ],
            "LambdaFunctionConfigurations":[]
        }
    )
    print("Linking Bucket Events To SNS Complete")
    print(bucket_linking_response)

    print("Linking SNS Events To Lambda")
    lambda_linking_response = lambda_client.create_event_source_mapping(
        EventSourceArn=snsQueueArn,
        FunctionName=lambdaArn,
    )
    print("Linking SNS Events To Lambda Complete")
    print(lambda_linking_response)


    return { "Status": "SUCCESS" }

def on_update(event):
    physical_id = event["PhysicalResourceId"]
    props = event["ResourceProperties"]
    oldProps = event["OldResourceProperties"]
    print("update resource %s with props %s" % (physical_id, props))
    
    bucketArn = props["bucketArn"]
    bucketName = props["bucketName"]
    snsQueueArn = props["snsQueueArn"]
    lambdaArn = props["lambdaArn"]

    oldBucketArn = oldProps["bucketArn"]
    oldBucketName = oldProps["bucketName"]
    oldSnsQueueArn = oldProps["snsQueueArn"]
    oldLambdaArn = oldProps["lambdaArn"]

    s3_client = boto3.client('s3')
    lambda_client = boto3.client('lambda')

    print("Updating Linking Bucket Events To SNS")
    bucket_linking_response = s3_client.put_bucket_notification_configuration(
        Bucket=bucketName,
        NotificationConfiguration={
            "TopicConfigurations": [],
            "QueueConfigurations": [
                {
                    'Id': 'bucket-events-to-queue-configuration',
                    'QueueArn': snsQueueArn,
                    'Events': [
                        's3:ReducedRedundancyLostObject',
                        's3:ObjectCreated:*',
                        's3:ObjectRemoved:*',
                        's3:ObjectRestore:*',
                        's3:Replication:*',
                        's3:ObjectRestore:Delete',
                        's3:LifecycleTransition',
                        's3:IntelligentTiering',
                        's3:ObjectAcl:Put',
                        's3:LifecycleExpiration:*',
                    ]
                }
            ],
            "LambdaFunctionConfigurations":[]
        }
    )
    print("Updating Linking Bucket Events To SNS Complete")
    print(bucket_linking_response)

    print("Deleting Old Linking SNS Events To Lambda")
    event_sources = lambda_client.list_event_source_mapping(
        EventSourceArn=oldSnsQueueArn,
        FunctionName=oldLambdaArn
    )
    for event_source in event_sources['EventSourceMappings']:
        lambda_client.delete_event_source_mapping(
            UUID=event_source["UUID"]
        )

    print("Linking SNS Events To Lambda")
    lambda_linking_response = lambda_client.create_event_source_mapping(
        EventSourceArn=snsQueueArn,
        FunctionName=lambdaArn,
    )
    print("Linking SNS Events To Lambda Complete")
    print(lambda_linking_response)

    return { "Status": "SUCCESS" }

def on_delete(event):
    physical_id = event["PhysicalResourceId"]
    props = event["ResourceProperties"]
    print("delete resource %s" % physical_id)
    
    bucketArn = props["bucketArn"]
    bucketName = props["bucketName"]
    snsQueueArn = props["snsQueueArn"]
    lambdaArn = props["lambdaArn"]

    s3_client = boto3.client('s3')
    lambda_client = boto3.client('lambda')

    print("Unlinking Bucket Events To SNS")
    bucket_linking_response = s3_client.put_bucket_notification_configuration(
        Bucket=bucketName,
        NotificationConfiguration={
            "TopicConfigurations": [],
            "QueueConfigurations": [],
            "LambdaFunctionConfigurations":[]
        }
    )
    print("Unlinking Bucket Events To SNS Complete")
    print(bucket_linking_response)

    print("Deleting Old Linking SNS Events To Lambda")
    event_sources = lambda_client.list_event_source_mapping(
        EventSourceArn=snsQueueArn,
        FunctionName=lambdaArn
    )
    for event_source in event_sources['EventSourceMappings']:
        lambda_client.delete_event_source_mapping(
            UUID=event_source["UUID"]
        )

    return { "Status": "SUCCESS"}