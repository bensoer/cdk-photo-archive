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

    bucketArns = props["bucketArns"]
    bucketNames = props["bucketNames"]
    snsTopicArn = props["snsTopicArn"]

    s3_client = boto3.client('s3')

    for bucketName in bucketNames:
        print("Linking Bucket {} Events To SNS".format(bucketName))
        try:
            bnc_response = s3_client.get_bucket_notification_configuration(
                Bucket=bucketName
            )
            existing_topic_configuration = bnc_response.get('TopicConfigurations', [])
            existing_topic_configuration.append(
                {
                    'TopicArn': snsTopicArn,
                    'Events': [
                        's3:ObjectCreated:*',
                    ]
                }
            )

            bucket_linking_response = s3_client.put_bucket_notification_configuration(
                Bucket=bucketName,
                NotificationConfiguration={
                    'TopicConfigurations': existing_topic_configuration,
                    'QueueConfigurations': bnc_response.get('QueueConfigurations', []),
                    'LambdaFunctionConfigurations': bnc_response.get('LambdaFunctionConfigurations', []),
                    'EventBridgeConfiguration': bnc_response.get('EventBridgeConfiguration', {})
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
    
    bucketArns = props["bucketArns"]
    bucketNames = props["bucketNames"]
    snsTopicArn = props["snsTopicArn"]

    oldBucketArns = oldProps["bucketArns"]
    oldBucketNames = oldProps["bucketNames"]
    oldSnsTopicArn = oldProps["snsTopicArn"]

    s3_client = boto3.client('s3')

    for bucketName in bucketNames:
        print("Updating Linking Bucket {} Events To SNS".format(bucketName))
        try:
            bnc_response = s3_client.get_bucket_notification_configuration(
                Bucket=bucketName
            )
            existing_topic_configuration = bnc_response.get('TopicConfigurations', [])
            # copy all that are not ours to the new list
            new_topic_configuration = [ x for x in existing_topic_configuration if oldSnsTopicArn not in x['TopicArn']]
            # add new configuration to new configuration list
            new_topic_configuration.append(
                {
                    'TopicArn': snsTopicArn,
                    'Events': [
                        's3:ObjectCreated:*',
                    ]
                }
            )

            bucket_linking_response = s3_client.put_bucket_notification_configuration(
                Bucket=bucketName,
                NotificationConfiguration={
                    'TopicConfigurations': new_topic_configuration,
                    'QueueConfigurations': bnc_response.get('QueueConfigurations', []),
                    'LambdaFunctionConfigurations': bnc_response.get('LambdaFunctionConfigurations', []),
                    'EventBridgeConfiguration': bnc_response.get('EventBridgeConfiguration', {})
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
    
    bucketArns = props["bucketArns"]
    bucketNames = props["bucketNames"]
    snsTopicArn = props["snsTopicArn"]

    s3_client = boto3.client('s3')

    for bucketName in bucketNames:

        try:
            bnc_response = s3_client.get_bucket_notification_configuration(
                Bucket=bucketName
            )

            existing_topic_configuration = bnc_response.get('TopicConfigurations', [])
            # copy all that are not ours to the new list
            new_topic_configuration = [ x for x in existing_topic_configuration if snsTopicArn not in x['TopicArn']]

            bucket_linking_response = s3_client.put_bucket_notification_configuration(
                Bucket=bucketName,
                NotificationConfiguration={
                    'TopicConfigurations': new_topic_configuration,
                    'QueueConfigurations': bnc_response.get('QueueConfigurations', []),
                    'LambdaFunctionConfigurations': bnc_response.get('LambdaFunctionConfigurations', []),
                    'EventBridgeConfiguration': bnc_response.get('EventBridgeConfiguration', {})
                }
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