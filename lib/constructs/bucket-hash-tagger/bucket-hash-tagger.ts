import { Bucket } from "aws-cdk-lib/aws-s3";
import { S3 } from "aws-cdk-lib/aws-ses-actions";
import { Construct } from "constructs";
import { Duration, CustomResource} from "aws-cdk-lib";
import { 
    aws_lambda as lambda,
    aws_iam as iam,
    aws_sqs as sqs,
    custom_resources as cr,
    aws_logs as logs,
} from "aws-cdk-lib";
import * as path from 'path';
import { HashingFunction } from "./lib/hashing-function";
import { EventQueue } from "./lib/event-queue";


export interface BucketHashTaggerProps {
    bucket: Bucket
    processingTimeout?: Duration

}

export class BucketHashTagger extends Construct{

    constructor(scope: Construct, id: string, props: BucketHashTaggerProps){
        super(scope, id);

        const processingTimeout = props.processingTimeout ?? Duration.minutes(15)

        // SQS Event Queue and associated policies
        const eventQueue = new EventQueue(this, "bht-event-queue-construct-id", {
          bucket: props.bucket,
          processingTimeout: processingTimeout
        })

        // Hash function and associated policies
        const hashingFunction = new HashingFunction(this, "bht-hashing-function-construct-id", {
          eventQueue: eventQueue.eventQueue,
          processingTimeout: processingTimeout
        })

        const eventLinkingLambdaRole = new iam.Role(this, "bht-event-linking-function-service-role-id", {
            roleName: "bht-event-linking-lambda-service-role",
            description: "Assumed Role By bht-event-linking-function",
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
          })
      
        const eventLinkingLambdaS3Policy = new iam.Policy(this, "bht-event-linking-function-service-role-s3-policy-id", {
          policyName: "bht-event-linking-lambda-s3-policy",
          roles: [
            eventLinkingLambdaRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                's3:PutBucketNotification'
              ],
              resources:[
                props.bucket.bucketArn
              ]
            })
          ]
        })
      
        const eventLinkingLambda = new lambda.Function(this, "bht-event-linking-function-id",{
          functionName: 'bht-event-linking-function',
          description: 'Event Linking For S3 Bucket Events To SQS And To Hashing Function Lambda',
          runtime: lambda.Runtime.PYTHON_3_7,
          handler: 'lambda_function.on_event',
          code: lambda.Code.fromAsset(path.join(__dirname, './res/linking_function.zip')),
          role: eventLinkingLambdaRole,
          timeout: Duration.minutes(15)
        })

        const eventLinkingLambdaLambdaPolicy = new iam.Policy(this, "bht-event-linking-function-service-role-lambda-policy", {
          policyName: "bht-event-linking-lambda-lambda-policy",
          roles:[
            eventLinkingLambdaRole
          ],
          statements:[
            new iam.PolicyStatement({
              actions: [
                'lambda:CreateEventSourceMapping',
                'lambda:ListEventSourceMappings',
                'lambda:DeleteEventSourceMapping'
              ],
              resources:[
                '*'
              ]
            })
          ]
        })

        const eventLinkingCustomResourceProvider = new cr.Provider(this, 'bht-event-linking-custom-resource-provider', {
          onEventHandler: eventLinkingLambda,
          logRetention: logs.RetentionDays.ONE_DAY,
        })
    
        const eventLinkingCustomResource = new CustomResource(this, "bht-event-linking-custom-resource-id", {
          resourceType: "Custom::BHT-EventLinker",
          serviceToken: eventLinkingCustomResourceProvider.serviceToken,
          properties: {
            "bucketArn": props.bucket.bucketArn,
            "bucketName": props.bucket.bucketName,
            "sqsQueueArn": eventQueue.eventQueue.queueArn,
            "lambdaArn": hashingFunction.hashingFunction.functionArn
          }
        })

        eventLinkingCustomResource.node.addDependency(props.bucket)
        eventLinkingCustomResource.node.addDependency(eventQueue)
        eventLinkingCustomResource.node.addDependency(hashingFunction)


    }
}