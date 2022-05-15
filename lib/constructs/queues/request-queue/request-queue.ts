import { Construct } from "constructs";
import { ServicePrincipals } from "cdk-constants";
import {
    aws_sqs as sqs,
    aws_iam as iam,
    aws_s3 as s3,
} from 'aws-cdk-lib'
import { Duration } from 'aws-cdk-lib'

export interface RequestQueueProps {
    lambdaArns?: Array<string>
    dispatcherLambdaTimeout: Duration
    requestQueueName: string

}

export class RequestQueue extends Construct{

    public readonly requestQueue: sqs.Queue

    constructor(scope:Construct, id:string, props: RequestQueueProps){
        super(scope, id)

        const lambdaTimeoutMinutes = props.dispatcherLambdaTimeout.toMinutes()
        const visibilityTimeout = lambdaTimeoutMinutes * 6

        this.requestQueue = new sqs.Queue(this, `RequestQueue`, {
            queueName: props.requestQueueName,
            encryption: sqs.QueueEncryption.UNENCRYPTED,
            visibilityTimeout: Duration.minutes(visibilityTimeout)
          })

        if(props.lambdaArns !== undefined){
            this.requestQueue.addToResourcePolicy(new iam.PolicyStatement(
                {
                    principals:[
                        new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
                    ],
                    actions:[
                        "sqs:SendMessage",
                    ],
                    resources:[
                        this.requestQueue.queueArn
                    ],
                    conditions:{
                        "ArnLike": {
                            "aws:SourceArn": props.lambdaArns
                        }
                    }
                })
            )
            /*const requestQueuePolicy = new sqs.QueuePolicy(this, "rq-policy-id",{
                queues: [ this.requestQueue ],
              })
          
              requestQueuePolicy.document.addStatements(new iam.PolicyStatement({
                  principals:[
                      new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
                  ],
                  actions:[
                      "sqs:SendMessage",
                  ],
                  resources:[
                      this.requestQueue.queueArn
                  ],
                  conditions:{
                      "ArnLike": {
                          "aws:SourceArn": props.lambdaArns
                      }
                  }
              }))
              */
        }
    }
}