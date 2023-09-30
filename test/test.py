import boto3

session = boto3.Session(profile_name='default')
s3_client = boto3.client('s3')

print("client init worked!")

bucket_name = "pt-photo-archive-us-east-1"
logging_bucket_name = "pt-photo-archive-logging-us-east-1"
aws_account_id = "445477118420"

'''
s3_client.put_bucket_inventory_configuration(
        Bucket=bucket_name,
        Id="{}-inventory-configuration".format(bucket_name),
        InventoryConfiguration={
            'Id': "{}-inventory-configuration".format(bucket_name),
            'Destination': {
                'S3BucketDestination' : {
                    'AccountId': aws_account_id,
                    'Bucket': logging_bucket_name,
                    'Format': 'CSV',
                    'Prefix': "{}-inventory".format(bucket_name),
                    'Encryption': {
                        'SSES3': {}
                    }
                }
            },
            'IsEnabled': True,
            'IncludedObjectVersions': 'Current',
            'Schedule': {
                'Frequency': 'Weekly'
            },
            'Filter': {
                'Prefix': ''
            },
            'OptionalFields': []
        }
    )
'''

'''
s3_client.put_bucket_inventory_configuration(
    Bucket=bucket_name,
    Id="{}-inventory-configuration".format(bucket_name),
    InventoryConfiguration={
        'Destination': {
            'S3BucketDestination': {
                'AccountId': aws_account_id,
                'Bucket': 'arn:aws:s3:::' + logging_bucket_name,
                'Format': 'CSV',
                'Prefix': "{}-inventory".format(bucket_name),
                'Encryption': {
                    'SSES3': {}
                }
            }
        },
        'IsEnabled': True,
        'Id': "{}-inventory-configuration".format(bucket_name),
        'IncludedObjectVersions': 'Current',
        'OptionalFields': [
            'Size',
            'LastModifiedDate',
            'StorageClass',
            'ETag',
            'IsMultipartUploaded',
            'ReplicationStatus',
            'EncryptionStatus',
            'ObjectLockRetainUntilDate',
            'ObjectLockMode',
            'ObjectLockLegalHoldStatus',
            'IntelligentTieringAccessTier',
            'BucketKeyStatus'
        ],
        'Schedule': {
            'Frequency': 'Weekly'
        }
    }
)
'''

response = s3_client.get_bucket_notification_configuration(
    Bucket=bucket_name
)
print(response)
