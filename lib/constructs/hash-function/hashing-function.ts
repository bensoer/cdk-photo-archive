import { Construct } from "constructs";
import {
    aws_iam as iam,
    aws_lambda as lambda,
    aws_sqs as sqs,
    aws_s3 as s3
} from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import * as path from 'path'
import { ManagedPolicies, ServicePrincipals } from "cdk-constants";
import { Features } from "../../enums/features";

export interface HashingFunctionProps {
    buckets: Array<s3.IBucket>
    requestQueue: sqs.Queue
    lambdaTimeout: Duration
}

export class HashingFunction extends Construct{

    public readonly hashingFunction : lambda.Function

    constructor(scope:Construct, id:string, props: HashingFunctionProps){
        super(scope, id)

        const hashingFunctionRole = new iam.Role(this, "hf-service-role-id", {
            roleName: "hf-service-role",
            description: "Service Role For BHT Hashing Function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        hashingFunctionRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
          )
        )
      
        const hashingFunctionRoleSQSPolicy = new iam.Policy(this, "hf-service-role-sqs-policy-id", {
          policyName: "hf-service-role-sqs-policy",
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
        const hashingFunctionRoleS3Policy = new iam.Policy(this, "hf-service-role-s3-policy-id", {
          policyName: "hf-service-role-s3-policy",
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

        this.hashingFunction = new lambda.Function(this, `${Features.HASH_TAG}-function-id`, {
          functionName: `${Features.HASH_TAG}-function`,
          description: 'Hashing Function. Tagging S3 resources with MD5, SHA1, SHA256 and SHA512 hashes',
          runtime: lambda.Runtime.PYTHON_3_7,
          memorySize: 1024,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, './res/hash_function')),
          timeout: props.lambdaTimeout,
          role: hashingFunctionRole,
          environment:{
            FEATURE_NAME: Features.HASH_TAG,
            REQUEST_QUEUE_URL: props.requestQueue.queueUrl,
            REQUEST_QUEUE_ARN: props.requestQueue.queueArn
          }
        })
    }
}