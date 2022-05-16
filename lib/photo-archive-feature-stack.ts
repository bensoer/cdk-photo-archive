import { Duration, NestedStack, NestedStackProps } from "aws-cdk-lib";
import {
    aws_sqs as sqs,
    aws_lambda as lambda,
    aws_s3 as s3,
} from 'aws-cdk-lib'
import { Sns } from "aws-cdk-lib/aws-ses-actions";
import { Construct } from "constructs";
import { ConfigurationSingletonFactory } from "./conf/configuration-singleton-factory";
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
        }


    }

}