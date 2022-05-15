import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_s3 as s3, 
} from 'aws-cdk-lib';

import { PhotoArchiveBuckets } from './constructs/photo-archive-buckets/photo-archive-buckets';
import { Configuration } from '../conf/configuration';
import { ConfigurationSingletonFactory } from './conf/configuration-singleton-factory';

export interface PhotoArchiveBucketsStackProps extends StackProps {

}

export class PhotoArchiveBucketsStack extends Stack {

    public readonly mainBuckets: Array<s3.IBucket>

  constructor(scope: Construct, id: string, props: PhotoArchiveBucketsStackProps) {
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

  }

}
