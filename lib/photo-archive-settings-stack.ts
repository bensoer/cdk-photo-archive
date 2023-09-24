import { CfnElement, NestedStack, NestedStackProps, Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { 
  aws_ssm as ssm,
} from 'aws-cdk-lib';
import { Features } from './enums/features';
import { CPANestedStack } from './constructs/cpa-nested-stack';

export interface PhotoArchiveSettingsStackProps extends NestedStackProps {
    features: Array<Features>
    lambdaMap: Map<Features, string>
}

export class PhotoArchiveSettingsStack extends CPANestedStack {

  constructor(scope: Construct, id: string, props: PhotoArchiveSettingsStackProps) {
    super(scope, id, props);
    /**
     * 
        SSM Parameter Store Feature Data:

        /pa/features - StringList of features

        /pa/features/hashtaglambda/enabled - TRUE|FALSE
        /pa/features/hashtaglambda/lambda/arn - STRING

        /pa/features/photometataglambda/enabled - TRUE|FALSE
        /pa/features/photometataglambda/lambda/arn - STRING

        /pa/features/rekogntaglambda/enabled - TRUE|FALSE
        /pa/features/rekogntaglambda/lambda/arn - STRING
    
     */

    const featuresAsStrings = props.features.map((feature) => feature.toString())

    new ssm.StringListParameter(this, 'FeaturesList', {
        parameterName: '/pa/features',
        description: 'Listing of all available features and their names',
        stringListValue: featuresAsStrings
    })

    for(const feature of props.features){
        new ssm.StringParameter(this, `Feature${feature.toString()}Enabled`, {
            parameterName: `/pa/features/${feature.toString()}/enabled`,
            description: `Parameter stating whether Feature ${feature.toString()} is Enabled`,
            stringValue: 'TRUE'
        })

        new ssm.StringParameter(this, `Feature${feature.toString()}LambdaArn`, {
            parameterName: `/pa/features/${feature.toString()}/lambda/arn`,
            description: `Parameter stating Lambda ARN to execute by Dispatcher for Feature ${feature.toString()}`,
            stringValue: props.lambdaMap.get(feature)!!
        })
    }

  }

}
