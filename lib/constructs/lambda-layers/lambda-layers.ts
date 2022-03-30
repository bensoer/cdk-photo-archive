import { Construct } from "constructs";
import {
    aws_lambda as lambda
} from 'aws-cdk-lib'
import * as path from 'path'

export enum LayerTypes {
    EXIFREADLAYER,
    COMMONLIBLAYER
}

export interface LambdaLayersProps {
    createLayers: Array<LayerTypes>

}

export class LambdaLayers extends Construct {

    public readonly layerArns: Array<string> = new Array<string>()

    constructor(scope:Construct, id:string, props: LambdaLayersProps){
        super(scope, id)

        if(props.createLayers.includes(LayerTypes.EXIFREADLAYER)){
            const exifReadLayer = new lambda.LayerVersion(this, "ll-exifread-layer-id", {
                layerVersionName: "ll-exifread-layer",
                compatibleRuntimes:[
                    lambda.Runtime.PYTHON_3_8
                ],
                code: lambda.Code.fromAsset(path.join(__dirname, "./res/exifread/exifread_layer.zip")),
                description: "exifread library lambda layer"
            })
            this.layerArns.push(exifReadLayer.layerVersionArn)
        }
        
        if(props.createLayers.includes(LayerTypes.COMMONLIBLAYER)){
            const commonLibLayer = new lambda.LayerVersion(this, "ll-commonlib-layer-id", {
                layerVersionName: "ll-commonlib-layer",
                compatibleRuntimes:[
                    lambda.Runtime.PYTHON_3_8
                ],
                code: lambda.Code.fromAsset(path.join(__dirname, "./res/commonlib")),
                description: "commonlib lambda layer"
            })
            this.layerArns.push(commonLibLayer.layerVersionArn)
        }
    }
}