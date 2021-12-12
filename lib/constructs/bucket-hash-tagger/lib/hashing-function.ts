import { Construct } from "constructs";
import {
    aws_iam as iam,
    aws_lambda as lambda,
    aws_sqs as sqs,
} from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import * as path from 'path'

export interface HashingFunctionProps {
    eventQueue: sqs.Queue
    processingTimeout: Duration
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

        this.hashingFunction = new lambda.Function(this, "bht-hashing-function", {
          functionName: 'bht-hashing-function',
          description: 'Hashing Function. Tagging S3 resources with MD5, SHA1, SHA256 and SHA512 hashes',
          runtime: lambda.Runtime.PYTHON_3_7,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, '../res/hash_function.zip')),
          timeout: props.processingTimeout,
          role: hashingFunctionRole
        })
    }
}