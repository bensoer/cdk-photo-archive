#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PhotoArchiveStack } from '../lib/photo-archive-stack';
import { Configuration } from '../conf/configuration';
import { PhotoArchiveSettingsStack } from '../lib/photo-archive-settings-stack';
import { PhotoArchiveBucketsStack } from '../lib/photo-archive-buckets-stack';
import { ConfigurationSingletonFactory } from '../lib/conf/configuration-singleton-factory';

const app = new cdk.App();

const settings = ConfigurationSingletonFactory.getConcreteSettings()


const deploymentRegion = settings.deploymentRegion
let photoArchiveStackName = settings.photoArchiveStackName
let photoArchiveSettingsStackName = settings.photoArchiveSettingsStackName
let photoArchiveBucketsStackName = settings.photoArchiveBucketsStackName

if(settings.appendDeploymentRegionToStackNames){
  photoArchiveStackName += `-${deploymentRegion}`
  photoArchiveSettingsStackName += `-${deploymentRegion}`
  photoArchiveBucketsStackName += `-${deploymentRegion}`
}


const photoArchiveBucketsStack = new PhotoArchiveBucketsStack(app, `photo-archive-bucket-stack-${deploymentRegion}-id`,{
  stackName: photoArchiveBucketsStackName,
  description: "Stack containing S3 archive bucket configuration for photo archiving infrastructure",

  env:{
    region: deploymentRegion,
    account: process.env.CDK_DEFAULT_ACCOUNT
  }
})

const photoArchiveStack = new PhotoArchiveStack(app, `photo-archive-stack-${deploymentRegion}-id`, {
  stackName: photoArchiveStackName,
  description: "Main stack containing architecture for photo archive infrastructure",

  mainBuckets: photoArchiveBucketsStack.mainBuckets,

  env:{
    region: deploymentRegion,
    account: process.env.CDK_DEFAULT_ACCOUNT
  }
});

new PhotoArchiveSettingsStack(app, `photo-archive-settings-stack-${deploymentRegion}-id`, {
  stackName: photoArchiveSettingsStackName,
  description: "Stack containing settings related infrastructure for photo archive infrastructure",
  features: settings.features,
  lambdaMap: photoArchiveStack.lambdaMap,

  env:{
    region: deploymentRegion,
    account: process.env.CDK_DEFAULT_ACCOUNT
  }
})