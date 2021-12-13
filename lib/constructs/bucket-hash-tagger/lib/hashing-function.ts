import { Construct } from "constructs";
import {
    aws_iam as iam,
    aws_lambda as lambda,
    aws_sqs as sqs,
    aws_s3 as s3
} from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import * as path from 'path'

export interface HashingFunctionProps {
    buckets: Array<s3.Bucket>
    eventQueue: sqs.Queue
    lambdaTimeout: Duration
}

export class HashingFunction extends Construct{

    public readonly hashingFunction : lambda.Function

    constructor(scope:Construct, id:string, props: HashingFunctionProps){
        super(scope, id)

        const hashingFunctionRole = new iam.Role(this, "bht-hashing-function-service-role-id", {
            roleName: "bht-hashing-function-service-role",
            description: "Service Role For BHT Hashing Function",
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com")
          })

        hashingFunctionRole.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"))
      
        const hashingFunctionRoleSQSPolicy = new iam.Policy(this, "bht-hashing-function-service-role-sqs-policy-id", {
          policyName: "bht-hashing-function-service-role-sqs-policy",
          roles: [
            hashingFunctionRole
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

        const bucketArns = props.buckets.map((bucket) => bucket.bucketArn)
        const hashingFunctionRoleS3Policy = new iam.Policy(this, "bht-hashing-function-service-role-s3-policy-id", {
          policyName: "bht-hashing-function-service-role-s3-policy",
          roles:[
            hashingFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "s3:GetObject",
                "s3:PutObjectTagging"
              ],
              resources: bucketArns
            })
          ],
          
        })

        this.hashingFunction = new lambda.Function(this, "bht-hashing-function", {
          functionName: 'bht-hashing-function',
          description: 'Hashing Function. Tagging S3 resources with MD5, SHA1, SHA256 and SHA512 hashes',
          runtime: lambda.Runtime.PYTHON_3_7,
          memorySize: 1024,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, '../res/hash_function')),
          timeout: props.lambdaTimeout,
          role: hashingFunctionRole
        })
    }
}