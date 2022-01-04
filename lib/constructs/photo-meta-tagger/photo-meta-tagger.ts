import { Duration, Stack } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
    aws_s3 as s3
} from "aws-cdk-lib"
import { EventQueue } from "../event-queue/event-queue";
import { PhotoMetaFunction } from "../photo-meta-function/photo-meta-function";
import { EventLinker, LinkingConfiguration } from "../event-linker/event-linker";

export interface PhotoMetaTaggerProps{
    buckets: Map<string, s3.Bucket>
    region: string
    account: string
    lambdaTimeout: Duration
    createEventLinking:boolean
}


export class PhotoMetaTagger extends Construct {

    public readonly eventQueue: EventQueue
    public readonly linkingConfiguration: Array<LinkingConfiguration> = []

    constructor(scope: Construct, id: string, props: PhotoMetaTaggerProps){
        super(scope, id)

        const lambdaTimeout = props.lambdaTimeout ?? Duration.minutes(15)

        // SQS Event Queue and associated policies
        this.eventQueue = new EventQueue(this, "pmt-event-queue-construct-id", {
          eventQueueName: "pmt-event-queue",
          buckets: Array.from(props.buckets.values()),
          lambdaTimeout: lambdaTimeout
        })

        // Hash function and associated policies
        const photoMetaFunction = new PhotoMetaFunction(this, "pmt-photo-meta-function-construct-id", {
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
              lambda: photoMetaFunction.photoMetaFunction
            }
          )
        }

        if(props.createEventLinking){
            const eventLinker = new EventLinker(this, "pmt-event-linker-id", {
                linkingConfigurations: this.linkingConfiguration
              })
        }

    }


}