import { AbstractConfiguration } from "../lib/conf/abstract-configuration";
import { IConfiguration } from "../lib/conf/i-configuration";
import { Features } from "../lib/enums/features";


export class Configuration extends AbstractConfiguration{


    public getConfiguration(): IConfiguration {
        return {
            features: [
                Features.HASH_TAG,
                Features.PHOTO_META_TAG,
                // Features.PHOTO_REKOG_TAG - Currently Not Available
            ],
        }
    }
}