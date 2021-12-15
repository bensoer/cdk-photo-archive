import exifread
import boto3
import urllib.parse
import json
import math
import enum
import time

s3 = boto3.client("s3")
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
    IMG_APERATURE = "EXIF AperatureValue"

PHOTO_FILE_TYPES = [".jpg", ".jpeg", ".png", ".dng"]

def lambda_handler(event, context):
    
    # Get the object from the event and show its content type
    sqs_records = event['Records']
    for sqs_record in sqs_records:
        s3_event = json.loads(sqs_record["body"])
        print(s3_event)

        for s3_record in s3_event['Records']:

            bucket = s3_record['s3']['bucket']['name']
            key = urllib.parse.unquote_plus(s3_record['s3']['object']['key'], encoding='utf-8')

            if key.lower() in PHOTO_FILE_TYPES:
                print("File {} Is A Valid Photo Image. Processing Its Meta".format(key))
                print("Processing Photo Information For File: {} in Bucket: {}".format(key, bucket))
                
                response = s3.get_object(Bucket=bucket, Key=key)
                content_stream = response['Body']

                exif = exifread.process_file(content_stream)

                print("EXIF Information Fetched. Loading Tags")

                print("Grabbing Lock From Parameter Store")

                lock_status = "UNLOCKED"
                try:
                    tag_lock = ssm.get_parameter(
                        Name="locks/tagging/{}".format(bucket.lower())
                    )
                    lock_status = tag_lock['Parameter']['Value']
                except ssm.exceptions.ParameterNotFound as pne:
                    print("Lock Parameter Has Never Been Setup For This Bucket. Assuming Its Ours Then")
                    lock_status = "UNLOCKED"

                while lock_status == 'LOCKED':
                    print("Parameter Is Locked. Sleeping Until Unlocked")
                    time.sleep(30)

                    tag_lock = ssm.get_parameter(
                        Name="locks/tagging/{}".format(bucket.lower())
                    )
                    lock_status = tag_lock['Parameter']['Value']

                print("Parameter Is Not Locked. Locking And Fetching")

                ssm.put_parameter(
                    Name="locks/tagging/{}".format(bucket.lower()),
                    Value="LOCKED"
                )

                print("Now Fetching And Updating Tags")

                get_object_tagging_response = s3.get_object_tagging(
                    Bucket=bucket,
                    Key=key,
                )
                tagset = get_object_tagging_response['TagSet']

                shutter_speed_value = exif[ExifTagNames.IMG_SHUTTER_SPEED.value]
                top_number = int(shutter_speed_value.split("/")[0])
                bottom_number = int(shutter_speed_value.split("/")[1])

                decimal_value = top_number / bottom_number
                seconds_over_one = math.pow(2, decimal_value)

                shutter_speed_string = "1/{}".format(seconds_over_one)


                tagset.extend([
                    {
                        'Key': 'Camera & Lengse Information',
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


                s3.put_object_tagging(
                    Bucket=bucket,
                    Key=key,
                    Tagging={
                        'TagSet': tagset
                    }
                )
                print("Tags Applied. Unlocking Bucket")

                ssm.put_parameter(
                    Name="locks/tagging/{}".format(bucket.lower()),
                    Value="UNLOCKED"
                )
                print("{} Bucket Unlocked".format(bucket))