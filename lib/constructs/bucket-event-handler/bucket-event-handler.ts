import { Construct } from "constructs";
import { ServicePrincipals } from "cdk-constants";
import {
    aws_sqs as sqs,
    aws_iam as iam,
    aws_s3 as s3,
    aws_sns as sns,
} from 'aws-cdk-lib'
import { FormatUtils } from "../../utils/formatutils";

export interface BucketEventHandlerProps {
    buckets: Array<s3.IBucket>
    eventTopicName: string

}

export class BucketEventHandler extends Construct{

    public readonly eventTopic: sns.Topic

    constructor(scope:Construct, id:string, props: BucketEventHandlerProps){
        super(scope, id)

        this.eventTopic = new sns.Topic(this, `BucketEventHandlerTopic`, {
            displayName: `BucketEventHandlerTopic`,
            topicName: props.eventTopicName
        })

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
                        "aws:SourceArn": FormatUtils.convertBucketsToPolicyArns(props.buckets)
                    }
                }
            })
        )

    }
}