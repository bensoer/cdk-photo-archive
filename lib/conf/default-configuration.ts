import { Features } from "../enums/features";
import { Regions } from "../enums/regions";
import { AbstractConfiguration } from "./abstract-configuration";
import { IConcreteSettings } from "./concrete-settings";
import { ISettings } from "./settings";


export class DefaultConfiguration extends AbstractConfiguration {

    

    public getConfiguration(): ISettings {
        return {
            /**
             * Stack names in AWS CloudFormation
             */
            photoArchiveStackName: "photo-archive-stack",
            appendDeploymentRegionToStackNames: true,
            
            /**
             * Resource Naming Prefix
             */
            namePrefix: "pt",

            /**
             * Bucket naming defaults
             */
            appendRegionToBucketName: true,
            bucketNamePrefix: "pt",
            useExistingBuckets: [],
    
            /**
             * Bucket archiving defaults
             */
            switchToInfrequentAccessTierAfterDays: 90,
            switchToGlacierAccessTierAfterDays: 120,
            applyTransitionsToMainBuckets: true, // whether to enable the archiving transitions
    
            /**
             * Bucket Inventory and event logging defaults
             */
            enableInventoryOfArchiveBuckets: true,
            enableLoggingOfArchiveBuckets: true,
    
            /**
             * DynamoDB Metrics Table Feature
             */
            enableDynamoMetricsTable: false,
    
             /**
              * List of features enabled - REQUIRED parameter so this should be overrided
              */
             features: [
                 Features.HASH_TAG,
                 Features.PHOTO_META_TAG,
                 Features.PHOTO_REKOG_TAG
             ],
        }
    }

    public createConcreteSettings(configuration: AbstractConfiguration): IConcreteSettings{
        const defaults = this.getConfiguration()
        const userConfiguration = configuration.getConfiguration()

        const concreteSettings: Record<string, any> = {}
        
        for(const [key, value] of Object.entries(defaults)){
            // check what the user has for this value
            const userSettingValue = userConfiguration[key]
            // if that value is undefined
            if(userSettingValue === undefined){
                // then assign it the default value
                concreteSettings[key] = value
            }else{
                // otherwise use the user's value
                concreteSettings[key] = userSettingValue
            }
        }

        return concreteSettings as IConcreteSettings

    }

}