import { Construct } from "constructs";
import { Duration } from "aws-cdk-lib"
import {
    aws_lambda as lambda,
    aws_iam as iam,
    aws_sqs as sqs,
} from "aws-cdk-lib"
import * as path from 'path'
import { ManagedPolicies, ServicePrincipals } from "cdk-constants";
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";


export interface DispatcherFunctionProps{
    featureLambdas: Array<lambda.Function>
    requestQueue: sqs.Queue,
    lambdaTimeout: Duration,
}

export class DispatcherFunction extends Construct{

    public readonly dispatcherFunction: lambda.Function

    constructor(scope: Construct, id:string, props: DispatcherFunctionProps){
        super(scope, id)

        const dispatcherFunctionRole = new iam.Role(this, "df-service-role-id", {
            roleName: "df-service-role",
            description: "Service Role For Dispatcher Function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
          })

        dispatcherFunctionRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
                ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
            )
        )
      
        const dispatcherFunctionRoleSQSReceivePolicy = new iam.Policy(this, "df-service-role-sqs-receive-policy-id", {
          policyName: "df-service-role-sqs-receive-policy",
          roles: [
            dispatcherFunctionRole
          ],
          statements: [
            new iam.PolicyStatement({
              actions:[
                "sqs:DeleteMessage",
                "sqs:ReceiveMessage",
                "sqs:GetQueueAttributes"
              ],
              resources:[
                props.requestQueue.queueArn
              ]
            })
          ]
        })
        //props.requestQueue.grantSendMessages(dispatcherFunctionRole)

        const dispatcherFunctionRoleLambdaInvokePolicy = new iam.Policy(this, "df-service-role-lambda-invoke-policy-id", {
            policyName: "df-service-role-lambda-invoke-policy",
            roles:[
                dispatcherFunctionRole
            ],
            statements: [
                new iam.PolicyStatement({
                    actions:[
                        "lambda:InvokeFunction",
                    ],
                    resources: props.featureLambdas.map((lambda) => lambda.functionArn)
                })
            ]
        })


        this.dispatcherFunction = new lambda.Function(this, "df-id", {
          functionName: 'dispatcher-function',
          description: 'Dispatcher Function. Delegates Request Queue Events To Appropriate Feature Functions',
          runtime: lambda.Runtime.PYTHON_3_8,
          memorySize: 128,
          handler: 'lambda_function.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, './res')),
          timeout: props.lambdaTimeout,
          role: dispatcherFunctionRole
        })

        this.dispatcherFunction.addEventSource(new SqsEventSource(props.requestQueue, {
          batchSize: 1
        }))
    }
}