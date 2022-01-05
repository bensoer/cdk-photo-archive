import { IConfiguration } from "./i-configuration";




export abstract class AbstractConfiguration {

    /**
     * isExistingBuckets determines whether buckets have been defined in the configuration
     * to be imported for use with the cdk-phot-archive
     * @returns 
     */
    public isExistingBuckets(): boolean {
        return this.getConfiguration().useExistingBuckets !== undefined 
            && this.getConfiguration().useExistingBuckets!!.length > 0
    }


    public abstract getConfiguration(): IConfiguration

}