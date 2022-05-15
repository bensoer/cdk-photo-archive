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
import { LayerTypes } from "../../lambda-layers/lambda-layers";

export interface PhotoRekogTagFunctionProps{
    requestQueue: sqs.Queue,
    buckets: Array<s3.IBucket>,
    lambdaTimeout: Duration,
    dynamoMetricsQueue?: sqs.Queue,
    onLayerRequestListener: (layerTypes: Array<LayerTypes>) => Array<lambda.LayerVersion>
}

export class PhotoRekogTagFunction extends Construct{

    public readonly rekogFunction: lambda.Function

    constructor(scope: Construct, id:string, props: PhotoRekogTagFunctionProps){
        super(scope, id)


        const rekogFunctionRole = new iam.Role(this, "PRTFServiceRole", {
            roleName: "prtf-service-role",
            description: "Service Role For Photo Rekognition Tag Function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        rekogFunctionRole.addManagedPolicy(
          iam.ManagedPolicy.fromAwsManagedPolicyName(
            ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
          )
        )
      
        const rekogFunctionRoleSQSSendPolicy = new iam.Policy(this, "PRTFServiceRoleSQSPolicy", {
          policyName: "prtf-service-role-sqs-send-policy",
          roles: [
            rekogFunctionRole
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

        const rekogFunctionRoleRekognitionPolicy = new iam.Policy(this, "PRTFServiceRoleRekognitionPolicy", {
            policyName: "prtf-service-role-rekognition-policy",
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
        //props.requestQueue.grantSendMessages(photoMetaFunctionRole)

        const bucketArns = props.buckets.map((bucket) => bucket.bucketArn)
        const bucketArnsSub = bucketArns.map((bucketArn) => bucketArn + "/*")
        const mergedBucketArns = bucketArns.concat(bucketArnsSub)
        const photoMetaFunctionRoleS3Policy = new iam.Policy(this, "PRTFServiceRoleS3Policy", {
          policyName: "prtf-service-role-s3-policy",
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

        let rekogMinConfidence = "75.0"
        if(props.dynamoMetricsQueue?.queueUrl != undefined){
          rekogMinConfidence = "55.0"
        }

        this.rekogFunction = new lambda.Function(this, `PRTFFunction`, {
          functionName: `${Features.PHOTO_REKOG_TAG}-function`,
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
            REQUEST_QUEUE_URL: props.requestQueue.queueUrl,
            REQUEST_QUEUE_ARN: props.requestQueue.queueArn,
            REKOG_MIN_CONFIDENCE: rekogMinConfidence,
            REKOG_MAX_LABELS: "10",
            DYNAMODB_METRICS_QUEUE_URL: props.dynamoMetricsQueue?.queueUrl ?? "Invalid"
          }
        })
    }
}