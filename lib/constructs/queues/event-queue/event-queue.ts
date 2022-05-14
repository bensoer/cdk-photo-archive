import { Construct } from "constructs";
import { ServicePrincipals } from "cdk-constants";
import {
    aws_sqs as sqs,
    aws_iam as iam,
    aws_s3 as s3,
    aws_sns as sns,
    aws_sns_subscriptions as subscriptions
} from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'

export interface EventQueueProps {
    buckets: Array<s3.IBucket>
    lambdaTimeout: Duration
    eventQueueName: string
    eventTopicName: string

}

export class EventQueue extends Construct{

    public readonly eventQueue: sqs.Queue
    public readonly eventTopic: sns.Topic

    constructor(scope:Construct, id:string, props: EventQueueProps){
        super(scope, id)

        const lambdaTimeoutMinutes = props.lambdaTimeout.toMinutes()
        const visibilityTimeout = lambdaTimeoutMinutes * 6

        this.eventQueue = new sqs.Queue(this, `eq-${props.eventQueueName}-id`, {
            queueName: props.eventQueueName,
            encryption: sqs.QueueEncryption.UNENCRYPTED,
            visibilityTimeout: Duration.minutes(visibilityTimeout)
        })

        this.eventTopic = new sns.Topic(this, `eq-topic-id`, {
            displayName: `Photo Archive Create Event Topic`,
            topicName: props.eventTopicName
        })

        const bucketArns = props.buckets.map((bucket) => "arn:aws:s3:*:*:" + bucket.bucketName)

        // Set the EventQueue as subscribed to the EventTopic
        this.eventTopic.addSubscription(new subscriptions.SqsSubscription(this.eventQueue))
        
        // Add EventTopic Policy to Allow our buckets to send notifications to it
        this.eventTopic.addToResourcePolicy(
            new iam.PolicyStatement({
                principals:[
                    new iam.ServicePrincipal(ServicePrincipals.S3)
                ],
                actions:[
                    "sns:Publish",
                ],
                resources:[
                    this.eventTopic.topicArn
                ],
                conditions:{
                    "ArnLike": {
                        "aws:SourceArn": bucketArns
                    }
                }
            })
        )
      
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