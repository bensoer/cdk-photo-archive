import { Features } from "../enums/features";
import { Regions } from "../enums/regions";


export interface ISettings extends Record<string, any> {


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
     * Specify a custom prefix for photo archive components where appropriate. 
     * Leave undefined for detault value. Default value is "pt"
     */
    namePrefix?: string

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
     * Specify whetehr stack names should have their deployment region appended to them.
     * Leave blank to use default. Default value is TRUE
     * 
     * IF a custom stack name is provided and this value is TRUE, then the region will be appended to the custom name
     * IF the default stack name is used and this value is TRUE, then the region will be appended to the default name
     */
    appendDeploymentRegionToStackNames?:boolean


    /**
     * Enable/Disable the dynamo metrics table. This is a table that will store verbose detailed information about each
     * photo processed by each of the feature methods. Additional information that is not tagged, will be stored and
     * can be queries from here. Leave undefined for default value. Default value is FALSE
     */
    enableDynamoMetricsTable?: boolean

    /**
     * Enable/Disable S3 Bucket Logging on the Archive Buckets. This includes both created and imported buckets. This will 
     * create a logging bucket which will have all actions done on the archive buckets logged to it. Leave undefined for 
     * default value. Default value is TRUE
     */
    enableLoggingOfArchiveBuckets?: boolean

    /**
     * Enable/Disable S3 Bucket Inventories on the Archive Buckets. This includes both created and imported buckets. This will create
     * a logging bucket which will have weekly inventories of all archive buckets stored in it. Leave undefined for
     * default value. Default value is TRUE
     */
    enableInventoryOfArchiveBuckets?: boolean

    /**
     * Enable Transition settings to the S3 Main Buckets. Set this value to false if you would like to apply your own transitions to your
     * own buckets. This may be useful if you are importing existing buckets and do not want their transition settings to be overridden.
     * 
     * NOTE: IF set to False, switchToInfrequentAccessTierAfterDays and switchToGlacierAccessTierAfterDays will have no point. They can still
     * be set, but their value will not be applied to any buckets as transitions will not be applied.
     * 
     * Leave undefined for default value. Default value is TRUE
     */
    applyTransitionsToMainBuckets?: boolean

}