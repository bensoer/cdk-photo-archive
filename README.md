# cdk-photo-archive
cdk-photo-archive is a CDK project that sets up an archiving suite for photographers in AWS. This prepackaged setup allows photographers to easily configure an archiving system using AWS S3 storage. Taking advantage of S3s glacier storage functionality.

In addition, cdk-photo-archive has a number of additional lambda features that allow tagging of S3 photo files. This includes, hashing information, photo meta information, and AWS rekognition analysis describing the contents of the photo. These features allow photographers to view their files in glacier storage and get an idea of what the file is, or whether they even want it, before retrieving it.

All this functionality and much more is also highly costumisable!

cdk-photo-archive can also work with existing S3 storage archives on AWS. This way photographers already taking advantage of cloud storage can still use cdk-phot-archive's hashing, meta and rekognition tagging features.

For full details on all available features, and configuration see the wiki page : https://github.com/bensoer/cdk-photo-archive/wiki

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

Within `conf/configuration.ts` contains `getConfiguration()` method which returns an `IConfiguration` object containing all of the configuration settings that can be done to setup the project. Some of the paramaters are _required_ and others are _optional_ with default values if they are not provided. The minimum necessary settings to get the project up and running have been set within the repo. For details on all of the settings available, see the wiki page (https://github.com/bensoer/cdk-photo-archive/wiki/Configuration-Options) or the comments within `lib/conf/i-configuration.ts`


## Setting Feature Lambdas
Feature lambdas are lambdas that execute a certain task every time a photo is uploaded to the archive bucket. To use these lambdas, they must be listed in the `features` setting in the `conf/configuration.ts` file. Each feature lambda is mapped to a value in the `Features` enum. See https://github.com/bensoer/cdk-photo-archive/wiki/Configuration-Options#features for details
