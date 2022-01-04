
import boto3
import json

lambda_client = boto3.client("lambda")

def lambda_handler(event, context):

    sqs_records = event['Records']
    for sqs_record in sqs_records:
        request_event = json.loads(sqs_record["body"])
        print(request_event)

        completed_features = request_event["numberOfFeaturesCompleted"]
        if completed_features < len(request_event["features"]):
            # there are still features to be done
            for feature in request_event["features"]:
                if feature["available"] and not feature["completed"]:
                    print("Feature {} Is Available And Has Not Completed Yet. Invoking".format(feature["name"]))
                    
                    lambda_client.invoke(
                        FunctionName=feature["lambdaArn"],
                        InvocationType='Event',
                        Payload=request_event
                    )

                    # we don't want to run features in parallel. we wait for the next execution of dispatcher
                    break
            
            # If we get here, then we looked over all features and found all of them complete
            print("Walked Through All Features And They Are All Either Completed Or Not Available. Nothing Left To Do")
        else:
            print("Request Event Has Already Had All Features Completed. Nothing Left To Do")
