import { Duration, RemovalPolicy, Stack, StackProps } from 'aws-cdk-lib';
import { 
    aws_s3 as s3,
} from 'aws-cdk-lib'
import { Construct } from "constructs";
import { Context } from "vm";
import { Configuration } from "../../../conf/configuration";
import { IConfiguration } from "../../conf/i-configuration";

export interface PhotoArchiveBucketsProps {
    defaultInfrequentAccessTransitionDuration: Duration,
    defaultGlacierAccessTransitionDuration: Duration,
    switchToInfrequentAccessTierAfterDays?: number,
    switchToGlacierAccessTierAfterDays?: number,
    createBuckets: boolean,
    bucketsToImport?: Array<string>
    createBucketsWithPrefix?: string
}

export class PhotoArchiveBuckets extends Construct {

    public readonly mainBucket: s3.Bucket
    public readonly loggingBucket: s3.Bucket

    constructor(scope: Construct , id: string, props: PhotoArchiveBucketsProps){
        super(scope, id)

        if(props.createBuckets){

            let prefix = "pt"
            if(props.createBucketsWithPrefix !== undefined){
                prefix = props.createBucketsWithPrefix
            }

            this.loggingBucket = new s3.Bucket(this, `${prefix}-pa-logging-bucket-id`, {
              bucketName: `${prefix}-photo-archive-logging-us-east-1`,
              encryption: s3.BucketEncryption.S3_MANAGED,
              enforceSSL: true,
              
              // temp to make building and destroying easier
              //autoDeleteObjects: true,
              removalPolicy: RemovalPolicy.RETAIN,
        
              publicReadAccess: false,
              blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL
            })
      
            this.mainBucket = new s3.Bucket(this, `${prefix}-pa-main-bucket-id`, {
              bucketName: `${prefix}-photo-archive-us-east-1`,
              encryption: s3.BucketEncryption.S3_MANAGED,
              enforceSSL: true,
        
              // temp to make building and destroying easier
              //autoDeleteObjects: true,
              removalPolicy: RemovalPolicy.RETAIN,
        
              serverAccessLogsBucket: this.loggingBucket,
              serverAccessLogsPrefix: 'photo-archive-logs',
              publicReadAccess: false,
              blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
              inventories: [
                {
                  frequency: s3.InventoryFrequency.WEEKLY,
                  includeObjectVersions: s3.InventoryObjectVersion.CURRENT,
                  destination: {
                    bucket: this.loggingBucket,
                    prefix: 'photo-archive-inventory'
                  }
                }
              ],
              lifecycleRules: this.generateLifecycleRules(props),
            })
        }else{
            // now we import the buckets
            // TODO: Import the buckets


        }

    }

    private generateLifecycleRuleTransitions(
        switchToInfrequentAccessTierAfterDays: number | undefined,
        switchToGlacierAccessTierAfterDays: number | undefined,
        defaultInfrequentAccessTransitionDuration: Duration,
        defaultGlacierAccessTransitionDuration: Duration ): s3.Transition[] {

        const transitions:s3.Transition[] = []
      
        if(switchToInfrequentAccessTierAfterDays !== undefined 
            && switchToInfrequentAccessTierAfterDays > 0){
    
            transitions.push(
                {
                    storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                    transitionAfter: Duration.days(switchToInfrequentAccessTierAfterDays)
                }
            )
        }else if(switchToInfrequentAccessTierAfterDays === undefined){
            transitions.push(
                {
                    storageClass: s3.StorageClass.INFREQUENT_ACCESS,
                    transitionAfter: defaultInfrequentAccessTransitionDuration
                }
            )
        }
    
        if(switchToGlacierAccessTierAfterDays !== undefined
            && switchToGlacierAccessTierAfterDays > 0){
    
            transitions.push(
                {
                    storageClass: s3.StorageClass.GLACIER,
                    transitionAfter: Duration.days(switchToGlacierAccessTierAfterDays)
                }
            )
        }else if(switchToGlacierAccessTierAfterDays === undefined){
            transitions.push(
                {
                    storageClass: s3.StorageClass.GLACIER,
                    transitionAfter: defaultGlacierAccessTransitionDuration
                }
            )
        }

        return transitions
    }

    private generateLifecycleRules(props: PhotoArchiveBucketsProps): s3.LifecycleRule[] | undefined {

        const transitions = this.generateLifecycleRuleTransitions(
            props.switchToInfrequentAccessTierAfterDays,
            props.switchToGlacierAccessTierAfterDays,
            props.defaultInfrequentAccessTransitionDuration,
            props.defaultGlacierAccessTransitionDuration
        )

        if(transitions.length > 0){
            return [
                {
                  enabled: true,
                  id: 'photo-archive-lifecycle-transitions',
                  transitions:transitions
                }
              ]
        }else{
            return undefined
        }

    }
}