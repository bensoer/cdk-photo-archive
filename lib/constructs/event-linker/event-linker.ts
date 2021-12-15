import { Construct } from "constructs";

import {
    aws_iam as iam,
    aws_lambda as lambda,
    aws_logs as logs,
    custom_resources as cr,
    aws_s3 as s3,
    aws_sqs as sqs
} from "aws-cdk-lib"
import {
    Duration,
    CustomResource
} from "aws-cdk-lib"
import * as path from 'path'

export interface LinkingConfiguration {
    bucket:s3.Bucket
    bucketName:string
    sqsQueue: sqs.Queue
    lambda: lambda.Function
}

export interface EventLinkerProps {
    linkingConfigurations: Array<LinkingConfiguration>
}

export class EventLinker extends Construct{

    constructor(scope: Construct, id: string, props: EventLinkerProps){
        super(scope, id)

        const bucketArns = props.linkingConfigurations.map((lc) => lc.bucket.bucketArn)


        const eventLinkingLambdaRole = new iam.Role(this, "el-function-service-role-id", {
            roleName: "el-lambda-service-role",
            description: "Assumed Role By bht-event-linking-function",
            assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com')
          })

        const eventLinkingLambdaS3Policy = new iam.Policy(this, "el-function-service-role-s3-policy-id", {
          policyName: "el-lambda-s3-policy",
          roles: [
            eventLinkingLambdaRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                's3:PutBucketNotification'
              ],
              resources: bucketArns
            })
          ]
        })
      
        const eventLinkingLambda = new lambda.Function(this, "el-function-id",{
          functionName: 'el-function',
          description: 'Event Linking For S3 Bucket Events To SQS And To Lambda',
          runtime: lambda.Runtime.PYTHON_3_7,
          handler: 'lambda_function.on_event',
          code: lambda.Code.fromAsset(path.join(__dirname, './res/linking_function')),
          role: eventLinkingLambdaRole,
          timeout: Duration.minutes(15)
        })

        const eventLinkingLambdaLambdaPolicy = new iam.Policy(this, "el-service-role-lambda-policy", {
          policyName: "el-lambda-lambda-policy",
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

        const eventLinkingCustomResourceProvider = new cr.Provider(this, 'el-custom-resource-provider-id', {
          onEventHandler: eventLinkingLambda,
          logRetention: logs.RetentionDays.ONE_DAY,
        })

        for(const lc of props.linkingConfigurations){
          const eventLinkingCustomResource = new CustomResource(this, `el-custom-resource-${lc.bucketName}-id`, {
            resourceType: `Custom::EventLinker-${lc.bucketName}`,
            serviceToken: eventLinkingCustomResourceProvider.serviceToken,
            properties: {
              "bucketArn": lc.bucket.bucketArn,
              "bucketName": lc.bucket.bucketName,
              "sqsQueueArn": lc.sqsQueue.queueArn,
              "lambdaArn": lc.lambda.functionArn
            }
          })

          eventLinkingCustomResource.node.addDependency(lc.bucket)
          eventLinkingCustomResource.node.addDependency(lc.sqsQueue)
          eventLinkingCustomResource.node.addDependency(lc.lambda)
        }
    }
}