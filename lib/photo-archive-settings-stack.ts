import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { 
  aws_s3 as s3, 
  aws_sqs as sqs, 
  aws_s3_notifications as s3n,
  aws_lambda as lambda,
  aws_lambda_event_sources as lambda_event_sources,
  aws_iam as iam,
  aws_logs as logs,
  aws_ssm as ssm,
  custom_resources as cr,
  CustomResource
} from 'aws-cdk-lib';
import { BucketHashTagger } from './constructs/bucket-hash-tagger/bucket-hash-tagger';
import { PhotoMetaTagger } from './constructs/photo-meta-tagger/photo-meta-tagger';
import { EventLinker, LinkingConfiguration } from './constructs/event-linker/event-linker';
import { EventQueue } from './constructs/event-queue/event-queue';
import { DispatcherFunction } from './constructs/dispatcher-function/dispatcher-function';
import { RequestBuilderFunction } from './constructs/request-builder-function/request-builder-function';
import { RequestQueue } from './constructs/request-queue/request-queue';
import { HashingFunction } from './constructs/hash-function/hashing-function';
import { PhotoMetaFunction } from './constructs/photo-meta-function/photo-meta-function';
import { BucketQueueEventLinker } from './constructs/bucket-queue-event-linker/bucket-queue-event-linker';
import { Features } from './enums/features';

export interface PhotoArchiveSettingsStackProps extends StackProps {
    features: Array<Features>
    lambdaMap: Map<Features, string>
}

export class PhotoArchiveSettingsStack extends Stack {
  constructor(scope: Construct, id: string, props: PhotoArchiveSettingsStackProps) {
    super(scope, id, props);
    /**
     * 
        SSM Parameter Store Feature Data:

        /pa/features - StringList of features

        /pa/features/hashtaglambda/enabled - TRUE|FALSE
        /pa/features/hashtaglambda/lambda/arn - STRING

        /pa/features/photometataglambda/enabled - TRUE|FALSE
        /pa/features/photometataglambda/lambda/arn - STRING

        /pa/features/rekogntaglambda/enabled - TRUE|FALSE
        /pa/features/rekogntaglambda/lambda/arn - STRING
    
     */

    const featuresAsStrings = props.features.map((feature) => feature.toString())

    new ssm.StringListParameter(this, 'pass-pa-features-stringlist-parameter-id', {
        parameterName: '/pa/features',
        description: 'Listing of all available features and their names',
        stringListValue: featuresAsStrings
    })

    for(const feature of props.features){
        new ssm.StringParameter(this, `pass-pa-feature-${feature.toString()}-enabled-parameter-id`, {
            parameterName: `/pa/features/${feature.toString()}/enabled`,
            description: `Parameter stating whether Feature ${feature.toString()} is Enabled`,
            stringValue: 'TRUE'
        })

        new ssm.StringParameter(this, `pass-pa-feature-${feature.toString()}-lambda-arn-parameter-id`, {
            parameterName: `/pa/features/${feature.toString()}/lambda/arn`,
            description: `Parameter stating Lambda ARN to execute by Dispatcher for Feature ${feature.toString()}`,
            stringValue: props.lambdaMap.get(feature)!!
        })
    }

  }

}
