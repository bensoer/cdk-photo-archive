# cdk-photo-archive
cdk-photo-archive is a CDK project that sets up an archiving suite for photographers in AWS. This prepackaged setup allows photographers to easily configure an archiving system using AWS S3 storage. Taking advantage of S3s glacier storage functionality.

In addition, cdk-photo-archive has a number of additional lambda features that allow tagging of S3 photo files. This includes, hashing information, photo meta information, and AWS rekognition analysis describing the contents of the photo. These features allow photographers to view their files in glacier storage and get an idea of what the file is, or whether they even want it, before retrieving it.

All this functionality and much more is also highly costumisable!

cdk-photo-archive can also work with existing S3 storage archives on AWS. This way photographers already taking advantage of cloud storage can still use cdk-phot-archive's hashing, meta and rekognition tagging features.

# Prerequsites

## AWS CLI & Account
This is an AWS CDK Project meant for an AWS Account. For the easiest time deploying it is recommended to setup the AWS CLI on your local computer and configure your `[default]` profile to authenticate with your AWS Account in your desired region. See the following links for setting up:

**AWS Account Setup:** 
- https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/

**AWS CLI Setup:** 
- https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html
- https://docs.aws.amazon.com/cdk/v2/guide/cli.html
## Nodejs & AWS CDK
The project is build using CDKv2.1.0. You will need it installed on your system. This can be done by installing the latest LTS of Nodejs (https://nodejs.org/en/download/) then by running the following command:
```bash
npm install -g aws-cdk
```

# Quick Setup
1. Clone the repository or download the latest release from https://github.com/bensoer/cdk-photo-archive/releases and unzip it
2. `cd` into the repository
3. Run `npm install` 
4. Run `cdk deploy --all`

This will deploy the default configuration and setup. For more details on configuration. See the #Configuration section

# Configuration
cdk-photo-archive comes with a number of features and customisations to work with your AWS account, archiving setup and preferences.

Within `conf/configuration.ts` contains `getConfiguration()` method which returns an `IConfiguration` object containing all of the configuration settings that can be done to setup the project. Some of the paramaters are _required_ and others are _optional_ with default values if they are not provided. The minimum necessary settings to get the project up and running have been set within the repo. For details on all of the settings available, see the wiki page or the comments within `lib/conf/i-configuration.ts`


## Setting Feature Lambdas
Feature lambdas are lambdas that execute a certain task every time a photo is uploaded to the archive bucket. To use these lambdas, they must be listed in the `features` setting in the `conf/configuration.ts` file. Each feature lambda is mapped to a value in the `Features` enum. Each feature lambda is as follows:

| Name | Features Enum Value | Description |
| ---- | ------------------- | ----------- |
| Hash Tag Lambda | `Features.HASH_TAG` | Tags each file with an MD5, SHA1, SHA256 and SHA512 hash of the file |
| Photo Meta Tag Lambda | `Features.PHOTO_META_TAG` | Tags each photo with Camera & Lense information, Photo Information (ISO, Aperture, Shutter Speed, etc) and the Image Date based on EXIF data within the photo. Only valid for JPEG, JPG, PNG and DNG files. |
| Photo Rekog Tag Lambda | `Features.PHOTO_REKOG_TAG` | Uses AWS Rekognition to add up to 10 labels describing the contents of the photo. Only valid for JPEG, JPG and PNG files. |

An example of settings the features setting may look like this:
```javascript
features: [
    Features.HASH_TAG,
    Features.PHOTO_META_TAG,
    Features.PHOTO_REKOG_TAG
]
```

## Tiered Archive Storage
cdk-photo-archive's bucket is configured with tiered storage to reduce costs for your archived files. It is done in a scheduled manner though so that more recently uploaded files can still be accessed with minimal detriment. The tiering is configured in a way to slowly reduce storage cost, but at the expense of more expensive and difficult retrieval. This allows photographers to still retrieve files if shortly after uploading find they still need the photos.

cdk-photo-archive takes advantage of 3 AWS S3 Storage tiers: Standard, Infrequent Access (Standard-IA), and Glacier (Flexible Retrieval). You can find more details of this from AWS here: https://aws.amazon.com/s3/storage-classes/

By default, cdk-photo-archive will transition archived files from Standard tier to Infrequent Access tier after 90 days. Then, after 120 days will transition archived files to Glacier (Flexible Retrieval). cdk-photo-archive currently does not have implemented support for Glacier Deep Archive. These transition days can be changed within the `conf/configuration.ts` file. `switchToInfrequentAccessAfterDays` and `switchToGlacierAccessAfterDays` settings configures these transition day values. Applying these changes will require a deployment of the cdk.

An example of these settings may look like this:
```javascript
switchToInfrequentAccessAfterDays: 90,
switchToGlacierAccessAfterDays: 120
```

## Bring Your Own Bucket (BYOB)
cdk-photo-archive supports Bring-Your-Own-Bucket. This way you can configure and control your existing archive buckets as you wish, but still take advantage of the cdk-photo-archive's feature lambdas. Configuration of this is done by setting the `useExistingBuckets` parameter in the `conf/configuration.ts` file. By default this value is `undefined`. Once it is defined, the cdk-photo-archive will no longer manage or create any buckets for the archive. Any features related to archive storage including tiering and naming will be ineffective. 

`useExistingBuckets` setting takes an array of strings. Where the strings are the full ARN values of the existing buckets you want cdk-photo-archive to use. An example of this configuration may look as follows:
```javascript
useExistingBuckets: [
    "arn:aws:s3:::pt-photo-archive",
    "arn:aws:s3:::my-other-archive"
]
```
**Note:** If at a later time, you want to revert this, remove the setting from `conf/configuration.ts`, set the value to `undefined` or leave it as an empty array

**Note:** If you have already deploy the cdk-photo-archive and it has created the buckets for you. You will need to first fully destroy the stack with `cdk destroy --all` before configuring BYOB and redeploying.

**Tip:** cdk-photo-archive will create the archive bucket for you if you do not supply one. In the event you need to entirely delete the cdk-photo-archive stack. The archive bucket will not be deleted. When restoring the stack though, the CDK will error that the bucket it wishes to create already exists. You can work around this issue by then copying the ARN of the bucket created previously from the CDK and treating it like BYOB.

# Configuration After Deployment
cdk-photo-archive also deploys a number of settings to SSM Parameter Settings on AWS. These can be found under `/pa` section. Changes to these settings can be made to effect the system in real-time if need be, without having to re-deploy from the CDK. *WARNING* If possible, it is better to redeploy changes from the CDK. The settings available within SSM Parameter Store are as follows:

| Path | Description |
| ---- | ----------- |
| `/pa/features` | Contains a StringList of all available features that were deployed with cdk-photo-archive |
| `/pa/features/<featurename>/enabled` | Setting value of TRUE or FALSE as to whether the given feature is enabled. When deploying this value is automatically set to TRUE. By changing it to FALSE, the given feature is disabled from future executions.


# Developer Notes
## TODO - Feature List
- ~~Set "feature" names as more global - its hardcoded currently~~ - DONE
- ~~Ability to import existing S3 buckets instead of having CDK project create and manage them - avoid users from having to dev CDK, make this a setting~~ - DONE
- Configuration file
    - ~~Ability to enable/disable which "features" to have applied to archive~~ - DONE
    - Ability to specify naming of S3 Buckets, SQS Queues and Lambda Functions
        - V1 - able to specify a prefix so that its unique within account / unique within AWS
        - V2 - full name overrides
- ~~Implement creation of SSM Parameter store - housing enable/disable and lambda ARNs~~ - DONE
    - ~~Improve dynamicness of running "features" - users should be able to enable/disable in Parameter Store or defaults in CDK and things will adjust appropriatly~~ - DONE
- Store status information of each photo in dynamoDB table ?
    - Make this optional, enable/disable also as a setting in the configuration file
    - Entry stores Bucket, Key and which "features" have been applied to the photo
    - Entry stores all EXIF tag data about the photo
    - Entry stores all Rekognition labels at default validity (55% vs 75% which is tagged)
- Create an API endpoint for accessing  dynamoDB table information ?
- Create a Reactjs App to view dynamoDB table information ?
- ~~Complete README documentation for user friendly installation and uninstallation~~ - DONE
- ~~Make naming consistent between Features - SSM Param name, Lambda Name, Feature Name, Feature Enum Name~~ - DONE
- Custom Resources - Retrieve Data Back in the CDK: https://baihuqian.github.io/2020-12-17-lambda-based-cdk-custom-resource-with-input-and-output/
    - CustomResource for bucket handling ?
    - CustomResource for dynamodb handling ?
