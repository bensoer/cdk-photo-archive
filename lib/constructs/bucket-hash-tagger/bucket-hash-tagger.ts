import { Bucket } from "aws-cdk-lib/aws-s3";
import { S3 } from "aws-cdk-lib/aws-ses-actions";
import { Construct } from "constructs";
import { Duration, CustomResource} from "aws-cdk-lib";
import { 
    aws_lambda as lambda,
    aws_iam as iam,
    aws_sqs as sqs,
    custom_resources as cr,
    aws_logs as logs,
} from "aws-cdk-lib";
import * as path from 'path';
import { HashingFunction } from "../hash-function/hashing-function";
import { EventQueue } from "../event-queue/event-queue";
import { EventLinker, LinkingConfiguration } from "../event-linker/event-linker";


export interface BucketHashTaggerProps {
    buckets: Map<string, Bucket>
    lambdaTimeout?: Duration
    region: string
    account: string
    createEventLinking: boolean

}

export class BucketHashTagger extends Construct{

    public readonly eventQueue: EventQueue
    public readonly linkingConfiguration: Array<LinkingConfiguration> = []

    constructor(scope: Construct, id: string, props: BucketHashTaggerProps){
        super(scope, id);

        const lambdaTimeout = props.lambdaTimeout ?? Duration.minutes(15)

        // SQS Event Queue and associated policies
        this.eventQueue = new EventQueue(this, "bht-event-queue-construct-id", {
          buckets: Array.from(props.buckets.values()),
          lambdaTimeout: lambdaTimeout
        })

        // Hash function and associated policies
        const hashingFunction = new HashingFunction(this, "bht-hashing-function-construct-id", {
          eventQueue: this.eventQueue.eventQueue,
          lambdaTimeout: lambdaTimeout,
          buckets: Array.from(props.buckets.values()),
          region: props.region,
          account: props.account
        })

        // Event Linking Configuration
        for(const [bucketName, bucket] of props.buckets){
          this.linkingConfiguration.push(
            {
              bucket: bucket,
              bucketName: bucketName,
              sqsQueue: this.eventQueue.eventQueue,
              lambda: hashingFunction.hashingFunction
            }
          )
        }

        if(props.createEventLinking){
          const eventLinker = new EventLinker(this, "bht-event-linker-id", {
            linkingConfigurations: this.linkingConfiguration
          })
        }
        
    
        
        


    }
}