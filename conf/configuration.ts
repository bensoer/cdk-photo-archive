import { AbstractConfiguration } from "../lib/conf/abstract-configuration";
import { ISettings } from "../lib/conf/settings";
import { Features } from "../lib/enums/features";
import { Regions } from "../lib/enums/regions";


export class Configuration extends AbstractConfiguration{


    /**
     * getConfiguration returns the configuration details of the cdk-photo-archive deployment. There are a number
     * of required and optional parameters. Optional parameters have defaults that will be used if not supplied.
     * See README or /lib/conf/i-configuration.ts for details of all the available configurations and what they do.
     * @returns IConfiguration - object representing all of the configuration settings set to their desired values
     */
    public getConfiguration(): ISettings {
        return {
            /**
             * Stack names in AWS CloudFormation
             */
            photoArchiveStackName: "pt-photo-archive-stack",
            photoArchiveSettingsStackName: "pt-photo-archive-settings-stack",
            photoArchiveBucketsStackName: "pt-photo-archive-buckets-stack",

            /**
             * Append deployment region to the stack names
             */
            appendDeploymentRegionToStackNames: true,

            /**
             * List of Features to enable in the project. See /lib/enums/features.ts for all
             * available features
             */
            features: [
                Features.HASH_TAG,
                Features.PHOTO_META_TAG,
                Features.PHOTO_REKOG_TAG
            ],
            
            enableDynamoMetricsTable: false
        }
    }
}