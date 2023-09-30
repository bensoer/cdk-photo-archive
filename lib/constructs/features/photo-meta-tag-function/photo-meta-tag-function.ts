import { Construct } from "constructs";
import { Duration, Stack } from "aws-cdk-lib"
import {
    aws_lambda as lambda,
    aws_iam as iam,
    aws_sqs as sqs,
    aws_s3 as s3,
    aws_dynamodb as dynamodb,
    aws_ssm as ssm,
} from "aws-cdk-lib"
import * as path from 'path'
import { ManagedPolicies, ServicePrincipals } from "cdk-constants";
import { Features } from "../../../enums/features";
import { LayerTypes } from "../../lambda-layers/lambda-layers";
import { ConfigurationSingletonFactory } from "../../../conf/configuration-singleton-factory";

export interface PhotoMetaTagFunctionProps{
    bucketArns: Array<string>,
    lambdaTimeout: Duration,
    dynamoMetricsQueue?: sqs.Queue,
    onLayerRequestListener: (layerTypes: Array<LayerTypes>) => Array<lambda.LayerVersion>
}

export class PhotoMetaTagFunction extends Construct{

    public readonly photoMetaFunction: lambda.Function

    constructor(scope: Construct, id:string, props: PhotoMetaTagFunctionProps){
        super(scope, id)

        const settings = ConfigurationSingletonFactory.getConcreteSettings()

        const photoMetaFunctionRole = new iam.Role(this, "PMTFServiceRole", {
            roleName: `${settings.namePrefix}-pmtf-service-role`,
            description: "Service Role For Photo Meta Tag Function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        photoMetaFunctionRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
          )
        )

        const bucketArnsSub = props.bucketArns.map((bucketArn) => bucketArn + "/*")
        const mergedBucketArns = props.bucketArns.concat(bucketArnsSub)
        const photoMetaFunctionRoleS3Policy = new iam.Policy(this, "PMTFServiceRoleS3Policy", {
          policyName: `${settings.namePrefix}-pmtf-service-role-s3-policy`,
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

        const photoMetaFunctionRoleSSMPolicy = new iam.Policy(this, "PMTFServiceRoleSSMPolicy", {
          policyName: `${settings.namePrefix}-pmtf-service-role-ssm-policy`,
          roles:[
            photoMetaFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "ssm:GetParameter"
              ],
              resources: [
                `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/${settings.namePrefix}/features/${Features.PHOTO_META_TAG}/*`
              ]
            })
          ]
        })

        this.photoMetaFunction = new lambda.Function(this, `PMTFFunction`, {
          functionName: `${settings.namePrefix}-${Features.PHOTO_META_TAG}-function`,
          description: 'Photo Meta Tag Function. Tagging S3 photo resources with photo metrics.',
          runtime: lambda.Runtime.PYTHON_3_8,
          layers: props.onLayerRequestListener([LayerTypes.EXIFREADLAYER, LayerTypes.COMMONLIBLAYER]),
          memorySize: 1024,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, './res')),
          timeout: props.lambdaTimeout,
          role: photoMetaFunctionRole,
          environment:{
            FEATURE_NAME: Features.PHOTO_META_TAG,
            SETTINGS_PREFIX: settings.namePrefix,
            DYNAMODB_METRICS_QUEUE_URL: props.dynamoMetricsQueue?.queueUrl ?? "Invalid"
          }
        })

        new ssm.StringParameter(this, `FeaturePhotMetaTagEnabled`, {
          parameterName: `/${settings.namePrefix}/features/${Features.PHOTO_META_TAG}/enabled`,
          description: `Parameter stating whether Feature PhotoMetaTag is Enabled`,
          stringValue: 'TRUE',
          tier: ssm.ParameterTier.STANDARD
      })

      new ssm.StringParameter(this, `FeaturePhotoMetaTagLambdaArn`, {
          parameterName: `/${settings.namePrefix}/features/${Features.PHOTO_META_TAG}/lambda/arn`,
          description: `Parameter stating Lambda ARN to execute by Dispatcher for Feature HashTag`,
          stringValue: this.photoMetaFunction.functionArn,
          tier: ssm.ParameterTier.STANDARD
      })
    }
}