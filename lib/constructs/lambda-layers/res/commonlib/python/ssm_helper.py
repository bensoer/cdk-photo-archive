class SSMHelper:

    def __init__(self, client) -> None:
        self.client = client

    def parameter_exists(self, parameter_key) -> bool:
        try:
            self.get_parameter(parameter_key)
            return True
        except self.client.exceptions.ParameterNotFound as error: 
            return False
        except self.client.exceptions.ParameterVersionNotFound as error: 
            return False
        except self.client.exceptions.InvalidKeyId as error: 
            return False

    def get_parameter(self, parameter_key) -> str:
        response = self.client.get_parameter(
            Name=parameter_key
        )
        return response['Parameter']['Value']
