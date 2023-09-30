import { config } from "process";
import { Configuration } from "../../conf/configuration";
import { AbstractConfiguration } from "./abstract-configuration";
import { IConcreteSettings } from "./concrete-settings";
import { DefaultConfiguration } from "./default-configuration";


export class ConfigurationSingletonFactory{

    private static instance: AbstractConfiguration

    private constructor(){

    }

    public static getInstance(): AbstractConfiguration {
        if(ConfigurationSingletonFactory.instance === undefined){
            ConfigurationSingletonFactory.instance = new Configuration()
        }

        return ConfigurationSingletonFactory.instance
    }

    public static getConcreteSettings(): IConcreteSettings {
        const configuration = this.getInstance()

        const defaultConfiguration = new DefaultConfiguration()
        return defaultConfiguration.createConcreteSettings(configuration)

    }


}