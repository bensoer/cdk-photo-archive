import { Construct } from "constructs";
import { Duration, Stack } from "aws-cdk-lib"
import {
    aws_lambda as lambda,
    aws_iam as iam,
    aws_sqs as sqs,
    aws_s3 as s3,
    aws_dynamodb as dynamodb,
    aws_ssm as ssm
} from "aws-cdk-lib"
import * as path from 'path'
import { ManagedPolicies, ServicePrincipals } from "cdk-constants";
import { Features } from "../../../enums/features";
import { LayerTypes } from "../../lambda-layers/lambda-layers";
import { ConfigurationSingletonFactory } from "../../../conf/configuration-singleton-factory";

export interface PhotoRekogTagFunctionProps{
    bucketArns: Array<string>,
    lambdaTimeout: Duration,
    dynamoMetricsQueue?: sqs.Queue,
    onLayerRequestListener: (layerTypes: Array<LayerTypes>) => Array<lambda.LayerVersion>
}

export class PhotoRekogTagFunction extends Construct{

    public readonly rekogFunction: lambda.Function

    constructor(scope: Construct, id:string, props: PhotoRekogTagFunctionProps){
        super(scope, id)

        const settings = ConfigurationSingletonFactory.getConcreteSettings()

        const rekogFunctionRole = new iam.Role(this, "PRTFServiceRole", {
            roleName: `${settings.namePrefix}-prtf-service-role`,
            description: "Service Role For Photo Rekognition Tag Function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        rekogFunctionRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
          )
        )

        const rekogFunctionRoleRekognitionPolicy = new iam.Policy(this, "PRTFServiceRoleRekognitionPolicy", {
            policyName: `${settings.namePrefix}-prtf-service-role-rekognition-policy`,
            roles:[
                rekogFunctionRole
            ],
            statements: [
                new iam.PolicyStatement({
                    actions:[
                        "rekognition:DetectLabels"
                    ],
                    resources:[
                        "*"
                    ]
                })
            ]
        })

        const bucketArnsSub = props.bucketArns.map((bucketArn) => bucketArn + "/*")
        const mergedBucketArns = props.bucketArns.concat(bucketArnsSub)
        const rekogFunctionRoleS3Policy = new iam.Policy(this, "PRTFServiceRoleS3Policy", {
          policyName: `${settings.namePrefix}-prtf-service-role-s3-policy`,
          roles:[
            rekogFunctionRole
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

        const rekogFunctionRoleSSMPolicy = new iam.Policy(this, "PRTFServiceRoleSSMPolicy", {
          policyName: `${settings.namePrefix}-prtf-service-role-ssm-policy`,
          roles:[
            rekogFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "ssm:GetParameter"
              ],
              resources: [
                `arn:aws:ssm:${Stack.of(this).region}:${Stack.of(this).account}:parameter/${settings.namePrefix}/features/${Features.PHOTO_REKOG_TAG}/*`
              ]
            })
          ]
        })

        this.rekogFunction = new lambda.Function(this, `PRTFFunction`, {
          functionName: `${settings.namePrefix}-${Features.PHOTO_REKOG_TAG}-function`,
          description: 'Photo Rekognition Tag Function. Tagging S3 Photos with Contents Labels Using AWS Rekognition',
          runtime: lambda.Runtime.PYTHON_3_8,
          memorySize: 128,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, './res')),
          timeout: props.lambdaTimeout,
          role: rekogFunctionRole,
          layers: props.onLayerRequestListener([LayerTypes.COMMONLIBLAYER]),
          environment:{
            FEATURE_NAME: Features.PHOTO_REKOG_TAG,
            SETTINGS_PREFIX: settings.namePrefix,
            DYNAMODB_METRICS_QUEUE_URL: props.dynamoMetricsQueue?.queueUrl ?? "Invalid"
          }
        })

        let rekogMinConfidence = "75.0"
        if(props.dynamoMetricsQueue?.queueUrl != undefined){
          rekogMinConfidence = "55.0"
        }

        new ssm.StringParameter(this, `FeaturePhotoRekogSettingsREKOGMINCONFIDENCE`, {
          parameterName: `/${settings.namePrefix}/features/${Features.PHOTO_REKOG_TAG}/setting/REKOG_MIN_CONFIDENCE`,
          description: `REKOG Minimum Confidence to provide as a possible guess`,
          stringValue: rekogMinConfidence,
          tier: ssm.ParameterTier.STANDARD
        })

        new ssm.StringParameter(this, `FeaturePhotoRekogSettingsREKOGMAXLABELS`, {
          parameterName: `/${settings.namePrefix}/features/${Features.PHOTO_REKOG_TAG}/settings/REKOG_MAX_LABELS`,
          description: `REKOG Maximum number of labels to generate `,
          stringValue: "10",
          tier: ssm.ParameterTier.STANDARD
        })
        
        new ssm.StringParameter(this, `FeaturePhotoRekogEnabled`, {
          parameterName: `/${settings.namePrefix}/features/${Features.PHOTO_REKOG_TAG}/enabled`,
          description: `Parameter stating whether Feature PhotoRekog is Enabled`,
          stringValue: 'TRUE',
          tier: ssm.ParameterTier.STANDARD
        })

        new ssm.StringParameter(this, `FeaturePhotoRekogLambdaArn`, {
            parameterName: `/${settings.namePrefix}/features/${Features.PHOTO_REKOG_TAG}/lambda/arn`,
            description: `Parameter stating Lambda ARN to execute by Dispatcher for Feature PhotoRekog`,
            stringValue: this.rekogFunction.functionArn,
            tier: ssm.ParameterTier.STANDARD
        })
    }
}