import exifread
import boto3
import urllib.parse
import json
import math
import enum
import time
from os import environ

s3 = boto3.client("s3")
sqs = boto3.client("sqs")
class ExifTagNames(enum.Enum):
    CAMERA_MAKE = "Image Make"
    CAMERA_MODEL = "Image Model"
    LENSE_FOCAL_LENGTH = "EXIF FocalLength"
    LENSE_MODEL = "EXIF LensModel"
    IMG_X_RESOLUTION = "Image XResolution"
    IMG_Y_RESOLUTION = "Image YResolution"
    IMG_DATETIME = "Image DateTime"
    IMG_ISO = "EXIF ISOSpeedRatings"
    IMG_SHUTTER_SPEED = "EXIF ExposureTime"
    IMG_APERATURE = "EXIF AperatureValue"

PHOTO_FILE_TYPES = [".jpg", ".jpeg", ".png", ".dng"]

FEATURE_NAME = environ.get("FEATURE_NAME")
REQUEST_QUEUE_URL = environ.get("REQUEST_QUEUE_URL")
REQUEST_QUEUE_ARN = environ.get("REQUEST_QUEUE_ARN")

def convert_exif_shutter_speed(exif_shutter_speed_value:str) -> str:
    top_number = int(exif_shutter_speed_value.split("/")[0])
    bottom_number = int(exif_shutter_speed_value.split("/")[1])

    decimal_value = top_number / bottom_number
    seconds_over_one = math.pow(2, decimal_value)

    shutter_speed_string = "1/{}".format(seconds_over_one)
    return shutter_speed_string


def lambda_handler(event, context):
    
    bucket = event["bucketName"]
    key = event["key"]
    key_file_format = key.split(".")[len(key.split("."))-1]

    if key_file_format.lower() not in PHOTO_FILE_TYPES:
        print("File {} Is Not A Valid Photo Image. Can Not Process".format(key))
        print("Invalid File: {} in Bucket: {}".format(key, bucket))
    else:
        print("File {} Is A Valid Photo Image. Processing Its Meta".format(key))
        print("Processing Photo Information For File: {} in Bucket: {}".format(key, bucket))
        
        response = s3.get_object(Bucket=bucket, Key=key)
        content_stream = response['Body']

        exif = exifread.process_file(content_stream)

        # Convert the Exif Shutter Speed To Human Readable String
        shutter_speed_string = convert_exif_shutter_speed(
            exif[ExifTagNames.IMG_SHUTTER_SPEED.value]
        )

        print("EXIF Information Fetched. Loading Tags")
        print("Now Fetching And Updating Tags")

        # Fetch the current tagging of the photo
        get_object_tagging_response = s3.get_object_tagging(
            Bucket=bucket,
            Key=key,
        )
        tagset = get_object_tagging_response['TagSet']

        # Extend with new values
        tagset.extend([
            {
                'Key': 'Camera & Lense Information',
                'Value': '{} {} - {}'.format(
                    exif[ExifTagNames.CAMERA_MAKE.value],
                    exif[ExifTagNames.CAMERA_MODEL.value],
                    exif[ExifTagNames.LENSE_MODEL.value]
                )
            },
            {
                'Key': 'Photo Information',
                'Value': 'Shutter: {} Aperature: {} ISO: {} Resolution: {}x{} Focal Length: {}'.format(
                    shutter_speed_string,
                    exif[ExifTagNames.IMG_APERATURE.value],
                    exif[ExifTagNames.IMG_ISO.value],
                    exif[ExifTagNames.IMG_X_RESOLUTION.value],
                    exif[ExifTagNames.IMG_Y_RESOLUTION.value],
                    exif[ExifTagNames.LENSE_FOCAL_LENGTH.value]
                )
            },
            {
                'Key': 'Photo Date',
                'Value': '{}'.format(
                    exif[ExifTagNames.IMG_DATETIME.value]
                )
            }
        ])

        # Put new tag values
        s3.put_object_tagging(
            Bucket=bucket,
            Key=key,
            Tagging={
                'TagSet': tagset
            }
        )
        print("Tags Applied. Evaluating Event Features")

        current_number_features_completed = event["numberOfFeaturesCompleted"] + 1
        if current_number_features_completed < len(event["features"]):
            # there are more features to complete.

            # mark ours as done
            for index, feature in enumerate(event["features"]):
                if feature["name"] == FEATURE_NAME:
                    event["features"][index]["completed"] = True
                    break

            # put into the requestQueue
            sqs.send_message(
                sqs.send_message(
                    QueueUrl=REQUEST_QUEUE_URL,
                    MessageBody=json.dumps(event)
                )
            )
        
        print("Feature Processing Complete. Terminating")