import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_lambda as lambda,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { EventQueue } from './constructs/event-queue/event-queue';
import { DispatcherFunction } from './constructs/dispatcher-function/dispatcher-function';
import { RequestBuilderFunction } from './constructs/request-builder-function/request-builder-function';
import { RequestQueue } from './constructs/request-queue/request-queue';
import { HashingFunction } from './constructs/hash-function/hashing-function';
import { PhotoMetaFunction } from './constructs/photo-meta-function/photo-meta-function';
import { BucketQueueEventLinker } from './constructs/bucket-queue-event-linker/bucket-queue-event-linker';
import { IConfiguration } from './conf/i-configuration';
import { Configuration } from '../conf/configuration';
import { Features } from './enums/features';
import { RekogFunction } from './constructs/rekog-function/rekog-function';
import { HashUtil } from './utils/hashutil';

export interface PhotoArchiveStackProps extends StackProps {
  configuration: Configuration
  mainBuckets: Array<s3.IBucket>
}

export class PhotoArchiveStack extends Stack {

   public readonly lambdaMap: Map<Features, string> = new Map()

  constructor(scope: Construct, id: string, props: PhotoArchiveStackProps) {
    super(scope, id, props);

    const configuration: IConfiguration = props.configuration.getConfiguration()
    const mainBuckets = props.mainBuckets
    
    // ==========================
    // LAMBDAS + QUEUES
    // ==========================

    const defaultLambdaTimeout = Duration.minutes(15)
    const featureLambdas = new Array<lambda.Function>()

    // Bucket -> EventQueue
    const eventQueue = new EventQueue(this, "pa-event-queue-id", {
      buckets: mainBuckets,
      eventQueueName: "pt-pa-event-queue",
      lambdaTimeout: defaultLambdaTimeout
    })

    // RequestBuilderLambda -> RequestQueue
    // FeatureLambda -> RequestQueue
    const requestQueue = new RequestQueue(this, "pa-request-queue-id", {
      dispatcherLambdaTimeout: defaultLambdaTimeout,
      requestQueueName: "pt-pa-request-queue"
    })

    // DispatchLambda -> HashingFunction (FeatureLambda)
    if(configuration.features.includes(Features.HASH_TAG)){
      const hashFunction = new HashingFunction(this, "pa-hash-function-id", {
        buckets: mainBuckets,
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout
      })
      this.lambdaMap.set(Features.HASH_TAG, hashFunction.hashingFunction.functionArn)
      featureLambdas.push(hashFunction.hashingFunction)
    }
    
    // DispatchLambda -> PhotoMetaFunction (FeatureLambda)
    if(configuration.features.includes(Features.PHOTO_META_TAG)){
      const photoMetaTaggerFunction = new PhotoMetaFunction(this, "pa-photo-meta-function-id", {
        buckets: mainBuckets,
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout
      })
      this.lambdaMap.set(Features.PHOTO_META_TAG, photoMetaTaggerFunction.photoMetaFunction.functionArn)
      featureLambdas.push(photoMetaTaggerFunction.photoMetaFunction)
    }

    // DispatchLambda -> RekogFunction (FeatureLambda)
    if(configuration.features.includes(Features.PHOTO_REKOG_TAG)){
      const rekogFunction = new RekogFunction(this, "pa-rekog-function-id", {
        buckets:mainBuckets,
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout
      })
      this.lambdaMap.set(Features.PHOTO_REKOG_TAG, rekogFunction.rekogFunction.functionArn)
      featureLambdas.push(rekogFunction.rekogFunction)
    }
    
    // RequestQueue -> DispatcherFunction
    const dispatcherFunction = new DispatcherFunction(this, "pa-dispatcher-function-id", {
      featureLambdas: featureLambdas,
      requestQueue: requestQueue.requestQueue,
      lambdaTimeout: defaultLambdaTimeout
    })

    // EventQueue -> ReqestBuilderFunction
    const requestBuilderFunction = new RequestBuilderFunction(this, "pa-request-builder-function-id", {
      eventQueue: eventQueue.eventQueue,
      requestQueue: requestQueue.requestQueue,
      lambdaTimeout: defaultLambdaTimeout
    })

    // ==========================
    // EVENT LINKING
    // ==========================

    for(const mainBucket of mainBuckets){
      const hash = HashUtil.generateIDSafeHash(mainBucket.bucketArn + mainBucket.bucketName + eventQueue.eventQueue.queueArn, 15)
      const bucketQueueEventLinker = new BucketQueueEventLinker(this, `pa-bucket-queue-event-linker-${hash}-id`, {
        bucket: mainBucket,
        queue: eventQueue.eventQueue
      })
    }

  }

}
