import exifread
import boto3
import urllib.parse
import json
import math
import enum
import time
from os import environ
from io import BytesIO
from feature_processing import FeatureProcessing
from dynamo_helper import DynamoHelper, DynamoEvent
import common

s3 = boto3.client("s3")
sqs = boto3.client("sqs")
ssm = boto3.client("ssm")

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
    IMG_APERATURE = "EXIF ApertureValue"

class TagKeys(enum.Enum):
    CAMERA_AND_LENSE_INFO = 'Camera and Lense Information'
    PHOTO_INFORMATION = 'Photo Information'
    PHOTO_DATE = "Photo Date"

PHOTO_FILE_TYPES = ["jpg", "jpeg", "png", "dng"]

FEATURE_NAME = environ.get("FEATURE_NAME")
SETTINGS_PREFIX = environ.get("SETTINGS_PREFIX")
DYNAMODB_METRICS_QUEUE_URL = environ.get("DYNAMODB_METRICS_QUEUE_URL", "Invalid")

def convert_exif_shutter_speed(exif_shutter_speed_value:str) -> str:
    top_number = int(exif_shutter_speed_value.split("/")[0])
    bottom_number = int(exif_shutter_speed_value.split("/")[1])

    decimal_value = top_number / bottom_number
    seconds_over_one = math.pow(2, decimal_value / 2)

    shutter_speed_string = "1/{}".format(round(seconds_over_one))
    return shutter_speed_string

def convert_exif_aperture_speed(exif_aperture_value:str) -> str:
    top_number = int(exif_aperture_value.split("/")[0])
    bottom_number = int(exif_aperture_value.split("/")[1])

    decimal_value = top_number / bottom_number
    seconds_over_one = math.pow(2, decimal_value / 2)

    shutter_speed_string = "1/{}".format(round(seconds_over_one, 1))
    return shutter_speed_string


def lambda_handler(event, context):

    if not common.is_feature_enabled(ssm, SETTINGS_PREFIX, FEATURE_NAME):
        print("{} Has Been Disabled. Skipping Execution".format(FEATURE_NAME))
        return event
    
    bucket = event["bucketName"]
    bucketArn = event["bucketArn"]
    key = event["key"]
    key_file_format = (key.split(".")[len(key.split("."))-1]).strip()

    if key_file_format.lower() not in PHOTO_FILE_TYPES:
        print("File {} Is Not A Valid Photo Image. Can Not Process".format(key))
        print("Invalid File: {} in Bucket: {}".format(key, bucket))
    else:
        print("File {} Is A Valid Photo Image. Processing Its Meta".format(key))
        print("Processing Photo Information For File: {} in Bucket: {}".format(key, bucket))
        
        response = s3.get_object(Bucket=bucket, Key=key)
        content_stream = response['Body']
        bs = BytesIO(content_stream.read())

        exif = exifread.process_file(bs)

        print("EXIF Information Fetched. Loading Tags")
        print("Now Fetching And Updating Tags")

        # Fetch the current tagging of the photo
        get_object_tagging_response = s3.get_object_tagging(
            Bucket=bucket,
            Key=key,
        )
        tagset = list(filter(lambda tagset: tagset['Key'] not in [
            TagKeys.CAMERA_AND_LENSE_INFO.value,
            TagKeys.PHOTO_INFORMATION.value,
            TagKeys.PHOTO_DATE.value
        ], get_object_tagging_response['TagSet']))

        # Extend with new values
        tagset.extend([
            {
                'Key': TagKeys.CAMERA_AND_LENSE_INFO.value,
                'Value': '{} {} - {}'.format(
                    exif.get(ExifTagNames.CAMERA_MAKE.value, 'Unknown'),
                    exif.get(ExifTagNames.CAMERA_MODEL.value, 'Unknown'),
                    exif.get(ExifTagNames.LENSE_MODEL.value, 'Unknown')
                )
            },
            {
                'Key': TagKeys.PHOTO_INFORMATION.value,
                'Value': 'Shutter: {} Aperature: {} ISO: {} Resolution: {}x{} Focal Length: {}'.format(
                    exif.get(ExifTagNames.IMG_SHUTTER_SPEED.value, 'Unknown'),
                    exif.get(ExifTagNames.IMG_APERATURE.value, 'Unknown'),
                    exif.get(ExifTagNames.IMG_ISO.value, 'Unknown'),
                    exif.get(ExifTagNames.IMG_X_RESOLUTION.value, 'Unknown'),
                    exif.get(ExifTagNames.IMG_Y_RESOLUTION.value, 'Unknown'),
                    exif.get(ExifTagNames.LENSE_FOCAL_LENGTH.value, 'Unknown')
                )
            },
            {
                'Key': TagKeys.PHOTO_DATE.value,
                'Value': '{}'.format(
                    exif.get(ExifTagNames.IMG_DATETIME.value, 'Unknown')
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

    fp = FeatureProcessing(event)
    updated_fp = fp.generate_updated_request_queue_object(FEATURE_NAME)

    de = DynamoEvent()
    de.bucket = bucket
    de.key = key
    de.bucketArn = bucketArn
    de.featureName = FEATURE_NAME
    de.featureData = { key:value for key, value in exif.items() }
    DynamoHelper(DYNAMODB_METRICS_QUEUE_URL, sqs).create_entry(de)

    print("Feature Processing Complete. Terminating")

    return updated_fp.get_request_queue_object()