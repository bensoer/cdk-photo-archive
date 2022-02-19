import logging
import boto3
import botocore


'''
    Properties Structure:

    {
        loggingBucketName: string, (could be undefined)
        mainBucketNames: list<string>,
        configuration : {
            transitions: {
                infrequentAccessDays: number,
                glacierDays: number
            },
            applyTransitionsToMainBuckets: boolean,
            applyLoggingToMainBuckets: boolean,
            applyInventoryToMainBuckets: boolean,

        }
    }
    
'''


s3_client = boto3.client('s3')
aws_account_id = ""

def on_event(event, context):
    print(event)
    aws_account_id = context.invoked_function_arn.split(":")[4]
    request_type = event['RequestType']
    if request_type == 'Create': return on_create(event)
    if request_type == 'Update': return on_update(event)
    if request_type == 'Delete': return on_delete(event)
    raise Exception("Invalid request type: %s" % request_type)


def create_bucket(bucket_name)->str:

    # Create the bucket
    s3_client.create_bucket(
        ACL="private",
        Bucket=bucket_name
    )

    # Enable Bucket Encryption
    s3_client.put_bucket_encryption(
        Bucket=bucket_name,
        ServerSideEncryptionConfiguration={
            'Rules':[
                {
                    'ApplyServerSideEncryptionByDefault': {
                        'SSEAlgorithm': 'AES256'
                    },
                    'BucketKeyEnabled': False
                }
            ]
        }
    )

    s3_client.put_public_access_block(
        Bucket=bucket_name,
        PublicAccessBlockConfiguration = {
            'BlockPublicAcls': True,
            'IgnorePublicAcls': True,
            'BlockPublicPolicy': True,
            'RestrictPublicBuckets': True
        }
    )

    return "arn:aws:s3:::{}".format(bucket_name)

def create_lifecycle(bucket_name:str, lifecycle_config:dict):
    
    s3_client.put_bucket_lifecycle_configuration(
        Bucket=bucket_name,
        LifecycleConfiguration = {
            'Rules': [
                {
                    'ID': 'archiving-lifecycle-transitions',
                    'Status': 'Enabled',
                    'Filter': {
                        # Filter nothing as we apply this to everything
                        'Prefix': ''
                    },
                    'Transitions': [
                        # Transition To Infrequent Access
                        {
                            'Days': int(lifecycle_config["infrequentAccessDays"]),
                            'StorageClass': 'STANDARD_IA'
                        },
                        # Transition To Glacier
                        {
                            'Days': int(lifecycle_config["glacierDays"]),
                            'StorageClass': 'GLACIER'
                        }
                    ]
                }
            ]
        }
    )

def delete_lifecycle(bucket_name:str):

    s3_client.delete_bucket_lifecycle(
        Bucket=bucket_name
    )

def setup_logging(bucket_name, logging_bucket_name):
    s3_client.put_bucket_logging(
        Bucket=bucket_name,
        BucketLoggingStatus={
            'LoggingEnabled': {
                'TargetBucket': logging_bucket_name,
                'TargetPrefix': '{}-photo-archive-logs/'.format(bucket_name)
            }
        }
    )

def delete_logging(bucket_name):
    s3_client.put_bucket_logging(
        Bucket=bucket_name,
        BucketLoggingStatus={}
    )

def setup_inventory(bucket_name, logging_bucket_name):

    s3_client.put_bucket_inventory_configuration(
        Bucket=bucket_name,
        Id="{}-inventory-configuration".format(bucket_name),
        InventoryConfiguration = {
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
            ]
        }
    )

def delete_inventory(bucket_name):

    # TODO: Possibility of deleting an inventory that doesn't exist ?

    s3_client.delete_bucket_inventory_configuration(
        Bucket=bucket_name,
        Id="{}-inventory-configuration".format(bucket_name)
    )


def setup_main_buckets(main_bucket_names:list, config:dict)->list:

    main_bucket_arns = list()

    for main_bucket_name in main_bucket_names:
        try:
            s3_client.head_bucket(
                Bucket=main_bucket_name
            )
            # Already exists, so import it
            main_bucket_arns.append("arn:aws:s3:::{}".format(main_bucket_name))

        except botocore.exceptions.ClientError as ce:
            print("Main Bucket Does Not Exist")
            print(ce)

            # Create the main bucket
            created_bucket_arn = create_bucket(main_bucket_name)
            main_bucket_arns.append(created_bucket_arn)
            # Create Lifecycle Configuration
            if config["applyTransitionsToMainBuckets"]:
                create_lifecycle(main_bucket_name, config["transitions"])
    
    return main_bucket_arns

