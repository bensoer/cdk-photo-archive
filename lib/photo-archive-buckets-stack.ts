import { Duration, NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_s3 as s3, 
  aws_sqs as sqs,
  aws_sns as sns,
  aws_lambda as lambda,
  aws_s3_notifications as s3n
} from 'aws-cdk-lib';

import { PhotoArchiveBuckets } from './constructs/photo-archive-buckets/photo-archive-buckets';
import { ConfigurationSingletonFactory } from './conf/configuration-singleton-factory';
import { LayerTypes } from './constructs/lambda-layers/lambda-layers';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';

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

    // Topic for bucket events
    const topic = new sns.Topic(this, `${settings.namePrefix}-pa-topic`, {
        topicName: `${settings.namePrefix}-pa-topic`,
        displayName: 'BucketEventHandlerTopic'
    })

    // Queue for events from the Topic
    this.bucketEventQueue = new sqs.Queue(this, `${settings.namePrefix}-pa-event-queue`, {
        encryption: sqs.QueueEncryption.UNENCRYPTED,
        visibilityTimeout: Duration.minutes(props.lambdaTimeout.toMinutes() * 6)
    })
    topic.addSubscription(new SqsSubscription(this.bucketEventQueue))

    // Setup the notifications to go to the topic now
    for(const mainBucket of this.mainBuckets){
      mainBucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SnsDestination(topic))
    }

    /*
    // Bucket -> SNS Topic
    const bucketEventHandler = new BucketEventHandler(this, "MainBucketsEventHandling", {
      buckets: this.mainBuckets,
      eventTopicName: `${settings.namePrefix}-pa-topic`,
    })
    // SNS Topic - > SQS Queue
    const bucketEventQueue = new TopicSubscribedEventQueue(this, "MainBucketEventsQueue", {
      topic: bucketEventHandler.eventTopic,
      queueName: `${settings.namePrefix}-pa-event-queue`,
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
    */

  }

}
