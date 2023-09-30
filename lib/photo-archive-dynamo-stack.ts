import { CfnElement, Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import {
    aws_sqs as sqs,
    aws_lambda as lambda,
} from 'aws-cdk-lib'
import { Construct } from "constructs";
import { ConfigurationSingletonFactory } from "./conf/configuration-singleton-factory";
import { DynamoMetricsTable } from "./constructs/dynamo-metrics-table/dynamo-metrics-table";
import { CPANestedStack } from "./constructs/cpa-nested-stack";

export interface PhotoArchiveDynamoNestedStackProps extends NestedStackProps{
    lambdaTimeout: Duration
}

export class PhotoArchiveDynamoStack extends CPANestedStack{

    public readonly dynamoQueue: sqs.Queue

    private readonly dynamoMetricsTable: DynamoMetricsTable

    constructor(scope: Construct, id: string, props: PhotoArchiveDynamoNestedStackProps){
        super(scope, id, props)

        const settings = ConfigurationSingletonFactory.getConcreteSettings()

        this.dynamoMetricsTable = new DynamoMetricsTable(this, "DynamoMetricsTable", {
            lambdaTimeout: props.lambdaTimeout,
            namePrefix: settings.namePrefix
        })

        this.dynamoQueue = this.dynamoMetricsTable.dynamoQueue
    }

    public setDynamoQueuePolicyToAllowLambdas(featureLambdas: Array<lambda.Function>){
        return this.dynamoMetricsTable.setDynamoQueuePolicyToAllowLambdas(featureLambdas)
    }
}