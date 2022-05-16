import { NestedStack, NestedStackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import { LambdaLayers, LayerTypes } from "./constructs/lambda-layers/lambda-layers";
import {
    aws_lambda as lambda
} from 'aws-cdk-lib'


export interface PhotoArchiveLambdaLayerNestedStackProps extends NestedStackProps{

}

export class PhotoArchiveLambdaLayerStack extends NestedStack{

    private readonly lambdaLayerHandler: LambdaLayers

    public readonly layerFinder = (layerTypes: Array<LayerTypes>) => {
        const layers = new Array<lambda.LayerVersion>()
        for(const layerType of layerTypes){
            const lambdaLayer = this.lambdaLayerHandler.getLayerOfType(layerType)
            if(lambdaLayer != undefined){
            layers.push(lambdaLayer)
            }
        }
        return layers
    }

    constructor(scope: Construct, id: string, props: PhotoArchiveLambdaLayerNestedStackProps){
        super(scope, id, props)

        this.lambdaLayerHandler = new LambdaLayers(this, 'LambdaLayerHandler', {
            createLayers: [ LayerTypes.COMMONLIBLAYER, LayerTypes.EXIFREADLAYER ]
        })
    }
}