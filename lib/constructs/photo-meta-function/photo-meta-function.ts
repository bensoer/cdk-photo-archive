import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib"
import {
    aws_lambda as lambda,
    aws_iam as iam,
    aws_sqs as sqs,
    aws_s3 as s3,
    aws_ssm as ssm
} from "aws-cdk-lib"
import * as path from 'path'
import { LayerVersion } from "aws-cdk-lib/aws-lambda";


export interface PhotoMetaFunctionProps{
    eventQueue: sqs.Queue,
    buckets: Array<s3.Bucket>,
    lambdaTimeout: Duration,
    account: string,
    region: string

}

export class PhotoMetaFunction extends Construct{

    public readonly photoMetaFunction: lambda.Function

    constructor(scope: Construct, id:string, props: PhotoMetaFunctionProps){
        super(scope, id)


        const photoMetaFunctionRole = new iam.Role(this, "pmf-service-role-id", {
            roleName: "pmf-service-role",
            description: "Service Role For Photo Meta Function",
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com")
          })

        photoMetaFunctionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"))
      
        const photoMetaFunctionRoleSQSPolicy = new iam.Policy(this, "pmf-service-role-sqs-policy-id", {
          policyName: "pmf-service-role-sqs-policy",
          roles: [
            photoMetaFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "sqs:DeleteMessage",
                "sqs:ReceiveMessage",
                "sqs:GetQueueAttributes"
              ],
              resources:[
                props.eventQueue.queueArn
              ]
            })
          ]
        })

        const photoMetaFunctionRoleSSMPolicy = new iam.Policy(this, "pmf-service-role-ssm-policy-id", {
          policyName: "pmf-service-role-ssm-policy",
          roles:[
            photoMetaFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "ssm:GetParameter",
                "ssm:PutParameter"
              ],
              resources: props.buckets.map((bucket) => `arn:aws:ssm:${props.region}:${props.account}:parameter/locks/tagging/${bucket.bucketName.toLowerCase()}`)
            })
          ]
        })

        const bucketArns = props.buckets.map((bucket) => bucket.bucketArn)
        const bucketArnsSub = bucketArns.map((bucketArn) => bucketArn + "/*")
        const mergedBucketArns = bucketArns.concat(bucketArnsSub)
        const photoMetaFunctionRoleS3Policy = new iam.Policy(this, "pmf-service-role-s3-policy-id", {
          policyName: "pmf-service-role-s3-policy",
          roles:[
            photoMetaFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "s3:GetObject",
                "s3:PutObjectTagging"
              ],
              resources: mergedBucketArns
            })
          ],
          
        })

        const exifReadLayer = new lambda.LayerVersion(this, "pmf-exifread-layer-id", {
          layerVersionName: "pmf-exifread-layer",
          compatibleRuntimes:[
            lambda.Runtime.PYTHON_3_8
          ],
          code: lambda.Code.fromAsset("./res/exifread/exifread_layer.zip"),
          description: "exifread library lambda layer"
        })

        this.photoMetaFunction = new lambda.Function(this, "pmf-id", {
          functionName: 'photo-meta-function',
          description: 'Photo Meta Function. Tagging S3 photo resources with photo metrics.',
          runtime: lambda.Runtime.PYTHON_3_8,
          layers:[
            exifReadLayer
          ],
          memorySize: 1024,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, './res/photo_meta_function')),
          timeout: props.lambdaTimeout,
          role: photoMetaFunctionRole
        })
    }
}