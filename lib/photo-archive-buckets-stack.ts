import { CfnElement, Duration, NestedStack, NestedStackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_s3 as s3, 
  aws_sqs as sqs,
  aws_sns as sns,
  aws_s3_notifications as s3n
} from 'aws-cdk-lib';

import { BucketNames, PhotoArchiveBuckets } from './constructs/photo-archive-buckets/photo-archive-buckets';
import { ConfigurationSingletonFactory } from './conf/configuration-singleton-factory';
import { SqsSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { CPANestedStack } from './constructs/cpa-nested-stack';

export interface PhotoArchiveBucketsNestedStackProps extends NestedStackProps {
  lambdaTimeout: Duration,
}

export class PhotoArchiveBucketsStack extends CPANestedStack {

  public readonly mainBucketNames: BucketNames
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
    this.mainBucketNames = photoArchiveBuckets.bucketNames

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
    for(const mainBucket of this.mainBucketNames.mainBucketNames){
      const bucket = s3.Bucket.fromBucketName(this, `import-${mainBucket}`, mainBucket)
      bucket.addEventNotification(s3.EventType.OBJECT_CREATED, new s3n.SnsDestination(topic))
    }

  }

}
