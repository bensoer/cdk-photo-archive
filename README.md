# cdk-photo-archive
cdk-photo-archive is a CDK project that sets up an archiving suite for photographers in AWS. This prepackaged setup allows photographers to easily configure an archiving system using AWS S3 storage. Taking advantage of S3s glacier storage functionality.

In addition, cdk-photo-archive has a number of additional lambda features that allow tagging of S3 photo files. This includes, hashing information, photo meta information, and AWS rekognition analysis describing the contents of the photo. These features allow photographers to view their files in glacier storage and get an idea of what the file is, or whether they even want it, before retrieving it.

All this functionality and much more is also highly costumisable!

cdk-photo-archive is also meant to work with existing S3 storage archives on AWS. This way photographers already taking advantage of cloud storage can still use cdk-phot-archive's hashing, meta and rekognition tagging features.


This project is still heavily under development



# TODO
- Set "feature" names as more global - its hardcoded currently - DONE
- Ability to import existing S3 buckets instead of having CDK project create and manage them - avoid users from having to dev CDK, make this a setting
- Configuration file
    - Ability to enable/disable which "features" to have applied to archive - DONE
    - Ability to specify naming of S3 Buckets, SQS Queues and Lambda Functions
        - V1 - able to specify a prefix so that its unique within account / unique within AWS
        - V2 - full name overrides
- Implement creation of SSM Parameter store - housing enable/disable and lambda ARNs - DONE
    - Improve dynamicness of running "features" - users should be able to enable/disable in Parameter Store or defaults in CDK and things will adjust appropriatly
- Store status information of each photo in dynamoDB table ?
    - Make this optional, enable/disable also as a setting in the configuration file
    - Entry stores Bucket, Key and which "features" have been applied to the photo
- Complete README documentation for user friendly installation and uninstallation

# Welcome to your CDK TypeScript project!

This is a blank project for TypeScript development with CDK.

The `cdk.json` file tells the CDK Toolkit how to execute your app.

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
