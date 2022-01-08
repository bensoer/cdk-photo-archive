import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_s3 as s3, 
} from 'aws-cdk-lib';

import { PhotoArchiveBuckets } from './constructs/photo-archive-buckets/photo-archive-buckets';
import { Configuration } from '../conf/configuration';

export interface PhotoArchiveBucketsStackProps extends StackProps {
    configuration: Configuration
}

export class PhotoArchiveBucketsStack extends Stack {

    public readonly mainBuckets: Array<s3.IBucket>

  constructor(scope: Construct, id: string, props: PhotoArchiveBucketsStackProps) {
    super(scope, id, props);

    const configuration = props.configuration.getConfiguration()

    // ==========================
    // BUCKETS
    // ==========================

    const photoArchiveBuckets = new PhotoArchiveBuckets(this, "pabs-pa-photo-archive-buckets-id", {
        // whether or not to create or import the buckets
        createBuckets: !props.configuration.isExistingBuckets(),
        createBucketsWithPrefix: configuration.bucketNamePrefix,
        // if we are importing buckets, then give the list of ARNs of buckets to import
        bucketsToImport: configuration.useExistingBuckets,
        
        // transition settings
        defaultInfrequentAccessTransitionDuration: Duration.days(90),
        defaultGlacierAccessTransitionDuration: Duration.days(120),

        switchToInfrequentAccessTierAfterDays: configuration.switchToInfrequentAccessTierAfterDays,
        switchToGlacierAccessTierAfterDays: configuration.switchToGlacierAccessTierAfterDays,

        appendRegionToBucketName: configuration.appendRegionToBucketName ?? true
    })
      
    this.mainBuckets = photoArchiveBuckets.mainBuckets

  }

}
