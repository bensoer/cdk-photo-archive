import json

class DynamoEvent:
    bucket:str
    key:str
    bucketArn:str
    featureName:str
    featureData: dict

class DynamoHelper:

    dynamo_metrics_queue_url: str = "Invalid"

    def __init__(self, dynamo_metrics_queue_url:str, sqs_client) -> None:
        self.dynamo_metrics_queue_url = dynamo_metrics_queue_url
        self.sqs_client = sqs_client

    def create_entry(self, dynamo_event:DynamoEvent) -> None:
        if self.dynamo_metrics_queue_url != "Invalid":
            print("DynamoDB Metrics Enabled. Creating Entry")

            dynamo_event = {
                "bucket": dynamo_event.bucket,
                "key": dynamo_event.key,
                "bucketArn": dynamo_event.bucketArn,
                "featureName": dynamo_event.featureName,
                "featureData": dynamo_event.featureData
            }

            self.sqs_client.send_message(
                QueueUrl=self.dynamo_metrics_queue_url,
                MessageBody=json.dumps(dynamo_event)
            )
        
    
    