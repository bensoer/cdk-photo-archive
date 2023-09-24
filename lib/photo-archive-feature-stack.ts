import { Duration, NestedStackProps, Tags } from "aws-cdk-lib";
import {
    aws_sqs as sqs,
    aws_lambda as lambda,
    aws_s3 as s3,
    aws_ssm as ssm,
} from 'aws-cdk-lib'
import { Construct } from "constructs";
import { ConfigurationSingletonFactory } from "./conf/configuration-singleton-factory";
import { HashTagFunction } from "./constructs/features/hash-tag-function/hash-tag-function";
import { PhotoMetaTagFunction } from "./constructs/features/photo-meta-tag-function/photo-meta-tag-function";
import { PhotoRekogTagFunction } from "./constructs/features/photo-rekog-tag-function/photo-rekog-tag-function";
import { Features } from "./enums/features";
import { PhotoArchiveLambdaLayerStack } from "./photo-archive-lambda-layer-stack";
import { CPANestedStack } from "./constructs/cpa-nested-stack";

export interface PhotoArchiveFeatureNestedStackProps extends NestedStackProps{
    lambdaTimeout: Duration,
    dynamoQueue?: sqs.Queue,
    mainBucketNames: Array<string>
}

export class PhotoArchiveFeatureStack extends CPANestedStack{

    public readonly lambdaMap: Map<Features, string> = new Map()
    public readonly  featureLambdas = new Array<lambda.Function>()

    constructor(scope: Construct, id: string, props: PhotoArchiveFeatureNestedStackProps){
        super(scope, id, props)

        const settings = ConfigurationSingletonFactory.getConcreteSettings()
        const mainBucketArns = props.mainBucketNames.map((mainBucketName) => `arn:aws:s3:::${mainBucketName}`)


        // ========================
        // Lambda Layers
        // ========================

        // PhotoArchiveLambdaLayerStack
        const photoArchiveLambdaLayerStack = new PhotoArchiveLambdaLayerStack(this, 'PhotoArchiveLambdaLayerStack', {
        
        })
        //Tags.of(photoArchiveLambdaLayerStack).add('SubStackName', photoArchiveLambdaLayerStack.stackName)
        const layerFinder = photoArchiveLambdaLayerStack.layerFinder
        

        // DispatchLambda -> HashingFunction (FeatureLambda)
        if(settings.features.includes(Features.HASH_TAG)){
            const hashFunction = new HashTagFunction(this, Features.HASH_TAG, {
                bucketArns: mainBucketArns,
                lambdaTimeout: props.lambdaTimeout,
                onLayerRequestListener: layerFinder,
                dynamoMetricsQueue: props.dynamoQueue
            })
            this.lambdaMap.set(Features.HASH_TAG, hashFunction.hashTagFunction.functionArn)
            this.featureLambdas.push(hashFunction.hashTagFunction)
        }
      
        // DispatchLambda -> PhotoMetaFunction (FeatureLambda)
        if(settings.features.includes(Features.PHOTO_META_TAG)){
            const photoMetaTaggerFunction = new PhotoMetaTagFunction(this, Features.PHOTO_META_TAG, {
                bucketArns: mainBucketArns,
                lambdaTimeout: props.lambdaTimeout,
                onLayerRequestListener: layerFinder,
                dynamoMetricsQueue: props.dynamoQueue
            })
            this.lambdaMap.set(Features.PHOTO_META_TAG, photoMetaTaggerFunction.photoMetaFunction.functionArn)
            this.featureLambdas.push(photoMetaTaggerFunction.photoMetaFunction)
        }
    
        // DispatchLambda -> RekogFunction (FeatureLambda)
        if(settings.features.includes(Features.PHOTO_REKOG_TAG)){
            const rekogFunction = new PhotoRekogTagFunction(this, Features.PHOTO_REKOG_TAG, {
                bucketArns: mainBucketArns,
                lambdaTimeout: props.lambdaTimeout,
                onLayerRequestListener: layerFinder,
                dynamoMetricsQueue: props.dynamoQueue
            })
            this.lambdaMap.set(Features.PHOTO_REKOG_TAG, rekogFunction.rekogFunction.functionArn)
            this.featureLambdas.push(rekogFunction.rekogFunction)

        }

        const featuresAsStrings = settings.features.map((feature) => feature.toString())
        new ssm.StringListParameter(this, 'FeaturesList', {
            parameterName: `/${settings.namePrefix}/features`,
            description: 'Listing of all available features and their names',
            stringListValue: featuresAsStrings,
            tier: ssm.ParameterTier.STANDARD
        })

    }

}