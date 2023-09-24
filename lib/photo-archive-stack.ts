import { Duration, Stack, StackProps, Tags, Token, CfnParameter } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { RequestBuilderFunction } from './constructs/request-builder-function/request-builder-function';
import { ConfigurationSingletonFactory } from './conf/configuration-singleton-factory';
import { PhotoArchiveDynamoStack } from './photo-archive-dynamo-stack';
import { PhotoArchiveBucketsStack } from './photo-archive-buckets-stack';
import { PhotoArchiveFeatureStack } from './photo-archive-feature-stack';

import {
  aws_stepfunctions as sfn,
  aws_stepfunctions_tasks as tasks,
  aws_iam as iam,
  aws_logs as logs,
} from 'aws-cdk-lib'

export interface PhotoArchiveStackProps extends StackProps {

}

export class PhotoArchiveStack extends Stack {

  constructor(scope: Construct, id: string, props: PhotoArchiveStackProps) {
    super(scope, id, props);

    const settings = ConfigurationSingletonFactory.getConcreteSettings()
    const defaultLambdaTimeout = Duration.minutes(15)


    // =========================
    // S3 BUCKETS + EVENT HANDLING
    // =========================

    // PhotoArchiveBucketNestedStack
    const photoArchiveBucketsNestedStack = new PhotoArchiveBucketsStack(this, 'PhotoArchiveBucketsStack', {
      lambdaTimeout: defaultLambdaTimeout
    })
    //Tags.of(photoArchiveBucketsNestedStack).add('SubStackName', photoArchiveBucketsNestedStack.stackName)
    const mainBucketNames = photoArchiveBucketsNestedStack.mainBucketNames.mainBucketNames
    const bucketEventQueue = photoArchiveBucketsNestedStack.bucketEventQueue

    // =========================
    // DYNAMO DB
    // =========================

    let photoArchiveDynamoStack: PhotoArchiveDynamoStack | undefined = undefined
    if(settings.enableDynamoMetricsTable){
      photoArchiveDynamoStack = new PhotoArchiveDynamoStack(this, 'PhotoArchiveDynamoStack', {
        lambdaTimeout: defaultLambdaTimeout
      })

      //Tags.of(photoArchiveDynamoStack).add('SubStackName', photoArchiveDynamoStack.stackName)
    }
        
    // ==========================
    // LAMBDAS + QUEUES
    // ==========================

    // PhotoArchiveFeatureStack
    const photoArchiveFeatureStack = new PhotoArchiveFeatureStack(this, 'PhotoArchiveFeatureStack', {
      mainBucketNames: mainBucketNames,
      lambdaTimeout: defaultLambdaTimeout,
      dynamoQueue: photoArchiveDynamoStack?.dynamoQueue
    })
    //Tags.of(photoArchiveFeatureStack).add('SubStackName', photoArchiveFeatureStack.stackName)
    // THIS TAG CAUSES A CIRCULAR DEPENDENCY ?
    const featureLambdas = photoArchiveFeatureStack.featureLambdas




    // State machine
    const smTasks = featureLambdas.map((featureLambda) => {
      return new tasks.LambdaInvoke(this, `invoke-${featureLambda.functionName}`, {
        lambdaFunction: featureLambda,
        /*resultSelector: {
          meta: '$.Payload.meta',
          bucketName: '$.Payload.bucketName',
          bucketArn: '$.Payload.bucketArn',
          key: '$.Payload.key',
          features: '$.Payload.features',
          numberOfFeaturesCompleted: '$.Payload.numberOfFeaturesComplete'
        }*/
        outputPath: '$.Payload'
      })
    })

    const definition = smTasks.shift()
    if(definition != undefined){
      let chain = sfn.Chain.start(definition)
      for(const smtask of smTasks){
        chain = chain.next(smtask)
      }
    }

    const stateMachine = new sfn.StateMachine(this, 'PhotoProcessingStateMachine', {
      comment: 'Photo Processing State Machine',
      stateMachineName: 'photo-processing-state-machine',
      definitionBody: definition != undefined ? sfn.DefinitionBody.fromChainable(definition) : undefined,

      tracingEnabled: true,
      logs: {
        destination: new logs.LogGroup(this, 'photo-processing-state-machine-logs'),
        level: sfn.LogLevel.ALL
      }
    })
  
    // EventQueue -> ReqestBuilderFunction -> Trigger the State Machine
    const requestBuilderFunction = new RequestBuilderFunction(this, "RequestBuilderFunction", {
      stateMachineArn: stateMachine.stateMachineArn,
      eventQueue: bucketEventQueue,
      lambdaTimeout: defaultLambdaTimeout
    })


    if(settings.enableDynamoMetricsTable){
      photoArchiveDynamoStack?.setDynamoQueuePolicyToAllowLambdas(featureLambdas)
      photoArchiveDynamoStack?.node.addDependency(photoArchiveFeatureStack)
    }



  }

}
