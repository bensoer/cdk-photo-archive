import { Construct } from "constructs";

import {
    aws_iam as iam,
    aws_lambda as lambda,
    aws_logs as logs,
    custom_resources as cr,
    aws_s3 as s3,
    aws_sqs as sqs,
    aws_sns as sns,
    hashMapper
} from "aws-cdk-lib"
import {
    Duration,
    CustomResource
} from "aws-cdk-lib"
import * as path from 'path'
import * as crypto from 'crypto'
import { ServicePrincipals } from "cdk-constants";
import { HashUtil } from "../../utils/hashutil";
import { Sns } from "aws-cdk-lib/aws-ses-actions";



export interface BucketTopicEventLinkerProps {
    bucket: s3.IBucket
    topic: sns.Topic
}

export class BucketTopicEventLinker extends Construct{

    constructor(scope: Construct, id: string, props: BucketTopicEventLinkerProps){
        super(scope, id)

        const hashCode = HashUtil.generateIDSafeHash(props.bucket.bucketArn + props.bucket.bucketName + props.topic.topicArn, 15)

        const eventLinkingLambdaRole = new iam.Role(this, `bqel-function-service-role-${hashCode}-id`, {
            roleName: `bqel-lambda-service-role-${hashCode}`,
            description: "Assumed Role By bqel-event-linking-function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        const eventLinkingLambdaS3Policy = new iam.Policy(this, `bqel-function-service-role-s3-policy-${hashCode}-id`, {
          policyName: `bqel-lambda-s3-policy-${hashCode}`,
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
      
        const eventLinkingLambda = new lambda.Function(this, `bqel-function-${hashCode}-id`,{
          functionName: `bqel-function-${hashCode}`,
          description: 'Event Linking For S3 Bucket Events To SNS',
          runtime: lambda.Runtime.PYTHON_3_8,
          handler: 'lambda_function.on_event',
          code: lambda.Code.fromAsset(path.join(__dirname, './res')),
          role: eventLinkingLambdaRole,
          timeout: Duration.minutes(15)
        })


        const eventLinkingCustomResourceProvider = new cr.Provider(this, `bqel-custom-resource-provider-${hashCode}-id`, {
          onEventHandler: eventLinkingLambda,
          logRetention: logs.RetentionDays.ONE_DAY,
        })

        
        const eventLinkingCustomResource = new CustomResource(this, `el-custom-resource-${hashCode}-id`, {
            resourceType: `Custom::BucketQueue-EventLinker-${hashCode}`,
            serviceToken: eventLinkingCustomResourceProvider.serviceToken,
            properties: {
                "bucketArn": props.bucket.bucketArn,
                "bucketName": props.bucket.bucketName,
                "snsTopicArn": props.topic.topicArn,
            }
        })

        eventLinkingCustomResource.node.addDependency(props.bucket)
        eventLinkingCustomResource.node.addDependency(props.topic)
        
    }
}
