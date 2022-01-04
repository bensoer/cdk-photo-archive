import { Construct } from "constructs";

import {
    aws_iam as iam,
    aws_lambda as lambda,
    aws_logs as logs,
    custom_resources as cr,
    aws_s3 as s3,
    aws_sqs as sqs,
    hashMapper
} from "aws-cdk-lib"
import {
    Duration,
    CustomResource
} from "aws-cdk-lib"
import * as path from 'path'
import * as crypto from 'crypto'
import { ServicePrincipals } from "cdk-constants";



export interface BucketQueueEventLinkerProps {
    bucket: s3.Bucket
    queue: sqs.Queue
}

export class BucketQueueEventLinker extends Construct{

    constructor(scope: Construct, id: string, props: BucketQueueEventLinkerProps){
        super(scope, id)


        const eventLinkingLambdaRole = new iam.Role(this, "bqel-function-service-role-id", {
            roleName: "bqel-lambda-service-role",
            description: "Assumed Role By bqel-event-linking-function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        const eventLinkingLambdaS3Policy = new iam.Policy(this, "bqel-function-service-role-s3-policy-id", {
          policyName: "bqel-lambda-s3-policy",
          roles: [
            eventLinkingLambdaRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                's3:PutBucketNotification'
              ],
              resources: [
                  props.bucket.bucketArn
              ]
            })
          ]
        })
      
        const eventLinkingLambda = new lambda.Function(this, "bqel-function-id",{
          functionName: 'bqel-function',
          description: 'Event Linking For S3 Bucket Events To SQS',
          runtime: lambda.Runtime.PYTHON_3_7,
          handler: 'lambda_function.on_event',
          code: lambda.Code.fromAsset(path.join(__dirname, './res')),
          role: eventLinkingLambdaRole,
          timeout: Duration.minutes(15)
        })


        const eventLinkingCustomResourceProvider = new cr.Provider(this, 'bqel-custom-resource-provider-id', {
          onEventHandler: eventLinkingLambda,
          logRetention: logs.RetentionDays.ONE_DAY,
        })

        const crHash = crypto.createHash('sha256')
        crHash.update(props.bucket.bucketArn + props.bucket.bucketName + props.queue.queueArn)
        const hash = crHash.digest('base64')
        const alphanumericHash = hash.replace(/\W/g, '')
        const crCode = alphanumericHash.substr(0, 15)
        const eventLinkingCustomResource = new CustomResource(this, `el-custom-resource-${crCode}-id`, {
            resourceType: `Custom::BucketQueue-EventLinker-${crCode}`,
            serviceToken: eventLinkingCustomResourceProvider.serviceToken,
            properties: {
                "bucketArn": props.bucket.bucketArn,
                "bucketName": props.bucket.bucketName,
                "queueArn": props.queue.queueArn,
            }
        })

        eventLinkingCustomResource.node.addDependency(props.bucket)
        eventLinkingCustomResource.node.addDependency(props.queue)
        
    }
}
