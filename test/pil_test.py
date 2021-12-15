import exifread
import enum

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
    IMG_APERATURE = "EXIF AperatureValue"




exif = exifread.process_file(open("./20210930-DSC_8646.jpg", "rb"))

print(exif[ExifTagNames.CAMERA_MAKE.value])