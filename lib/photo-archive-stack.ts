import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as path from 'path';
import { 
  aws_s3 as s3, 
  aws_sqs as sqs, 
  aws_s3_notifications as s3n,
  aws_lambda as lambda,
  aws_lambda_event_sources as lambda_event_sources
} from 'aws-cdk-lib';

export class PhotoArchiveStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const bucketEventsQueue = new sqs.Queue(this, "pt-pa-event-queue", {
      queueName: "photo-archive-event-queue",
      encryption: sqs.QueueEncryption.KMS_MANAGED
    })

    const loggingBucket = new s3.Bucket(this, "pt-pa-logging-bucket", {
      bucketName: "pt-photo-archive-logging-us-east-1",
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      autoDeleteObjects: false,
      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    })
    
    const mainBucket = new s3.Bucket(this, "pt-pa-main-bucket", {
      bucketName: "pt-photo-archive-us-east-1",
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
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
      autoDeleteObjects: false
    })
   
    const hashingFunction = new lambda.Function(this, "pa-hashing-function", {
      functionName: 'photo-archive-hashing-function',
      description: 'Hashing Function. Tagging resources within photo-archive buckets with MD5, SHA1, SHA256 and SHA512 hashes',
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../res/lambda_function.zip')),
    })

    mainBucket.addObjectCreatedNotification(new s3n.SqsDestination(bucketEventsQueue))
    loggingBucket.addObjectCreatedNotification(new s3n.SqsDestination(bucketEventsQueue))
    hashingFunction.addEventSource(new lambda_event_sources.SqsEventSource(bucketEventsQueue))

  }

}
