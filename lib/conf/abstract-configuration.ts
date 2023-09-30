import { IConcreteSettings } from "./concrete-settings";
import { DefaultConfiguration } from "./default-configuration";
import { ISettings } from "./settings";




export abstract class AbstractConfiguration {

    private localSettingsCache: ISettings

    constructor(){
        this.localSettingsCache = this.getConfiguration()
    }

    /**
     * isExistingBuckets determines whether buckets have been defined in the configuration
     * to be imported for use with the cdk-phot-archive
     * @returns 
     */
    public isExistingBuckets(): boolean {
        return this.getConfiguration().useExistingBuckets !== undefined 
            && this.getConfiguration().useExistingBuckets!!.length > 0
    }

    


    public abstract getConfiguration(): ISettings

}