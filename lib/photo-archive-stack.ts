import { Duration, Stack, StackProps, Tags, Token, CfnParameter } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DispatcherFunction } from './constructs/dispatcher-function/dispatcher-function';
import { RequestBuilderFunction } from './constructs/request-builder-function/request-builder-function';
import { RequestQueue } from './constructs/queues/request-queue/request-queue';
import { ConfigurationSingletonFactory } from './conf/configuration-singleton-factory';
import { PhotoArchiveDynamoStack } from './photo-archive-dynamo-stack';
import { PhotoArchiveSettingsStack } from './photo-archive-settings-stack';
import { PhotoArchiveBucketsStack } from './photo-archive-buckets-stack';
import { PhotoArchiveFeatureStack } from './photo-archive-feature-stack';
import { PhotoArchiveLambdaLayerStack } from './photo-archive-lambda-layer-stack';

export interface PhotoArchiveStackProps extends StackProps {

}

export class PhotoArchiveStack extends Stack {

  constructor(scope: Construct, id: string, props: PhotoArchiveStackProps) {
    super(scope, id, props);

    const settings = ConfigurationSingletonFactory.getConcreteSettings()
    const defaultLambdaTimeout = Duration.minutes(15)

    
    

    // ========================
    // Lambda Layers
    // ========================

    // PhotoArchiveLambdaLayerStack
    const photoArchiveLambdaLayerStack = new PhotoArchiveLambdaLayerStack(this, 'PhotoArchiveLambdaLayerStack', {
      
    })
    Tags.of(photoArchiveLambdaLayerStack).add('SubStackName', photoArchiveLambdaLayerStack.stackName)
    const layerFinder = photoArchiveLambdaLayerStack.layerFinder

    // =========================
    // S3 BUCKETS + EVENT HANDLING
    // =========================

    // PhotoArchiveBucketNestedStack
    const photoArchiveBucketsNestedStack = new PhotoArchiveBucketsStack(this, 'PhotoArchiveBucketsStack', {
      lambdaTimeout: defaultLambdaTimeout,
      onLayerRequestListener: layerFinder
    })
    Tags.of(photoArchiveBucketsNestedStack).add('SubStackName', photoArchiveBucketsNestedStack.stackName)
    const mainBuckets = photoArchiveBucketsNestedStack.mainBuckets
    const bucketEventQueue = photoArchiveBucketsNestedStack.bucketEventQueue

    // =========================
    // DYNAMO DB
    // =========================

    let photoArchiveDynamoStack: PhotoArchiveDynamoStack | undefined = undefined
    if(settings.enableDynamoMetricsTable){
      photoArchiveDynamoStack = new PhotoArchiveDynamoStack(this, 'PhotoArchiveDynamoStack', {
        lambdaTimeout: defaultLambdaTimeout
      })

      Tags.of(photoArchiveDynamoStack).add('SubStackName', photoArchiveDynamoStack.stackName)
    }
        
    // ==========================
    // LAMBDAS + QUEUES
    // ==========================

    
    // RequestBuilderLambda -> RequestQueue
    // FeatureLambda -> RequestQueue
    const requestQueue = new RequestQueue(this, "RequestQueue", {
      dispatcherLambdaTimeout: defaultLambdaTimeout,
      requestQueueName: `${settings.namePrefix}-request-queue`
    })

    // PhotoArchiveFeatureStack
    const photoArchiveFeatureStack = new PhotoArchiveFeatureStack(this, 'PhotoArchiveFeatureStack', {
      mainBuckets: mainBuckets,
      lambdaTimeout: defaultLambdaTimeout,
      requestQueue: requestQueue.requestQueue,
      dynamoQueue: photoArchiveDynamoStack?.dynamoQueue,
      onLayerRequestListener: layerFinder,
    })
    Tags.of(photoArchiveFeatureStack).add('SubStackName', photoArchiveFeatureStack.stackName)
    const featureLambdas = photoArchiveFeatureStack.featureLambdas
    const lambdaMap = photoArchiveFeatureStack.lambdaMap

    // EventQueue -> ReqestBuilderFunction
    const requestBuilderFunction = new RequestBuilderFunction(this, "RequestBuilderFunction", {
      eventQueue: bucketEventQueue,
      requestQueue: requestQueue.requestQueue,
      lambdaTimeout: defaultLambdaTimeout,
      namePrefix: settings.namePrefix
    })

    if(settings.enableDynamoMetricsTable){
      photoArchiveDynamoStack?.setDynamoQueuePolicyToAllowLambdas(featureLambdas)
      photoArchiveDynamoStack?.node.addDependency(photoArchiveFeatureStack)
    }

    // ==========================
    // Settings
    // ==========================
    
    // PhotoArchiveSettingsStack
    /**const photoArchiveSettingsStack = new PhotoArchiveSettingsStack(this, 'PhotoArchiveSettingsStack', {
      features: settings.features,
      lambdaMap: lambdaMap
    })
    Tags.of(photoArchiveFeatureStack).add('SubStackName', photoArchiveSettingsStack.stackName)
    photoArchiveSettingsStack.node.addDependency(photoArchiveFeatureStack)**/



  }

}
