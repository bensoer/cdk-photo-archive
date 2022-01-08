# cdk-photo-archive
cdk-photo-archive is a CDK project that sets up an archiving suite for photographers in AWS. This prepackaged setup allows photographers to easily configure an archiving system using AWS S3 storage. Taking advantage of S3s glacier storage functionality.

In addition, cdk-photo-archive has a number of additional lambda features that allow tagging of S3 photo files. This includes, hashing information, photo meta information, and AWS rekognition analysis describing the contents of the photo. These features allow photographers to view their files in glacier storage and get an idea of what the file is, or whether they even want it, before retrieving it.

All this functionality and much more is also highly costumisable!

cdk-photo-archive is also meant to work with existing S3 storage archives on AWS. This way photographers already taking advantage of cloud storage can still use cdk-phot-archive's hashing, meta and rekognition tagging features.

# Prerequsites

## AWS CLI & Account
This is an AWS CDK Project meant for an AWS Account. For the easiest time deploying it is recommended to setup the AWS CLI on your local computer and configure your `[default]` profile to authenticate with your AWS Account in your desired region. See the following links for setting up:
- AWS Account Setup: https://aws.amazon.com/premiumsupport/knowledge-center/create-and-activate-aws-account/
- AWS CLI Setup: https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-getting-started.html
## AWS CDK
The project is build using CDKv2.1.0. You will need it installed on your system. This can be done by installing the latest LTS of Nodejs then by running the following command:
```bash
npm install -g aws-cdk
```
You can find more details here: https://docs.aws.amazon.com/cdk/v2/guide/cli.html



# Quick Setup
1. Clone the repository or download the latest release from https://github.com/bensoer/cdk-photo-archive/releases and unzip it
2. `cd` into the repository
3. Run `npm install` 
4. Run `cdk deploy --all`

This will deploy the default configuration and setup. For more details on configuration. See the #Configuration section

# Configuration
cdk-photo-archive comes with a number of features and customisations to work with your AWS account, archiving setup and preferences.

Within `conf/configuration.ts` contains `getConfiguration()` method which returns an `IConfiguration` object containing all of the configuration settings that can be done to setup the project. Some of the paramaters are _required_ and others are _optional_ with default values if they are not provided. The following table is a breakdown of all the settings

| Setting | Type | Required? | Default Value | Description |
| ------- | ---- | -------- | ------------- | ----------- |
| `feautures` | `Array<Features>` | YES | N/A | List containing all feature lambdas in the cdk-photo-archive. Use the `Features` enum to define which functionalities to include in your deployment. |
| `deploymentRegion` | `Regions` | YES | N/A | |
| `useExistingBuckets` | `Array<string>` | NO | See Description | By default, cdk-photo-archive creates the archive buckets. When this value is left as `undefined`, the default functionality will be applied. If you have your own buckets that you would prefer to integrate with the cdk-photo-archive then define this setting with a list of the bucket ARNs to include |
| `bucketNamePrefix` | `string` | NO | `pt` | Specify a prefix to append to the buckets created by the cdk-photo-archive. If not defined, the default value is used. The default value is `pt`. *Note*: This functionality is only valid if cdk-photo-archive creates the buckets |
| `appendRegionToBucketName` | `boolean` | NO | true | Set whether to append the deployment region (ex: us-east-1) to the bucket names. If not defined the default value will be used. *Note*: This functionality is only valid if the cdk-photo-archive creates the buckets|
| `switchToInfrequentAccessTierAfterDays` | `number` | NO | 90 | |
| `switchToGlacierAccessTierAfterDays` | `number` | NO | 120 | |
| `photoArchiveStackName` | `string` | NO | photo-archive-stack | |
| `photoArchiveSettingsStackName` | `string` | NO | photo-archive-settings-stack | |
| `photoArchiveBucketStackName` | `string` | NO | photo-archive-bucket-stack` | |

You can also view a breakdown of what each and every setting does within `lib/conf/i-configuration.ts`

# Configuration After Deployment
cdk-photo-archive also deploys a number of settings to SSM Parameter Settings on AWS. These can be found under `/pa` section. Changes to these settings can be made to effect the system in real-time if need be, without having to re-deploy from the CDK. *WARNING* If possible, it is better to redeploy changes from the CDK. The settings available within SSM Parameter Store are as follows:

| Path | Description |
| ---- | ----------- |
| `/pa/features` | Contains a StringList of all available features that were deployed with cdk-photo-archive |
| `/pa/features/<featurename>/enabled` | Setting value of TRUE or FALSE as to whether the given feature is enabled. When deploying this value is automatically set to TRUE. By changing it to FALSE, the given feature is disabled from future executions.

# TODO - Feature List
- Set "feature" names as more global - its hardcoded currently - DONE
- Ability to import existing S3 buckets instead of having CDK project create and manage them - avoid users from having to dev CDK, make this a setting - DONE
- Configuration file
    - Ability to enable/disable which "features" to have applied to archive - DONE
    - Ability to specify naming of S3 Buckets, SQS Queues and Lambda Functions
        - V1 - able to specify a prefix so that its unique within account / unique within AWS
        - V2 - full name overrides
- Implement creation of SSM Parameter store - housing enable/disable and lambda ARNs - DONE
    - Improve dynamicness of running "features" - users should be able to enable/disable in Parameter Store or defaults in CDK and things will adjust appropriatly - DONE
- Store status information of each photo in dynamoDB table ?
    - Make this optional, enable/disable also as a setting in the configuration file
    - Entry stores Bucket, Key and which "features" have been applied to the photo
- Complete README documentation for user friendly installation and uninstallation
- Make naming consistent between Features - SSM Param name, Lambda Name, Feature Name, Feature Enum Name

# Developer Notes

## Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

### Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
