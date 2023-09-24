

def is_feature_enabled(ssm_client, settings_prefix: str, feature_name:str) -> bool:
    try:
        FEATURE_ENABLED_SSM_KEY = "/{}/features/{}/enabled".format(settings_prefix, feature_name)
        print("common.is_feature_enabled - Fetching {}".format(FEATURE_ENABLED_SSM_KEY))
        response = ssm_client.get_parameter(
            Name=FEATURE_ENABLED_SSM_KEY
        )

        return response['Parameter']['Value'] == 'TRUE'
    except:
        return False