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

export class PhotoArchiveStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // ==========================
    // BUCKETS
    // ==========================

    const loggingBucket = new s3.Bucket(this, "pt-pa-logging-bucket", {
      bucketName: "pt-photo-archive-logging-us-east-1",
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      
      // temp to make building and destroying easier
      //autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.RETAIN,

      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    })
    
    const mainBucket = new s3.Bucket(this, "pt-pa-main-bucket", {
      bucketName: "pt-photo-archive-us-east-1",
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,

      // temp to make building and destroying easier
      //autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.RETAIN,

      serverAccessLogsBucket: loggingBucket,
      serverAccessLogsPrefix: 'photo-archive-logs',
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      inventories: [
        {
          frequency: s3.InventoryFrequency.WEEKLY,
          includeObjectVersions: s3.InventoryObjectVersion.CURRENT,
          destination: {
            bucket: loggingBucket,
            prefix: 'photo-archive-inventory'
          }
        }
      ],
      lifecycleRules: [
        {
          enabled: true,
          id: 'pa-archive-scheduling',
          transitions:[
            {
              storageClass: s3.StorageClass.INFREQUENT_ACCESS,
              transitionAfter: Duration.days(90)
            },
            {
              storageClass: s3.StorageClass.GLACIER,
              transitionAfter: Duration.days(120)
            }
          ]
        }
      ],
    })

    // ==========================
    // LAMBDAS + QUEUES
    // ==========================

    const defaultLambdaTimeout = Duration.minutes(15)

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
    const hashFunction = new HashingFunction(this, "pt-pa-hash-function-id", {
      buckets: [
        mainBucket
      ],
      requestQueue: requestQueue.requestQueue,
      lambdaTimeout: defaultLambdaTimeout
    })

    // DispatchLambda -> PhotoMetaFunction (FeatureLambda)
    const photoMetaTaggerFunction = new PhotoMetaFunction(this, "pt-pa-photo-meta-function-id", {
      buckets:[
        mainBucket
      ],
      requestQueue: requestQueue.requestQueue,
      lambdaTimeout: defaultLambdaTimeout
    })

    // RequestQueue -> DispatcherFunction
    const dispatcherFunction = new DispatcherFunction(this, "pt-pa-dispatcher-function-id", {
      featureLambdas: [
        hashFunction.hashingFunction,
        photoMetaTaggerFunction.photoMetaFunction
      ],
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