def setup_logging_bucket(logging_bucket_name:str, main_bucket_names:list, config:dict)->str:
    logging_bucket_arn = ""
    
    try:
        s3_client.head_bucket(
            Bucket=logging_bucket_name
        )
        # Already exists, so import it
        logging_bucket_arn = "arn:aws:s3:::{}".format(logging_bucket_name)

    except botocore.exceptions.ClientError as ce:
        print("Logging Bucket Does Not Exist. Creating")
        print(ce)

        # Create the logging bucket
        logging_bucket_arn = create_bucket(logging_bucket_name)
        if main_bucket_names is not None and len(main_bucket_names) > 0:
            for main_bucket_name in main_bucket_names:
                if config["applyLoggingToMainBuckets"]:
                    setup_logging(main_bucket_name, logging_bucket_name)
                if config["applyInventoryToMainBuckets"]:
                    setup_inventory(main_bucket_name, logging_bucket_name)

    return logging_bucket_arn

def on_create(event):
    props = event["ResourceProperties"]
    print("create new resource with props %s" % props)

    
    loggingBucketName = props["loggingBucketName"] #string
    mainBucketNames = props["mainBucketNames"] # list
    config = props["configuration"]

    loggingBucketArn = ""
    main_bucket_arns = list()

    
    if mainBucketNames is not None and len(mainBucketNames) > 0:
        main_bucket_arns.extend(setup_main_buckets(mainBucketNames, config))
        
    if loggingBucketName is not None and config["applyLoggingToMainBuckets"]:
        loggingBucketArn = setup_logging_bucket(loggingBucketName, mainBucketNames, config)
        
    return { 
        "Status": "SUCCESS", 
        "Data": {
            "bucketArns": main_bucket_arns,
            "loggingBucketArn": loggingBucketArn
        }
    }

def on_update(event):
    physical_id = event["PhysicalResourceId"]
    props = event["ResourceProperties"]
    oldProps = event["OldResourceProperties"]
    print("update resource %s with props %s" % (physical_id, props))

    oldLoggingBucketName = oldProps["loggingBucketName"]
    oldMainBucketNames = oldProps["mainBucketNames"]
    oldConfig = oldProps["configuration"]

    loggingBucketArn = ""
    loggingBucketName = props["loggingBucketName"] #string
    mainBucketNames = props["mainBucketNames"] # list
    config = props["configuration"]

    main_bucket_arns = list()

    # If these settings have changed, we should delete them first then have them re-setup
    if oldConfig["applyLoggingToMainBuckets"] != config["applyLoggingToMainBuckets"]:
        for main_bucket_name in mainBucketNames:
            delete_logging(main_bucket_name)
    if oldConfig["applyInventoryToMainBuckets"] != config["applyInventoryToMainBuckets"]:
        for main_bucket_name in mainBucketNames:
            delete_inventory(main_bucket_name)
    if oldConfig["applyTransitionsToMainBuckets"] != config["applyTransitionsToMainBuckets"]:
        for main_bucket_name in mainBucketNames:
            delete_lifecycle(main_bucket_name)

    if mainBucketNames is not None:
        main_bucket_arns.extend(setup_main_buckets(mainBucketNames, config))
        
    if loggingBucketName is not None:
        loggingBucketArn = setup_logging_bucket(loggingBucketName, mainBucketNames, config)


    return { 
        "Status": "SUCCESS", 
        "PhysicalResourceId": physical_id,
        "Data": {
            "bucketArns": main_bucket_arns,
            "loggingBucketArn": loggingBucketArn
        }
    }

def on_delete(event):
    print("Deleting Buckets. Photo Archive Does Not Delete Anything.")
    physical_id = event["PhysicalResourceId"]
    props = event["ResourceProperties"]
    print("delete resource %s" % physical_id)
    

    return { 
        "Status": "SUCCESS", 
        "PhysicalResourceId": physical_id
    }