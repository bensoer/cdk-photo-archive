import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib"
import {
    aws_lambda as lambda,
    aws_iam as iam,
    aws_sqs as sqs,
    aws_s3 as s3,
    aws_dynamodb as dynamodb
} from "aws-cdk-lib"
import * as path from 'path'
import { ManagedPolicies, ServicePrincipals } from "cdk-constants";
import { Features } from "../../../enums/features";

export interface PhotoMetaTagFunctionProps{
    requestQueue: sqs.Queue,
    buckets: Array<s3.IBucket>,
    lambdaTimeout: Duration,
    dynamoMetricsQueue?: sqs.Queue
}

export class PhotoMetaTagFunction extends Construct{

    public readonly photoMetaFunction: lambda.Function

    constructor(scope: Construct, id:string, props: PhotoMetaTagFunctionProps){
        super(scope, id)


        const photoMetaFunctionRole = new iam.Role(this, "pmtf-service-role-id", {
            roleName: "pmtf-service-role",
            description: "Service Role For Photo Meta Tag Function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        photoMetaFunctionRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
          )
        )
      
        const photoMetaFunctionRoleSQSSendPolicy = new iam.Policy(this, "pmtf-service-role-sqs-send-policy-id", {
          policyName: "pmtf-service-role-sqs-send-policy",
          roles: [
            photoMetaFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "sqs:SendMessage"
              ],
              resources:[
                props.requestQueue.queueArn
              ]
            })
          ]
        })
        //props.requestQueue.grantSendMessages(photoMetaFunctionRole)

        const bucketArns = props.buckets.map((bucket) => bucket.bucketArn)
        const bucketArnsSub = bucketArns.map((bucketArn) => bucketArn + "/*")
        const mergedBucketArns = bucketArns.concat(bucketArnsSub)
        const photoMetaFunctionRoleS3Policy = new iam.Policy(this, "pmtf-service-role-s3-policy-id", {
          policyName: "pmtf-service-role-s3-policy",
          roles:[
            photoMetaFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "s3:GetObject",
                "s3:PutObjectTagging",
                "s3:GetObjectTagging"
              ],
              resources: mergedBucketArns
            })
          ],
          
        })

        const exifReadLayer = new lambda.LayerVersion(this, "pmtf-exifread-layer-id", {
          layerVersionName: "pmtf-exifread-layer",
          compatibleRuntimes:[
            lambda.Runtime.PYTHON_3_8
          ],
          code: lambda.Code.fromAsset(path.join(__dirname, "./res/exifread/exifread_layer.zip")),
          description: "exifread library lambda layer"
        })

        this.photoMetaFunction = new lambda.Function(this, `p,tf-${Features.PHOTO_META_TAG}-function-id`, {
          functionName: `${Features.PHOTO_META_TAG}-function`,
          description: 'Photo Meta Tag Function. Tagging S3 photo resources with photo metrics.',
          runtime: lambda.Runtime.PYTHON_3_8,
          layers:[
            exifReadLayer
          ],
          memorySize: 1024,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, './res/photo_meta_function')),
          timeout: props.lambdaTimeout,
          role: photoMetaFunctionRole,
          environment:{
            FEATURE_NAME: Features.PHOTO_META_TAG,
            REQUEST_QUEUE_URL: props.requestQueue.queueUrl,
            REQUEST_QUEUE_ARN: props.requestQueue.queueArn,
            DYNAMODB_METRICS_QUEUE_URL: props.dynamoMetricsQueue?.queueUrl ?? "Invalid"
          }
        })
    }
}