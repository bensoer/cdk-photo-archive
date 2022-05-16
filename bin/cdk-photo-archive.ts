#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PhotoArchiveStack } from '../lib/photo-archive-stack';
import { ConfigurationSingletonFactory } from '../lib/conf/configuration-singleton-factory';
import { Tag, Tags } from 'aws-cdk-lib';

const app = new cdk.App();

const settings = ConfigurationSingletonFactory.getConcreteSettings()

let photoArchiveStackName = settings.photoArchiveStackName

if(settings.appendDeploymentRegionToStackNames){
  photoArchiveStackName += `-${process.env.CDK_DEFAULT_REGION}`
}

const photoArchiveStack = new PhotoArchiveStack(app, `PhotoArchiveStack`, {
  stackName: photoArchiveStackName,
  description: "Main stack containing architecture for photo archive infrastructure",

  env:{
    region: process.env.CDK_DEFAULT_REGION,
    account: process.env.CDK_DEFAULT_ACCOUNT
  }
});

Tags.of(photoArchiveStack).add("Application", "PhotoArchiveStack")
Tags.of(photoArchiveStack).add("RootStackName", photoArchiveStackName)
//Tags.of(photoArchiveStack).add("CreatedDate", new Date().toUTCString())
