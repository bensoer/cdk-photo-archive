import { CfnElement, NestedStack, NestedStackProps } from "aws-cdk-lib"
import { Construct } from "constructs"

export class CPANestedStack extends NestedStack {

    constructor(scope: Construct, id: string, props: NestedStackProps){
        super(scope, id, props)
    }

    getLogicalId(element: CfnElement): string {
        if (element.node.id.includes('NestedStackResource')) {
            return  /([a-zA-Z0-9]+)\.NestedStackResource/.exec(element.node.id)![1] // will be the exact id of the stack
        }
        return super.getLogicalId(element)
    }
}