import exifread
import enum
import math

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

class ExifTagNames(enum.Enum):
    CAMERA_MAKE = "Image Make"
    CAMERA_MODEL = "Image Model"
    LENSE_FOCAL_LENGTH = "EXIF FocalLength"
    IMG_X_RESOLUTION = "Image XResolution"
    IMG_Y_RESOLUTION = "Image YResolution"
    IMG_DATETIME = "Image DateTime"
    IMG_EXPOSURE = "EXIF ExposureTime"
    IMG_ISO = "EXIF ISOSpeedRatings"
    IMG_SHUTTER_SPEED = "EXIF ShutterSpeedValue"
    IMG_APERATURE = "EXIF ApertureValue"




exif = exifread.process_file(open("./20210930-DSC_8646.jpg", "rb"))

print(exif[ExifTagNames.IMG_APERATURE.value])
print(type(exif[ExifTagNames.IMG_APERATURE.value]))

fstop = convert_exif_aperture_speed(str(exif[ExifTagNames.IMG_APERATURE.value]))
print(fstop)