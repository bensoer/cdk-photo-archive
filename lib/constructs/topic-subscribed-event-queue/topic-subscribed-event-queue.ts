import { Construct } from "constructs";
import { Duration } from 'aws-cdk-lib'
import {
    aws_sns as sns,
    aws_sqs as sqs,
    aws_sns_subscriptions as subscriptions,
} from 'aws-cdk-lib'

export class TopicSubscribedEventQueueProps{
    topic: sns.Topic
    queueName: string
    lambdaTimeout: Duration
}


export class TopicSubscribedEventQueue extends Construct {

    public readonly eventQueue: sqs.Queue

    constructor(scope: Construct, id: string, props: TopicSubscribedEventQueueProps){
        super(scope, id)

        const lambdaTimeoutMinutes = props.lambdaTimeout.toMinutes()
        const visibilityTimeout = lambdaTimeoutMinutes * 6

        this.eventQueue = new sqs.Queue(this, `SubscribedEventQueue`, {
            queueName: props.queueName,
            encryption: sqs.QueueEncryption.UNENCRYPTED,
            visibilityTimeout: Duration.minutes(visibilityTimeout)
        })

        // Subscribe the event queue to the Topic
        props.topic.addSubscription(new subscriptions.SqsSubscription(this.eventQueue))

        /*const eventQueuePolicy = new sqs.QueuePolicy(this, "eq-policy-id",{
          queues: [ this.eventQueue ],
        })
    
        const bucketArns = props.buckets.map((bucket) => "arn:aws:s3:*:*:" + bucket.bucketName)
        eventQueuePolicy.document.addStatements(new iam.PolicyStatement({
            principals:[
                new iam.ServicePrincipal(ServicePrincipals.S3)
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
        }))*/
    }
}