import { Construct } from "constructs";
import {
    aws_iam as iam,
    aws_lambda as lambda,
    aws_sqs as sqs,
    aws_s3 as s3,
    aws_dynamodb as dynamodb
} from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import * as path from 'path'
import { ManagedPolicies, ServicePrincipals } from "cdk-constants";
import { Features } from "../../../enums/features";
import { LayerTypes } from "../../lambda-layers/lambda-layers";

export interface HashTagFunctionProps {
    buckets: Array<s3.IBucket>
    requestQueue: sqs.Queue
    lambdaTimeout: Duration,
    dynamoMetricsQueue?: sqs.Queue,
    onLayerRequestListener: (layerTypes: Array<LayerTypes>) => Array<lambda.LayerVersion>
}

export class HashTagFunction extends Construct{

    public readonly hashTagFunction : lambda.Function

    constructor(scope:Construct, id:string, props: HashTagFunctionProps){
        super(scope, id)

        const hashingFunctionRole = new iam.Role(this, "HTFServiceRole", {
            roleName: "htf-service-role",
            description: "Service Role For Hash Tag Function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        hashingFunctionRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
          )
        )
      
        const hashingFunctionRoleSQSPolicy = new iam.Policy(this, "HTFServiceRoleSQSPolicy", {
          policyName: "htf-service-role-sqs-policy",
          roles: [
            hashingFunctionRole
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
        //props.requestQueue.grantSendMessages(hashingFunctionRole)


        const bucketArns = props.buckets.map((bucket) => bucket.bucketArn)
        const bucketArnsSub = bucketArns.map((bucketArn) => bucketArn + "/*")
        const mergedBucketArns = bucketArns.concat(bucketArnsSub)
        const hashingFunctionRoleS3Policy = new iam.Policy(this, "HTFServiceRoleS3Policy", {
          policyName: "htf-service-role-s3-policy",
          roles:[
            hashingFunctionRole
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

        this.hashTagFunction = new lambda.Function(this, `HTFFunction`, {
          functionName: `${Features.HASH_TAG}-function`,
          description: 'Hash Tag Function. Tagging S3 resources with MD5, SHA1, SHA256 and SHA512 hashes',
          runtime: lambda.Runtime.PYTHON_3_8,
          memorySize: 1024,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, './res')),
          timeout: props.lambdaTimeout,
          role: hashingFunctionRole,
          layers: props.onLayerRequestListener([LayerTypes.COMMONLIBLAYER]),
          environment:{
            FEATURE_NAME: Features.HASH_TAG,
            REQUEST_QUEUE_URL: props.requestQueue.queueUrl,
            REQUEST_QUEUE_ARN: props.requestQueue.queueArn,
            DYNAMODB_METRICS_QUEUE_URL: props.dynamoMetricsQueue?.queueUrl ?? "Invalid"
          }
        })
    }
}