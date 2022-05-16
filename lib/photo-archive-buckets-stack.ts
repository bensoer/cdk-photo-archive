import { Duration, NestedStack, NestedStackProps, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_s3 as s3, 
  aws_sqs as sqs,
  aws_lambda as lambda,
} from 'aws-cdk-lib';

import { PhotoArchiveBuckets } from './constructs/photo-archive-buckets/photo-archive-buckets';
import { Configuration } from '../conf/configuration';
import { ConfigurationSingletonFactory } from './conf/configuration-singleton-factory';
import { BucketEventHandler } from './constructs/bucket-event-handler/bucket-event-handler';
import { TopicSubscribedEventQueue } from './constructs/topic-subscribed-event-queue/topic-subscribed-event-queue';
import { BucketTopicEventLinker } from './constructs/bucket-topic-event-linker/bucket-topic-event-linker';
import { LayerTypes } from './constructs/lambda-layers/lambda-layers';

export interface PhotoArchiveBucketsNestedStackProps extends NestedStackProps {
  lambdaTimeout: Duration,
  onLayerRequestListener: (layerTypes: Array<LayerTypes>) => Array<lambda.LayerVersion>
}

export class PhotoArchiveBucketsStack extends NestedStack {

  public readonly mainBuckets: Array<s3.IBucket>
  public readonly bucketEventQueue: sqs.Queue

  constructor(scope: Construct, id: string, props: PhotoArchiveBucketsNestedStackProps) {
    super(scope, id, props);

    const settings = ConfigurationSingletonFactory.getConcreteSettings()
    

    // ==========================
    // BUCKETS
    // ==========================

    const photoArchiveBuckets = new PhotoArchiveBuckets(this, "PhotoArchiveBuckets", {
        createBucketsWithPrefix: settings.bucketNamePrefix,

        // if we are importing buckets, then give the list of ARNs of buckets to import
        bucketsToImport: settings.useExistingBuckets,
        
        // transition settings
        switchToInfrequentAccessTierAfterDays: settings.switchToInfrequentAccessTierAfterDays,
        switchToGlacierAccessTierAfterDays: settings.switchToGlacierAccessTierAfterDays,

        appendRegionToBucketName: settings.appendRegionToBucketName,

        applyInventoryToMainBuckets: settings.enableInventoryOfArchiveBuckets,
        applyLoggingToMainBuckets: settings.enableLoggingOfArchiveBuckets,
        applyTransitionsToMainBuckets: settings.applyTransitionsToMainBuckets

        
    })
    this.mainBuckets = photoArchiveBuckets.mainBuckets

    // Bucket -> SNS Topic
    const bucketEventHandler = new BucketEventHandler(this, "MainBucketsEventHandling", {
      buckets: this.mainBuckets,
      eventTopicName: "pt-pa-topic",
    })
    // SNS Topic - > SQS Queue
    const bucketEventQueue = new TopicSubscribedEventQueue(this, "MainBucketEventsQueue", {
      topic: bucketEventHandler.eventTopic,
      queueName: "pt-pa-event-queue",
      lambdaTimeout: props.lambdaTimeout
    })
    this.bucketEventQueue = bucketEventQueue.eventQueue

    // Bucket -> SNS Linking
    const bucketTopicEventLinker = new BucketTopicEventLinker(this, `BucketTopicEventLinker`, {
      buckets: this.mainBuckets,
      topic: bucketEventHandler.eventTopic,
      onLayerRequestListener: props.onLayerRequestListener
    })
    bucketTopicEventLinker.node.addDependency(bucketEventHandler)

  }

}
