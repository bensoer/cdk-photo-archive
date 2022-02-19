import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_lambda as lambda,
  aws_s3 as s3,
  aws_dynamodb as dynamodb,
} from 'aws-cdk-lib';
import { EventQueue } from './constructs/queues/event-queue/event-queue';
import { DispatcherFunction } from './constructs/dispatcher-function/dispatcher-function';
import { RequestBuilderFunction } from './constructs/request-builder-function/request-builder-function';
import { RequestQueue } from './constructs/queues/request-queue/request-queue';
import { HashTagFunction } from './constructs/features/hash-tag-function/hash-tag-function';
import { PhotoMetaTagFunction } from './constructs/features/photo-meta-tag-function/photo-meta-tag-function';
import { BucketQueueEventLinker } from './constructs/bucket-queue-event-linker/bucket-queue-event-linker';
import { IConfiguration } from './conf/i-configuration';
import { Configuration } from '../conf/configuration';
import { Features } from './enums/features';
import { PhotoRekogTagFunction } from './constructs/features/photo-rekog-tag-function/photo-rekog-tag-function';
import { HashUtil } from './utils/hashutil';
import { DynamoMetricsTable } from './constructs/dynamo-metrics-table/dynamo-metrics-table';

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

    const defaultLambdaTimeout = Duration.minutes(15)

    // =========================
    // DYNAMO DB
    // =========================

    let dynamoMetricsTable: DynamoMetricsTable | undefined = undefined
    const enableDynamoMetricsTable = configuration.enableDynamoMetricsTable ?? false
    if(enableDynamoMetricsTable){
      dynamoMetricsTable = new DynamoMetricsTable(this, "pa-dynamo-metrics-table-id", {
        lambdaTimeout: defaultLambdaTimeout
      })
    }
        
    // ==========================
    // LAMBDAS + QUEUES
    // ==========================

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
      const hashFunction = new HashTagFunction(this, "pa-hash-tag-function-id", {
        buckets: mainBuckets,
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout
      })
      this.lambdaMap.set(Features.HASH_TAG, hashFunction.hashTagFunction.functionArn)
      featureLambdas.push(hashFunction.hashTagFunction)
    }
    
    // DispatchLambda -> PhotoMetaFunction (FeatureLambda)
    if(configuration.features.includes(Features.PHOTO_META_TAG)){
      const photoMetaTaggerFunction = new PhotoMetaTagFunction(this, "pa-photo-meta-tag-function-id", {
        buckets: mainBuckets,
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout
      })
      this.lambdaMap.set(Features.PHOTO_META_TAG, photoMetaTaggerFunction.photoMetaFunction.functionArn)
      featureLambdas.push(photoMetaTaggerFunction.photoMetaFunction)
    }

    // DispatchLambda -> RekogFunction (FeatureLambda)
    if(configuration.features.includes(Features.PHOTO_REKOG_TAG)){
      const rekogFunction = new PhotoRekogTagFunction(this, "pa-photo-rekog-tag-function-id", {
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
