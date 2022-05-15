import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_lambda as lambda,
  aws_s3 as s3,
} from 'aws-cdk-lib';
import { BucketEventHandler } from './constructs/bucket-event-handler/bucket-event-handler';
import { DispatcherFunction } from './constructs/dispatcher-function/dispatcher-function';
import { RequestBuilderFunction } from './constructs/request-builder-function/request-builder-function';
import { RequestQueue } from './constructs/queues/request-queue/request-queue';
import { HashTagFunction } from './constructs/features/hash-tag-function/hash-tag-function';
import { PhotoMetaTagFunction } from './constructs/features/photo-meta-tag-function/photo-meta-tag-function';
import { BucketTopicEventLinker } from './constructs/bucket-topic-event-linker/bucket-topic-event-linker';
import { Features } from './enums/features';
import { PhotoRekogTagFunction } from './constructs/features/photo-rekog-tag-function/photo-rekog-tag-function';
import { DynamoMetricsTable } from './constructs/dynamo-metrics-table/dynamo-metrics-table';
import { LambdaLayers, LayerTypes } from './constructs/lambda-layers/lambda-layers';
import { TopicSubscribedEventQueue } from './constructs/topic-subscribed-event-queue/topic-subscribed-event-queue';
import { ConfigurationSingletonFactory } from './conf/configuration-singleton-factory';

export interface PhotoArchiveStackProps extends StackProps {
  mainBuckets: Array<s3.IBucket>
}

export class PhotoArchiveStack extends Stack {

   public readonly lambdaMap: Map<Features, string> = new Map()

  constructor(scope: Construct, id: string, props: PhotoArchiveStackProps) {
    super(scope, id, props);

    const settings = ConfigurationSingletonFactory.getConcreteSettings()
    const mainBuckets = props.mainBuckets

    const defaultLambdaTimeout = Duration.minutes(15)

    // =========================
    // DYNAMO DB
    // =========================

    let dynamoMetricsTable: DynamoMetricsTable | undefined = undefined
    if(settings.enableDynamoMetricsTable){
      dynamoMetricsTable = new DynamoMetricsTable(this, "DynamoMetricsTable", {
        lambdaTimeout: defaultLambdaTimeout
      })
    }
        
    // ==========================
    // LAMBDAS + QUEUES
    // ==========================

    const featureLambdas = new Array<lambda.Function>()

    // Bucket -> SNS Topic
    const bucketEventHandler = new BucketEventHandler(this, "MainBucketsEventHandling", {
      buckets: mainBuckets,
      eventTopicName: "pt-pa-topic",
    })
    // SNS Topic - > SQS Queue
    const bucketEventQueue = new TopicSubscribedEventQueue(this, "MainBucketEventsQueue", {
      topic: bucketEventHandler.eventTopic,
      queueName: "pt-pa-event-queue",
      lambdaTimeout: defaultLambdaTimeout
    })

    // RequestBuilderLambda -> RequestQueue
    // FeatureLambda -> RequestQueue
    const requestQueue = new RequestQueue(this, "RequestQueue", {
      dispatcherLambdaTimeout: defaultLambdaTimeout,
      requestQueueName: "pt-pa-request-queue"
    })

    const lambdaLayerHandler = new LambdaLayers(this, 'LambdaLayerHandler', {
      createLayers: [ LayerTypes.COMMONLIBLAYER, LayerTypes.EXIFREADLAYER ]
    })

    const layerFinder = (layerTypes: Array<LayerTypes>) => {
      const layers = new Array<lambda.LayerVersion>()
      for(const layerType of layerTypes){
        const lambdaLayer = lambdaLayerHandler.getLayerOfType(layerType)
        if(lambdaLayer != undefined){
          layers.push(lambdaLayer)
        }
      }
      return layers
    }

    // DispatchLambda -> HashingFunction (FeatureLambda)
    if(settings.features.includes(Features.HASH_TAG)){
      const hashFunction = new HashTagFunction(this, "HashTagFunction", {
        buckets: mainBuckets,
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout,
        onLayerRequestListener: layerFinder,
        dynamoMetricsQueue: dynamoMetricsTable?.dynamoQueue
      })
      this.lambdaMap.set(Features.HASH_TAG, hashFunction.hashTagFunction.functionArn)
      featureLambdas.push(hashFunction.hashTagFunction)
    }
    
    // DispatchLambda -> PhotoMetaFunction (FeatureLambda)
    if(settings.features.includes(Features.PHOTO_META_TAG)){
      const photoMetaTaggerFunction = new PhotoMetaTagFunction(this, "PhotoMetaTagFunction", {
        buckets: mainBuckets,
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout,
        onLayerRequestListener: layerFinder,
        dynamoMetricsQueue: dynamoMetricsTable?.dynamoQueue
      })
      this.lambdaMap.set(Features.PHOTO_META_TAG, photoMetaTaggerFunction.photoMetaFunction.functionArn)
      featureLambdas.push(photoMetaTaggerFunction.photoMetaFunction)
    }

    // DispatchLambda -> RekogFunction (FeatureLambda)
    if(settings.features.includes(Features.PHOTO_REKOG_TAG)){
      const rekogFunction = new PhotoRekogTagFunction(this, "PhotoRekogTagFunction", {
        buckets:mainBuckets,
        requestQueue: requestQueue.requestQueue,
        lambdaTimeout: defaultLambdaTimeout,
        onLayerRequestListener: layerFinder,
        dynamoMetricsQueue: dynamoMetricsTable?.dynamoQueue
      })
      this.lambdaMap.set(Features.PHOTO_REKOG_TAG, rekogFunction.rekogFunction.functionArn)
      featureLambdas.push(rekogFunction.rekogFunction)
    }
    
    // RequestQueue -> DispatcherFunction
    const dispatcherFunction = new DispatcherFunction(this, "DispatcherFunction", {
      featureLambdas: featureLambdas,
      requestQueue: requestQueue.requestQueue,
      lambdaTimeout: defaultLambdaTimeout
    })

    // EventQueue -> ReqestBuilderFunction
    const requestBuilderFunction = new RequestBuilderFunction(this, "RequestBuilderFunction", {
      eventQueue: bucketEventQueue.eventQueue,
      requestQueue: requestQueue.requestQueue,
      lambdaTimeout: defaultLambdaTimeout
    })

    if(settings.enableDynamoMetricsTable){
      dynamoMetricsTable?.setDynamoQueuePolicyToAllowLambdas(featureLambdas)
    }

    // ==========================
    // EVENT LINKING
    // ==========================

    const bucketTopicEventLinker = new BucketTopicEventLinker(this, `BucketTopicEventLinker`, {
      buckets: mainBuckets,
      topic: bucketEventHandler.eventTopic,
      onLayerRequestListener: layerFinder
    })
    bucketTopicEventLinker.node.addDependency(bucketEventHandler)
    

  }

}
