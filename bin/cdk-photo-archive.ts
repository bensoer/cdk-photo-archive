#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PhotoArchiveStack } from '../lib/photo-archive-stack';
import { Configuration } from '../conf/configuration';
import { PhotoArchiveSettingsStack } from '../lib/photo-archive-settings-stack';
import { PhotoArchiveBucketsStack } from '../lib/photo-archive-buckets-stack';

const app = new cdk.App();

const configuration = new Configuration()
const deploymentRegion = configuration.getConfiguration().deploymentRegion

let photoArchiveStackName = configuration.getConfiguration().photoArchiveStackName ?? `photo-archive-stack`
let photoArchiveSettingsStackName = configuration.getConfiguration().photoArchiveSettingsStackName ?? `photo-archive-settings-stack`
let photoArchiveBucketsStackName = configuration.getConfiguration().photoArchiveBucketsStackName ?? `photo-archive-bucket-stack`

const appendRegionToStackNames = configuration.getConfiguration().appendDeploymentRegionToStackNames ?? true
if(appendRegionToStackNames){
  photoArchiveStackName += `-${deploymentRegion}`
  photoArchiveSettingsStackName += `-${deploymentRegion}`
  photoArchiveBucketsStackName += `-${deploymentRegion}`
}


const photoArchiveBucketsStack = new PhotoArchiveBucketsStack(app, `photo-archive-bucket-stack-${deploymentRegion}-id`,{
  stackName: photoArchiveBucketsStackName,
  description: "Stack containing S3 archive bucket configuration for photo archiving infrastructure",
  configuration: configuration,

  env:{
    region: deploymentRegion,
    account: process.env.CDK_DEFAULT_ACCOUNT
  }
})

const photoArchiveStack = new PhotoArchiveStack(app, `photo-archive-stack-${deploymentRegion}-id`, {
  stackName: photoArchiveStackName,
  description: "Main stack containing architecture for photo archive infrastructure",

  configuration: configuration,
  mainBuckets: photoArchiveBucketsStack.mainBuckets,

  env:{
    region: deploymentRegion,
    account: process.env.CDK_DEFAULT_ACCOUNT
  }
});

new PhotoArchiveSettingsStack(app, `photo-archive-settings-stack-${deploymentRegion}-id`, {
  stackName: photoArchiveSettingsStackName,
  description: "Stack containing settings related infrastructure for photo archive infrastructure",
  features: configuration.getConfiguration().features,
  lambdaMap: photoArchiveStack.lambdaMap,

  env:{
    region: deploymentRegion,
    account: process.env.CDK_DEFAULT_ACCOUNT
  }
})