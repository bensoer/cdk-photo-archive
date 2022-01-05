import { Features } from "../enums/features";


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

}