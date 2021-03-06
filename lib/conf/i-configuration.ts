import { Features } from "../enums/features";
import { Regions } from "../enums/regions";


export interface IConfiguration {


    /**
     * A list of all the features to be enabled with this deployment
     */
    features: Array<Features>

    /**
     * Specify the ARNs of the buckets to import with the deployment of the cdk-photo-archive.
     * If this is left empty, the stack will create its own buckets for archiving with
     */
    useExistingBuckets?: Array<string>

    /**
     * Specify a custom prefix for the photo archive bucket and logging bucket names. 
     * Leave undefined for default value. Default value is "pt"
     */
    bucketNamePrefix?: string

    /**
     * Whether or not to append the region name to the bucket name. Leave undefined for default value
     * Default value is TRUE
     */
    appendRegionToBucketName?: boolean

    /**
     * Specify how many days before switching Bucket contents from Standard Tier to Infrequent Access Tier.
     * Set to 0 to skip this tier. This parameter is only valid when useExistingBuckets is undefined
     * Leave undefined for default value. Default value is 90 days
     */
    switchToInfrequentAccessTierAfterDays?: number
    
    /**
     * Specify how many days before switching Bucket contents to Glacier Access Tier.
     * Set to 0 to skip this tier. NOTE: By skipping this tier, nothing will ever be placed in Glacier Tier.
     * This parameter is only valid wehn useExistingBuckets is undefined.
     * Leave undefined for default value. Default value is 120 days
     */
    switchToGlacierAccessTierAfterDays?: number

    /**
     * Specify the name of the photo archive stack name in CloudFormation.
     * Leave blank to use default. Default name is "photo-archive-stack"
     */
    photoArchiveStackName?: string

    /**
     * Specify the name of the photo archive settings stack name in CloudFormation
     * Leave blank to use default. Default name is "photo-archive-settings-stack"
     */
    photoArchiveSettingsStackName?: string

    /**
     * Specify the name of the photo archive buckets stack name in CloudFormation
     * Leave blank to use default. Default name is "photo-archive-buckets-stack"
     */
    photoArchiveBucketsStackName?:string

    /**
     * Specify whetehr stack names should have their deployment region appended to them.
     * Leave blank to use default. Default value is TRUE
     * 
     * IF a custom stack name is provided and this value is TRUE, then the region will be appended to the custom name
     * IF the default stack name is used and this value is TRUE, then the region will be appended to the default name
     */
    appendDeploymentRegionToStackNames?:boolean

    /**
     * Region the cdk will be deployed to
     */
    deploymentRegion: Regions

}