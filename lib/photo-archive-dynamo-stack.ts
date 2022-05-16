import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import {
    aws_sqs as sqs,
    aws_lambda as lambda,
} from 'aws-cdk-lib'
import { Construct } from "constructs";
import { DynamoMetricsTable } from "./constructs/dynamo-metrics-table/dynamo-metrics-table";

export interface PhotoArchiveDynamoNestedStackProps extends NestedStackProps{
    lambdaTimeout: Duration
}

export class PhotoArchiveDynamoStack extends NestedStack{

    public readonly dynamoQueue: sqs.Queue

    private readonly dynamoMetricsTable: DynamoMetricsTable

    constructor(scope: Construct, id: string, props: PhotoArchiveDynamoNestedStackProps){
        super(scope, id, props)

        this.dynamoMetricsTable = new DynamoMetricsTable(this, "DynamoMetricsTable", {
            lambdaTimeout: props.lambdaTimeout
        })

        this.dynamoQueue = this.dynamoMetricsTable.dynamoQueue
    }

    public setDynamoQueuePolicyToAllowLambdas(featureLambdas: Array<lambda.Function>){
        return this.dynamoMetricsTable.setDynamoQueuePolicyToAllowLambdas(featureLambdas)
    }
}