import { Features } from "../enums/features";
import { Regions } from "../enums/regions";


export interface IConcreteSettings extends Record<string, any> {

    features: Array<Features>

    useExistingBuckets: Array<string>

    bucketNamePrefix: string

    appendRegionToBucketName: boolean

    switchToInfrequentAccessTierAfterDays: number
    
    switchToGlacierAccessTierAfterDays: number

    photoArchiveStackName: string

    photoArchiveSettingsStackName: string

    photoArchiveBucketsStackName:string

    appendDeploymentRegionToStackNames:boolean

    deploymentRegion: Regions

    enableDynamoMetricsTable: boolean

    enableLoggingOfArchiveBuckets: boolean

    enableInventoryOfArchiveBuckets: boolean

    applyTransitionsToMainBuckets: boolean

}