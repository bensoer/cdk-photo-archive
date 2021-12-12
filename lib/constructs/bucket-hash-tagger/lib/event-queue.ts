import { Construct } from "constructs";
import {
    aws_sqs as sqs,
    aws_iam as iam,
    aws_s3 as s3,
} from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'

export interface EventQueueProps {
    bucket: s3.Bucket
    processingTimeout: Duration

}

export class EventQueue extends Construct{

    public readonly eventQueue: sqs.Queue

    constructor(scope:Construct, id:string, props: EventQueueProps){
        super(scope, id)

        this.eventQueue = new sqs.Queue(this, "bht-event-queue-id", {
            queueName: "bht-event-queue",
            encryption: sqs.QueueEncryption.UNENCRYPTED,
            visibilityTimeout: props.processingTimeout
          })
      
        const eventQueuePolicy = new sqs.QueuePolicy(this, "bht-event-queue-policy-id",{
          queues: [ this.eventQueue ],
        })
    
        eventQueuePolicy.document.addStatements(new iam.PolicyStatement({
            principals:[
                new iam.ServicePrincipal("s3.amazonaws.com")
            ],
            actions:[
                "sqs:SendMessage",
            ],
            resources:[
                this.eventQueue.queueArn
            ],
            conditions:{
                "ArnLike": {
                    "aws:SourceArn": "arn:aws:s3:*:*:" + props.bucket.bucketName
                }
            }
        }))
    }
}