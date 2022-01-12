import { Construct } from "constructs";
import {
    aws_dynamodb as dynamodb,
    aws_sqs as sqs,
    aws_iam as iam,
    aws_lambda as lambda
} from 'aws-cdk-lib'
import { RemovalPolicy, Duration } from "aws-cdk-lib";
import { ManagedPolicies, ServicePrincipals } from "cdk-constants";
import * as path from 'path'
import { SqsEventSource } from "aws-cdk-lib/aws-lambda-event-sources";

export interface DynamoMetricsTableProps {
    lambdaTimeout: Duration
}

export class DynamoMetricsTable  extends Construct {

    public readonly dynamoTable: dynamodb.Table
    public readonly dynamoQueue: sqs.Queue
    public readonly dynamoLambda: lambda.Function

    constructor(scope: Construct, id: string, props: DynamoMetricsTableProps){
        super(scope, id)

        const lambdaTimeoutMinutes = props.lambdaTimeout.toMinutes()
        const visibilityTimeout = lambdaTimeoutMinutes * 6

        this.dynamoQueue = new sqs.Queue(this, `pa-dynamodb-queue-id`, {
            queueName: 'pa-dynamodb-queue',
            encryption: sqs.QueueEncryption.UNENCRYPTED,
            visibilityTimeout: Duration.minutes(visibilityTimeout)
        })

        this.dynamoTable = new dynamodb.Table(this, 'pa-dynamodb-table-id', {
            partitionKey: { name: 'hash', type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PROVISIONED,
            encryption: dynamodb.TableEncryption.DEFAULT,
            removalPolicy: RemovalPolicy.RETAIN,
            readCapacity: 1,
            writeCapacity: 1
          })
      
        const partitionKey = this.dynamoTable.schema().partitionKey
        const tableName = this.dynamoTable.tableName
    
        this.dynamoTable.autoScaleWriteCapacity({
            minCapacity: 1,
            maxCapacity: 10
        }).scaleOnUtilization({
            targetUtilizationPercent: 75
        })
    
        this.dynamoTable.autoScaleReadCapacity({
            minCapacity: 1,
            maxCapacity: 10
        }).scaleOnUtilization({
            targetUtilizationPercent: 75
        })

        // Note: This may need tuning
        /*this.dynamoTable.addLocalSecondaryIndex({
            indexName: 'id',
            sortKey: { name: 'hash', type: dynamodb.AttributeType.STRING},
            projectionType: dynamodb.ProjectionType.ALL
        })*/

        const dynamoLambdaRole = new iam.Role(this, 'pa-dynamodb-lambda-service-role-id', {
            roleName: "pa-dynamodb-lambda-service-role",
            description: "Service Role For DynamoDB Lambda",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
        })

        dynamoLambdaRole.addManagedPolicy(
            iam.ManagedPolicy.fromAwsManagedPolicyName(
                ManagedPolicies.AWS_LAMBDA_BASIC_EXECUTION_ROLE
            )
        )

        const dynamoLambdaRoleSQSPolicy = new iam.Policy(this, 'pa-dynamodb-lambda-service-role-sqs-receive-policy-id', {
            policyName: 'pa-dynamodb-lambda-service-role-sqs-receive-policy',
            roles: [
                dynamoLambdaRole
            ],
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        "sqs:DeleteMessage",
                        "sqs:ReceiveMessage",
                        "sqs:GetQueueAttributes"
                    ],
                    resources:[
                        this.dynamoQueue.queueArn
                    ]
                })
            ]
        })

        // applies policy for the lambda to Read-Write to our dynamo table
        this.dynamoTable.grantReadWriteData(dynamoLambdaRole)

        this.dynamoLambda = new lambda.Function(this, 'pa-dynamodb-lambda-id', {
            functionName: 'dynamodb-lambda-function',
            description: 'DynamoDB Lambda For Processing Photo Archive Metrics Requests From DynamoDB Queue',
            runtime: lambda.Runtime.PYTHON_3_8,
            memorySize: 128,
            handler: 'lambda_function.lambda_handler',
            code: lambda.Code.fromAsset(path.join(__dirname, './res')),
            role: dynamoLambdaRole,
            environment:{
                DYNAMODB_TABLE_NAME: tableName,
                DYNAMODB_PARTITION_KEY: partitionKey.name
            }
        })

        this.dynamoLambda.addEventSource(new SqsEventSource(this.dynamoQueue, {
            batchSize: 1
        }))


    }
}