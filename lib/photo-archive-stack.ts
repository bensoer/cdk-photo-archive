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

export class PhotoArchiveStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

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

    const bht = new BucketHashTagger(this, "bucket-hash-tagger-construct-id", {
      buckets: new Map<String, s3.Bucket>(
       [
         [
           "pt-photo-archive-us-east-1",
           mainBucket
         ]
       ] 
      ),
      lambdaTimeout: Duration.minutes(15)
    })

  }

}
