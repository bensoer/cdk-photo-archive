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
import { FormatUtils } from "../../utils/formatutils";
import { LayerTypes } from "../lambda-layers/lambda-layers";



export interface BucketTopicEventLinkerProps {
    buckets: Array<s3.IBucket>
    topic: sns.Topic,
    onLayerRequestListener: (layerTypes: Array<LayerTypes>) => Array<lambda.LayerVersion>
}

export class BucketTopicEventLinker extends Construct{

    constructor(scope: Construct, id: string, props: BucketTopicEventLinkerProps){
        super(scope, id)

        //const hashCode = HashUtil.generateIDSafeHash(props.bucket.bucketArn + props.bucket.bucketName + props.topic.topicArn, 15)

        const eventLinkingLambdaRole = new iam.Role(this, `CustomResourceRole`, {
            roleName: `btel-lambda-service-role`,
            description: "Assumed Role By btel-event-linking-function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        const eventLinkingLambdaS3Policy = new iam.Policy(this, `CustomResourceRoleS3Policy`, {
          policyName: `btel-lambda-s3-policy`,
          roles: [
            eventLinkingLambdaRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                's3:PutBucketNotification',
                's3:GetBucketNotification'
              ],
              resources: FormatUtils.convertBucketsToArns(props.buckets)
            })
          ]
        })
      
        const eventLinkingLambda = new lambda.Function(this, `CustomResourceLambda`,{
          functionName: `btel-function`,
          description: 'Event Linking For S3 Bucket Events To SNS',
          runtime: lambda.Runtime.PYTHON_3_8,
          layers: props.onLayerRequestListener([LayerTypes.COMMONLIBLAYER]),
          handler: 'lambda_function.on_event',
          code: lambda.Code.fromAsset(path.join(__dirname, './res')),
          role: eventLinkingLambdaRole,
          timeout: Duration.minutes(15)
        })


        const eventLinkingCustomResourceProvider = new cr.Provider(this, `CustomResourceProvider`, {
          onEventHandler: eventLinkingLambda,
          logRetention: logs.RetentionDays.ONE_DAY,
        })

        
        const eventLinkingCustomResource = new CustomResource(this, `CustomResource`, {
            resourceType: `Custom::BucketTopic-EventLinker`,
            serviceToken: eventLinkingCustomResourceProvider.serviceToken,
            properties: {
                "bucketArns": FormatUtils.convertBucketsToArns(props.buckets),
                "bucketNames": FormatUtils.convertBucketsToNames(props.buckets),
                "snsTopicArn": props.topic.topicArn,
            }
        })

        for(const bucket of props.buckets){
          eventLinkingCustomResource.node.addDependency(bucket)
        }
        eventLinkingCustomResource.node.addDependency(props.topic)
        
    }
}
