import { Construct } from "constructs";
import {
    aws_sqs as sqs,
    aws_iam as iam,
    aws_s3 as s3,
} from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'

export interface EventQueueProps {
    buckets: Array<s3.Bucket>
    lambdaTimeout: Duration

}

export class EventQueue extends Construct{

    public readonly eventQueue: sqs.Queue

    constructor(scope:Construct, id:string, props: EventQueueProps){
        super(scope, id)

        const lambdaTimeoutMinutes = props.lambdaTimeout.toMinutes()
        const visibilityTimeout = lambdaTimeoutMinutes * 6

        this.eventQueue = new sqs.Queue(this, "bht-event-queue-id", {
            queueName: "bht-event-queue",
            encryption: sqs.QueueEncryption.UNENCRYPTED,
            visibilityTimeout: Duration.minutes(visibilityTimeout)
          })
      
        const eventQueuePolicy = new sqs.QueuePolicy(this, "bht-event-queue-policy-id",{
          queues: [ this.eventQueue ],
        })
    
        const bucketArns = props.buckets.map((bucket) => "arn:aws:s3:*:*:" + bucket.bucketName)
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
                    "aws:SourceArn": bucketArns
                }
            }
        }))
    }
}