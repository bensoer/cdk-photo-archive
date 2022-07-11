import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import {
    aws_sqs as sqs,
    aws_lambda as lambda,
    aws_s3 as s3,
    aws_ssm as ssm,
} from 'aws-cdk-lib'
import { Sns } from "aws-cdk-lib/aws-ses-actions";
import { Construct } from "constructs";
import { ConfigurationSingletonFactory } from "./conf/configuration-singleton-factory";
import { DispatcherFunction } from "./constructs/dispatcher-function/dispatcher-function";
import { DynamoMetricsTable } from "./constructs/dynamo-metrics-table/dynamo-metrics-table";
import { HashTagFunction } from "./constructs/features/hash-tag-function/hash-tag-function";
import { PhotoMetaTagFunction } from "./constructs/features/photo-meta-tag-function/photo-meta-tag-function";
import { PhotoRekogTagFunction } from "./constructs/features/photo-rekog-tag-function/photo-rekog-tag-function";
import { LambdaLayers, LayerTypes } from "./constructs/lambda-layers/lambda-layers";
import { Features } from "./enums/features";

export interface PhotoArchiveFeatureNestedStackProps extends NestedStackProps{
    lambdaTimeout: Duration,
    mainBuckets: Array<s3.IBucket>,
    requestQueue: sqs.Queue,
    dynamoQueue?: sqs.Queue,
    onLayerRequestListener: (layerTypes: Array<LayerTypes>) => Array<lambda.LayerVersion>
}

export class PhotoArchiveFeatureStack extends NestedStack{

    public readonly lambdaMap: Map<Features, string> = new Map()
    public readonly  featureLambdas = new Array<lambda.Function>()

    constructor(scope: Construct, id: string, props: PhotoArchiveFeatureNestedStackProps){
        super(scope, id, props)

        const settings = ConfigurationSingletonFactory.getConcreteSettings()
        

        // DispatchLambda -> HashingFunction (FeatureLambda)
        if(settings.features.includes(Features.HASH_TAG)){
            const hashFunction = new HashTagFunction(this, "HashTagFunction", {
                buckets: props.mainBuckets,
                requestQueue: props.requestQueue,
                lambdaTimeout: props.lambdaTimeout,
                onLayerRequestListener: props.onLayerRequestListener,
                dynamoMetricsQueue: props.dynamoQueue
            })
            this.lambdaMap.set(Features.HASH_TAG, hashFunction.hashTagFunction.functionArn)
            this.featureLambdas.push(hashFunction.hashTagFunction)

            new ssm.StringParameter(this, `FeatureHashTagEnabled`, {
                parameterName: `/${settings.namePrefix}/features/HashTag/enabled`,
                description: `Parameter stating whether Feature HashTag is Enabled`,
                stringValue: 'TRUE',
                tier: ssm.ParameterTier.STANDARD
            })
    
            new ssm.StringParameter(this, `FeatureHashTagLambdaArn`, {
                parameterName: `/${settings.namePrefix}/features/HashTag/lambda/arn`,
                description: `Parameter stating Lambda ARN to execute by Dispatcher for Feature HashTag`,
                stringValue: hashFunction.hashTagFunction.functionArn,
                tier: ssm.ParameterTier.STANDARD
            })
        }
      
        // DispatchLambda -> PhotoMetaFunction (FeatureLambda)
        if(settings.features.includes(Features.PHOTO_META_TAG)){
            const photoMetaTaggerFunction = new PhotoMetaTagFunction(this, "PhotoMetaTagFunction", {
                buckets: props.mainBuckets,
                requestQueue: props.requestQueue,
                lambdaTimeout: props.lambdaTimeout,
                onLayerRequestListener: props.onLayerRequestListener,
                dynamoMetricsQueue: props.dynamoQueue
            })
            this.lambdaMap.set(Features.PHOTO_META_TAG, photoMetaTaggerFunction.photoMetaFunction.functionArn)
            this.featureLambdas.push(photoMetaTaggerFunction.photoMetaFunction)

            new ssm.StringParameter(this, `FeaturePhotMetaTagEnabled`, {
                parameterName: `/${settings.namePrefix}/features/PhotoMetaTag/enabled`,
                description: `Parameter stating whether Feature PhotoMetaTag is Enabled`,
                stringValue: 'TRUE',
                tier: ssm.ParameterTier.STANDARD
            })
    
            new ssm.StringParameter(this, `FeaturePhotoMetaTagLambdaArn`, {
                parameterName: `/${settings.namePrefix}/features/PhotoMetaTag/lambda/arn`,
                description: `Parameter stating Lambda ARN to execute by Dispatcher for Feature HashTag`,
                stringValue: photoMetaTaggerFunction.photoMetaFunction.functionArn,
                tier: ssm.ParameterTier.STANDARD
            })
        }
    
        // DispatchLambda -> RekogFunction (FeatureLambda)
        if(settings.features.includes(Features.PHOTO_REKOG_TAG)){
            const rekogFunction = new PhotoRekogTagFunction(this, "PhotoRekogTagFunction", {
                buckets: props.mainBuckets,
                requestQueue: props.requestQueue,
                lambdaTimeout: props.lambdaTimeout,
                onLayerRequestListener: props.onLayerRequestListener,
                dynamoMetricsQueue: props.dynamoQueue
            })
            this.lambdaMap.set(Features.PHOTO_REKOG_TAG, rekogFunction.rekogFunction.functionArn)
            this.featureLambdas.push(rekogFunction.rekogFunction)

            new ssm.StringParameter(this, `FeaturePhotoRekogEnabled`, {
                parameterName: `/${settings.namePrefix}/features/PhotoRekog/enabled`,
                description: `Parameter stating whether Feature PhotoRekog is Enabled`,
                stringValue: 'TRUE',
                tier: ssm.ParameterTier.STANDARD
            })
    
            new ssm.StringParameter(this, `FeaturePhotoRekogLambdaArn`, {
                parameterName: `/${settings.namePrefix}/features/PhotoRekog/lambda/arn`,
                description: `Parameter stating Lambda ARN to execute by Dispatcher for Feature PhotoRekog`,
                stringValue: rekogFunction.rekogFunction.functionArn,
                tier: ssm.ParameterTier.STANDARD
            })
        }

        const featuresAsStrings = settings.features.map((feature) => feature.toString())
        new ssm.StringListParameter(this, 'FeaturesList', {
            parameterName: `/${settings.namePrefix}/features`,
            description: 'Listing of all available features and their names',
            stringListValue: featuresAsStrings,
            tier: ssm.ParameterTier.STANDARD
        })

        // RequestQueue -> DispatcherFunction
        const dispatcherFunction = new DispatcherFunction(this, "DispatcherFunction", {
            featureLambdas: this.featureLambdas,
            requestQueue: props.requestQueue,
            lambdaTimeout: props.lambdaTimeout
        })


    }

}