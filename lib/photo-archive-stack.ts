import { Duration, FeatureFlags, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
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
import { IConfiguration } from './conf/i-configuration';
import { Configuration } from '../conf/configuration';
import { PhotoArchiveBuckets } from './constructs/photo-archive-buckets/photo-archive-buckets';
import { Features } from './enums/features';

export interface PhotoArchiveStackProps extends StackProps {
  configuration: Configuration
}

export class PhotoArchiveStack extends Stack {

   public readonly lambdaMap: Map<Features, string> = new Map()

  constructor(scope: Construct, id: string, props: PhotoArchiveStackProps) {
    super(scope, id, props);

    const configuration: IConfiguration = props.configuration.getConfiguration()

    // ==========================
    // BUCKETS
    // ==========================

    const photoArchiveBuckets = new PhotoArchiveBuckets(this, "pt-pa-photo-archive-buckets-id", {
      // whether or not to create or import the buckets
      createBuckets: !props.configuration.isExistingBuckets(),
      createBucketsWithPrefix: configuration.bucketNamePrefix,
      // if we are importing buckets, then give the list of ARNs of buckets to import
      bucketsToImport: configuration.useExistingBuckets,
      
      // transition settings
      defaultInfrequentAccessTransitionDuration: Duration.days(90),
      defaultGlacierAccessTransitionDuration: Duration.days(120),

      switchToInfrequentAccessTierAfterDays: configuration.switchToInfrequentAccessTierAfterDays,
      switchToGlacierAccessTierAfterDays: configuration.switchToGlacierAccessTierAfterDays
    })
    const mainBucket = photoArchiveBuckets.mainBucket


    // ==========================
    // LAMBDAS + QUEUES
    // ==========================

    const defaultLambdaTimeout = Duration.minutes(15)
    const featureLambdas = new Array<lambda.Function>()

    // Bucket -> EventQueue
    const eventQueue = new EventQueue(this, "pt-pa-event-queue-id", {
      buckets: [
        mainBucket
      ],
      eventQueueName: "pt-pa-event-queue",
      lambdaTimeout: defaultLambdaTimeout
    })

    // RequestBuilderLambda -> RequestQueue
    // FeatureLambda -> RequestQueue
    const requestQueue = new RequestQueue(this, "pt-pa-request-queue-id", {
      dispatcherLambdaTimeout: defaultLambdaTimeout,
      requestQueueName: "pt-pa-request-queue"
    })

    // DispatchLambda -> HashingFunction (FeatureLambda)
    if(configuration.features.includes(Features.HASH_TAG)){
      const hashFunction = new HashingFunction(this, "pt-pa-hash-function-id", {
        buckets: [
          mainBucket
        ],
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout
      })
      this.lambdaMap.set(Features.HASH_TAG, hashFunction.hashingFunction.functionArn)
      featureLambdas.push(hashFunction.hashingFunction)
    }
    
    // DispatchLambda -> PhotoMetaFunction (FeatureLambda)
    if(configuration.features.includes(Features.PHOTO_META_TAG)){
      const photoMetaTaggerFunction = new PhotoMetaFunction(this, "pt-pa-photo-meta-function-id", {
        buckets:[
          mainBucket
        ],
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout
      })
      this.lambdaMap.set(Features.PHOTO_META_TAG, photoMetaTaggerFunction.photoMetaFunction.functionArn)
      featureLambdas.push(photoMetaTaggerFunction.photoMetaFunction)
    }
    
    // RequestQueue -> DispatcherFunction
    const dispatcherFunction = new DispatcherFunction(this, "pt-pa-dispatcher-function-id", {
      featureLambdas: featureLambdas,
      requestQueue: requestQueue.requestQueue,
      lambdaTimeout: defaultLambdaTimeout
    })

    // EventQueue -> ReqestBuilderFunction
    const requestBuilderFunction = new RequestBuilderFunction(this, "pt-pa-request-builder-function-id", {
      eventQueue: eventQueue.eventQueue,
      requestQueue: requestQueue.requestQueue,
      lambdaTimeout: defaultLambdaTimeout,
      region: this.region,
      account: this.account
    })

    // ==========================
    // EVENT LINKING
    // ==========================
    
    const bucketQueueEventLinker = new BucketQueueEventLinker(this, "pt-pa-bucket-queue-event-linker-id", {
      bucket: mainBucket,
      queue: eventQueue.eventQueue
    })

    /**
    const bht = new BucketHashTagger(this, "pt-pa-bucket-hash-tagger-construct-id", {
      region: this.region,
      account: this.account,
      buckets: new Map<string, s3.Bucket>(
       [
         [
           "pt-photo-archive-us-east-1",
           mainBucket
         ]
       ] 
      ),
      lambdaTimeout: Duration.minutes(15),
      createEventLinking: false
    })

    const pmt = new PhotoMetaTagger(this, "pt-pa-photo-meta-tagger-construct-id", {
      region: this.region,
      account: this.account,
      buckets: new Map<string, s3.Bucket>(
        [
          [
            "pt-photo-archive-us-east-1",
            mainBucket
          ]
        ] 
       ),
       lambdaTimeout: Duration.minutes(15),
       createEventLinking: false
    })

    const eventLinkingConfigurations = pmt.linkingConfiguration.concat(bht.linkingConfiguration)
    const eventLinker = new EventLinker(this, "pt-pa-event-linker-construct-id", {
      linkingConfigurations: eventLinkingConfigurations
    })

    **/

  }

}
