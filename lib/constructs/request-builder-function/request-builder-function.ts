import { Construct } from "constructs";
import { Duration, Stack } from "aws-cdk-lib"
import {
    aws_lambda as lambda,
    aws_iam as iam,
    aws_sqs as sqs,
} from "aws-cdk-lib"
import * as path from 'path'
import { ManagedPolicies, ServicePrincipals } from "cdk-constants";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";


export interface RequestBuilderFunctionProps{
    eventQueue: sqs.Queue,
    requestQueue: sqs.Queue,
    lambdaTimeout: Duration,
    namePrefix: string
}

export class RequestBuilderFunction extends Construct{

    public readonly requestBuilderFunction: lambda.Function

    constructor(scope: Construct, id:string, props: RequestBuilderFunctionProps){
        super(scope, id)

        const account = Stack.of(this).account
        const region = Stack.of(this).region

        const requestBuilderFunctionRole = new iam.Role(this, "ServiceRole", {
            roleName: `${props.namePrefix}-rbf-service-role`,
            description: "Service Role For Request Builder Function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        requestBuilderFunctionRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
                ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
            )
        )
      
        const requestBuilderFunctionRoleSQSReceivePolicy = new iam.Policy(this, "ServiceRoleSQSReceivePolicy", {
          policyName: `${props.namePrefix}-rbf-service-role-sqs-receive-policy`,
          roles: [
            requestBuilderFunctionRole
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
        //props.eventQueue.grantConsumeMessages(requestBuilderFunctionRole)
        

        const requestBuilderFunctionRoleSQSSendPolicy = new iam.Policy(this, "ServiceRoleSQSSendPolicy", {
            policyName: `${props.namePrefix}-rbf-service-role-sqs-send-policy`,
            roles: [
                requestBuilderFunctionRole
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
          //props.requestQueue.grantSendMessages(requestBuilderFunctionRole)

        const photoMetaFunctionRoleSSMPolicy = new iam.Policy(this, "ServiceRoleSSMPolicy", {
          policyName: `${props.namePrefix}-rbf-service-role-ssm-policy`,
          roles:[
            requestBuilderFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "ssm:GetParameter"
              ],
              resources: [
                `arn:aws:ssm:${region}:${account}:parameter/${props.namePrefix}/*`
              ]
            })
          ]
        })


        this.requestBuilderFunction = new lambda.Function(this, "RequestBuilderFunction", {
          functionName: `${props.namePrefix}-request-builder-function`,
          description: 'Request Builder Function. Creates Initial Processing Request For Photo Archive Dispatcher Lambda From S3 Events.',
          runtime: lambda.Runtime.PYTHON_3_8,
          memorySize: 128,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, './res')),
          timeout: props.lambdaTimeout,
          role: requestBuilderFunctionRole,
          environment: {
              REQUEST_QUEUE_ARN: props.requestQueue.queueArn,
              REQUEST_QUEUE_URL: props.requestQueue.queueUrl,
              SSM_PREFIX: props.namePrefix
          }
        })

        this.requestBuilderFunction.addEventSource(new SqsEventSource(props.eventQueue, {
            batchSize: 1
        }))


    }
}