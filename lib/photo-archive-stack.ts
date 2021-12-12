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

export class PhotoArchiveStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const loggingBucket = new s3.Bucket(this, "pt-pa-logging-bucket", {
      bucketName: "pt-photo-archive-logging-us-east-1",
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      
      // temp to make building and destroying easier
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,

      publicReadAccess: false,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
    })
    
    const mainBucket = new s3.Bucket(this, "pt-pa-main-bucket", {
      bucketName: "pt-photo-archive-us-east-1",
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      
      // temp to make building and destroying easier
      autoDeleteObjects: true,
      removalPolicy: RemovalPolicy.DESTROY,

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

    const bucketEventsQueue = new sqs.Queue(this, "pa-event-queue", {
      queueName: "photo-archive-event-queue",
      encryption: sqs.QueueEncryption.KMS_MANAGED
    })

    /*const bucketEventsQueuePolicy = new sqs.QueuePolicy(this, "pa-event-queue-policy",{
      queues: [ bucketEventsQueue ],
    })

    bucketEventsQueuePolicy.document.addStatements(new iam.PolicyStatement({
      principals:[
        new iam.ServicePrincipal("s3.amazonaws.com")
      ],
      actions:[
        "SQS:SendMessage"
      ],
      resources:[
        mainBucket.bucketArn
      ]
    }))*/
   
    const hashingFunction = new lambda.Function(this, "pa-hashing-function", {
      functionName: 'photo-archive-hashing-function',
      description: 'Hashing Function. Tagging resources within photo-archive buckets with MD5, SHA1, SHA256 and SHA512 hashes',
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../res/hash_function.zip')),
    })

    //hashingFunction.addEventSource()


    const eventLinkingLambdaRole = new iam.Role(this, "pa-event-linking-function-service-role", {
      roleName: "pa-event-linking-lambda-service-role",
      description: "Assumed Role By photo-archive-event-linking-function",
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })

    const eventLinkingLambdaProviderRole = new iam.Role(this, "pa-event-linking-function-provider-service-role", {
      roleName: "pa-event-linking-lambda-provider-service-role",
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com")
    })

    const eventLinkingLambdaS3Policy = new iam.Policy(this, "pa-event-linking-function-service-role-s3-policy", {
      policyName: "pa-event-linking-lambda-s3-policy",
      roles: [
        eventLinkingLambdaRole,
        eventLinkingLambdaProviderRole
      ],
      statements: [
        new iam.PolicyStatement({
          actions:[
            's3:PutBucketNotificationConfiguration'
          ],
          resources:[
            '*'
          ]
        })
      ]
    })

    const eventLinkingLambdaLambdaPolicy = new iam.Policy(this, "pa-event-linking-function-service-role-lambda-policy", {
      policyName: "pa-event-linking-lambda-lambda-policy",
      roles:[
        eventLinkingLambdaRole,
        eventLinkingLambdaProviderRole
      ],
      statements:[
        new iam.PolicyStatement({
          actions: [
            'lambda:CreateEventSourceMapping',
            'lambda:ListEventSourceMapping',
            'lambda:DeleteEventSourceMapping'
          ],
          resources:[
            hashingFunction.functionArn
          ]
        })
      ]
    })

    const allowEverythingPolicy = new iam.Policy(this, "allow-everything-policy", {
      policyName: "allow-everything-policy",
      roles:[
        eventLinkingLambdaRole,
        eventLinkingLambdaProviderRole
      ],
      statements: [
        new iam.PolicyStatement({
          actions:[
            '*'
          ],
          resources:[
            '*'
          ]
        })
      ]
    })

    const eventLinkingLambda = new lambda.Function(this, "pa-event-linking-function",{
      functionName: 'photo-archive-event-linking-function',
      description: 'Event Linking For S3 Bucket Events To SQS And To Hashing Function Lambda',
      runtime: lambda.Runtime.PYTHON_3_7,
      handler: 'lambda_function.on_event',
      code: lambda.Code.fromAsset(path.join(__dirname, '../res/linking_function.zip')),
      role: eventLinkingLambdaRole,
    })

    /*const customResourceProviderRole = new iam.Role(this, "pa-event-linking-custom-resource-provider-role", {
      roleName: 'pa-event-linking-custom-resource-provider-role',
      description: 'Assumed Role by CustomResourceProvider',
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
    })*/

    const eventLinkingCustomResourceProvider = new cr.Provider(this, 'pa-event-linking-custom-resource-provider', {
      onEventHandler: eventLinkingLambda,
      logRetention: logs.RetentionDays.ONE_DAY,
      role: eventLinkingLambdaProviderRole
    })

    const mainBucketLinking = new CustomResource(this, "pa-main-bucket-event-linking-custom-resource", {
      serviceToken: eventLinkingCustomResourceProvider.serviceToken,
      properties: {
        "bucketArn": mainBucket.bucketArn,
        "bucketName": mainBucket.bucketName,
        "snsQueueArn": bucketEventsQueue.queueArn,
        "lambdaArn": hashingFunction.functionArn
      }
    })

    /*const loggingBucketLinking = new CustomResource(this, "pa-logging-bucket-event-linking-custom-resource", {
      serviceToken: eventLinkingCustomResourceProvider.serviceToken,
      properties: {
        "bucketArn": loggingBucket.bucketArn,
        "bucketName": loggingBucket.bucketName,
        "snsQueueArn": bucketEventsQueue.queueArn,
        "lambdaArn": hashingFunction.functionArn
      }
    })*/

    mainBucketLinking.node.addDependency(mainBucket)
    mainBucketLinking.node.addDependency(bucketEventsQueue)
    mainBucketLinking.node.addDependency(hashingFunction)

    /*
    loggingBucketLinking.node.addDependency(loggingBucket)
    loggingBucketLinking.node.addDependency(bucketEventsQueue)
    loggingBucketLinking.node.addDependency(hashingFunction)
    */

  }

}
