#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { PhotoArchiveStack } from '../lib/photo-archive-stack';
import { Configuration } from '../conf/configuration';
import { PhotoArchiveSettingsStack } from '../lib/photo-archive-settings-stack';

const app = new cdk.App();

const configuration = new Configuration()

const photoArchiveStack = new PhotoArchiveStack(app, 'photo-archive-stack-us-east-1', {
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  configuration: configuration,
  env:{
    region: "us-east-1"
  }

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});

new PhotoArchiveSettingsStack(app, 'photo-archive-settings-stack-us-east-1', {
  features: configuration.getConfiguration().features,
  lambdaMap: photoArchiveStack.lambdaMap,

  env:{
    region: "us-east-1"
  }
})