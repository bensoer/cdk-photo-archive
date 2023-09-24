import { Construct } from "constructs";
import {
    aws_iam as iam,
    aws_lambda as lambda,
    aws_sqs as sqs,
    aws_s3 as s3,
    aws_dynamodb as dynamodb,
    aws_ssm as ssm,
    Stack,
} from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'
import * as path from 'path'
import { ManagedPolicies, ServicePrincipals } from "cdk-constants";
import { Features } from "../../../enums/features";
import { LayerTypes } from "../../lambda-layers/lambda-layers";
import { ConfigurationSingletonFactory } from "../../../conf/configuration-singleton-factory";

export interface HashTagFunctionProps {
    bucketArns: Array<string>
    lambdaTimeout: Duration,
    dynamoMetricsQueue?: sqs.Queue,
    onLayerRequestListener: (layerTypes: Array<LayerTypes>) => Array<lambda.LayerVersion>
}

export class HashTagFunction extends Construct{

    public readonly hashTagFunction : lambda.Function

    constructor(scope:Construct, id:string, props: HashTagFunctionProps){
        super(scope, id)

        const settings = ConfigurationSingletonFactory.getConcreteSettings()

        const hashingFunctionRole = new iam.Role(this, "HTFServiceRole", {
            roleName: `${settings.namePrefix}-htf-service-role`,
            description: "Service Role For Hash Tag Function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        hashingFunctionRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
          )
        )

        const bucketArnsSub = props.bucketArns.map((bucketArn) => bucketArn + "/*")
        const mergedBucketArns = props.bucketArns.concat(bucketArnsSub)
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

        const hashingFunctionRoleSSMPolicy = new iam.Policy(this, "HTFServiceRoleSSMPolicy", {
          policyName: `${settings.namePrefix}-htf-service-role-ssm-policy`,
          roles:[
            hashingFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "ssm:GetParameter"
              ],
              resources: [
                `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/${settings.namePrefix}/${Features.HASH_TAG}/*`
              ]
            })
          ]
        })

        this.hashTagFunction = new lambda.Function(this, `HTFFunction`, {
          functionName: `${settings.namePrefix}-${Features.HASH_TAG}-function`,
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
            DYNAMODB_METRICS_QUEUE_URL: props.dynamoMetricsQueue?.queueUrl ?? "Invalid"
          }
        })

        new ssm.StringParameter(this, `FeatureHashTagEnabled`, {
          parameterName: `/${settings.namePrefix}/features/${Features.HASH_TAG}/enabled`,
          description: `Parameter stating whether Feature HashTag is Enabled`,
          stringValue: 'TRUE',
          tier: ssm.ParameterTier.STANDARD
      })

      new ssm.StringParameter(this, `FeatureHashTagLambdaArn`, {
          parameterName: `/${settings.namePrefix}/features/${Features.HASH_TAG}/lambda/arn`,
          description: `Parameter stating Lambda ARN to execute by Dispatcher for Feature HashTag`,
          stringValue: this.hashTagFunction.functionArn,
          tier: ssm.ParameterTier.STANDARD
      })
    }
}