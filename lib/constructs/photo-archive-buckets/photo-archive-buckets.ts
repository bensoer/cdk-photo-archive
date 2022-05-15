import { Duration, CustomResource, RemovalPolicy, Stack, StackProps, Token } from 'aws-cdk-lib';
import { 
    aws_s3 as s3,
    aws_lambda as lambda,
    aws_iam as iam,
    custom_resources as cr,
    aws_logs as logs,
} from 'aws-cdk-lib'
import { Construct } from "constructs";
import { HashUtil } from '../../utils/hashutil';
import * as path from 'path'
import { ServicePrincipals } from 'cdk-constants';
import { FormatUtils } from '../../utils/formatutils';

export interface PhotoArchiveBucketsProps {
    switchToInfrequentAccessTierAfterDays: number
    switchToGlacierAccessTierAfterDays: number
    bucketsToImport: Array<string>
    createBucketsWithPrefix: string
    appendRegionToBucketName: boolean
    applyLoggingToMainBuckets: boolean
    applyInventoryToMainBuckets: boolean
    applyTransitionsToMainBuckets: boolean
}

export class PhotoArchiveBuckets extends Construct {

    public readonly mainBuckets: Array<s3.IBucket> = new Array<s3.IBucket>()
    public readonly loggingBucket?: s3.IBucket

    constructor(scope: Construct , id: string, props: PhotoArchiveBucketsProps){
        super(scope, id)

        const bucketNames = this.createBucketNames(props)
        const bucketArns = FormatUtils.convertBucketNamesToArns(bucketNames.mainBucketNames.concat(bucketNames.loggingBucketName))

        const bucketHandlerLambdaRole = new iam.Role(this, "BucketHandlerServiceRole",{
            roleName: "pa-buckethandler-service-role",
            description: "Assumed Role By pa-buckethandler-function",
            assumedBy: new iam.ServicePrincipal(ServicePrincipals.LAMBDA)
        })

        const bucketHandlerLambdaRoleS3Policy = new iam.Policy(this, "BucketHandlerServiceRoleS3Policy", {
            policyName: "pa-buckethandler-service-role-s3-policy",
            roles: [
                bucketHandlerLambdaRole
            ],
            statements: [
                new iam.PolicyStatement({
                    actions: [
                        's3:ListBucket',
                        's3:CreateBucket',
                        's3:DeleteBucket',
                        's3:PutEncryptionConfiguration',
                        's3:PutLifecycleConfiguration',
                        's3:PutBucketLogging',
                        's3:PutInventoryConfiguration',
                        's3:PutBucketOwnershipControls',
                        's3:PutBucketPublicAccessBlock',
                        's3:PutBucketPolicy',
                        's3:GetBucketPolicy'
                    ],
                    resources: bucketArns
                })
            ]
        })

        const bucketHandlerLambda = new lambda.Function(this, 'BucketHandlerFunction', {
            functionName: 'pa-buckethandler-function',
            description: 'Custom Resource Bucket Handling For Photo Archive',
            runtime: lambda.Runtime.PYTHON_3_8,
            handler: 'lambda_function.on_event',
            code: lambda.Code.fromAsset(path.join(__dirname, './res')),
            role: bucketHandlerLambdaRole,
            timeout: Duration.minutes(15)
        })

        const bucketHandlerResourceProvider = new cr.Provider(this, 'BucketHandlerProvider',{
            onEventHandler: bucketHandlerLambda,
            logRetention: logs.RetentionDays.ONE_DAY
        })

        const bucketHandlerCustomResource = new CustomResource(this, 'BucketHandlerCustomResource',{
            resourceType: 'Custom::BucketHandler',
            serviceToken: bucketHandlerResourceProvider.serviceToken,
            properties: {
                loggingBucketName: bucketNames.loggingBucketName,
                mainBucketNames: bucketNames.mainBucketNames,
                configuration: {
                    transitions: {
                        infrequentAccessDays: Number(props.switchToInfrequentAccessTierAfterDays),
                        glacierDays: Number(props.switchToGlacierAccessTierAfterDays)
                    },
                    applyTransitionsToMainBuckets: props.applyTransitionsToMainBuckets,
                    applyLoggingToMainBuckets: props.applyLoggingToMainBuckets,
                    applyInventoryToMainBuckets: props.applyInventoryToMainBuckets,
                }
            }
        })

        const loggingBucketArn = bucketHandlerCustomResource.getAtt('loggingBucketArn').toString()
        this.loggingBucket = s3.Bucket.fromBucketArn(this, 'LoggingBucketImport', loggingBucketArn)

        //const mainBucketArnsToken = bucketHandlerCustomResource.getAtt('bucketArns')
        //const mainBucketArns = Token.asList(mainBucketArnsToken)

        //for(const mainBucketArn of mainBucketArns){
        for(const mainBucketArn of FormatUtils.convertBucketNamesToArns(bucketNames.mainBucketNames)){
            const hash = HashUtil.generateIDSafeHash(mainBucketArn, 15)
            this.mainBuckets.push(
                s3.Bucket.fromBucketArn(this, 'MainBucketImport-' + hash, mainBucketArn)
            )
        }


    }

    private createBucketNames(props: PhotoArchiveBucketsProps): {mainBucketNames: Array<string>, loggingBucketName: string}{

        const mainBucketNames = new Array<string>()

        // if we have been given buckets to import, we use those
        if(props.bucketsToImport.length > 0){

            for(const bucketArn of props.bucketsToImport){
                const bucketName = bucketArn.substr(bucketArn.lastIndexOf(':'))
                mainBucketNames.push(bucketName)
            }

        // if not, we generate our own
        }else{
            
            let mainBucketName = `${props.createBucketsWithPrefix}-photo-archive`
            if(props.appendRegionToBucketName){
                mainBucketName += `-${Stack.of(this).region}`
            }

            mainBucketNames.push(mainBucketName)
        }

        // logging bucket name is always generated. Later decides whether it is created or not
        let loggingBucketName = `${props.createBucketsWithPrefix}-photo-archive-logging`
        if(props.appendRegionToBucketName){
            loggingBucketName += `-${Stack.of(this).region}`
        }

        return {
            mainBucketNames: mainBucketNames,
            loggingBucketName: loggingBucketName
        }

    }
}