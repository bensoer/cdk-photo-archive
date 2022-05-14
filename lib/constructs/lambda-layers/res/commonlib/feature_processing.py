

import json
import copy
import typing

class FeatureProcessing:

    def __init__(self, request_queue_object:dict) -> None:
        self.request_queue_object = request_queue_object

    def has_more_processing(self) -> bool:
        current_number_features_completed = self.request_queue_object["numberOfFeaturesCompleted"] + 1
        return current_number_features_completed < len(self.request_queue_object["features"])

    def generate_updated_request_queue_object(self, feature_name:str):
        current_number_features_completed = self.request_queue_object["numberOfFeaturesCompleted"] + 1
        local_copy = copy.deepcopy(self.request_queue_object)

        for index, feature in enumerate(local_copy["features"]):
            if feature["name"] == feature_name:
                local_copy["features"][index]["completed"] = True
                local_copy["numberOfFeaturesCompleted"] = current_number_features_completed
                return FeatureProcessing(local_copy)

    def send_request_object_to_queue(self, request_queue_url:str, sqs_client) -> None:
        sqs_client.send_message(
            QueueUrl=request_queue_url,
            MessageBody=json.dumps(self.request_queue_object)
        )
