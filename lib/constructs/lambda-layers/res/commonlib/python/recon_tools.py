


def bucket_has_event_configuration(client, bucketName) -> bool:
    response = client.get_bucket_notification_configuration(
        Bucket=bucketName
    )
    return len(response['TopicConfigurations']) > 0 or len(response['QueueConfigurations']) > 0 or len(response['LambdaFunctionConfigurations']) > 0 or len(response['EventBridgeConfiguration']) > 0


def bucket_has_topic_configuration(client, bucketName) -> bool:
    response = client.get_bucket_notification_configuration(
        Bucket=bucketName
    )
    return len(response['TopicConfigurations']) > 0 

def bucket_has_configuration_for_object_created_events(client, bucketName) -> bool:
    response = client.get_bucket_notification_configuration(
        Bucket=bucketName
    )

    for topic in response['TopicConfigurations']:
        if 's3:ObjectCreated:*' in topic['Events']:
            return True
    
    for queue in response['QueueConfigurations']:
        if 's3:ObjectCreated:*' in queue['Events']:
            return True

    for lambda_config in response['LambdaFunctionConfigurations']:
        if 's3:ObjectCreated:*' in lambda_config['Events']:
            return True

    return False


def get_arns_of_topics_configured_for_bucket_object_create_events(client, bucketName) -> list:
    response = client.get_bucket_notification_configuration(
        Bucket=bucketName
    )
    topic_arns = []
    for topic in response['TopicConfigurations']:
        if 's3:ObjectCreated:*' in topic['Events']:
            topic_arns.append(topic['TopicArn'])

