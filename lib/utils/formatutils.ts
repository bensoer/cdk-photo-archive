import {
    aws_s3 as s3,
    aws_lambda as lambda
} from 'aws-cdk-lib'


export class FormatUtils {

    public static convertBucketsToPolicyArns(buckets: Array<s3.IBucket>): Array<string> {
        return buckets.map((bucket) => "arn:aws:s3:*:*:" + bucket.bucketName)
    }

    public static convertBucketsToArns(buckets: Array<s3.IBucket>): Array<string> {
        return buckets.map((bucket) => bucket.bucketArn)
    }

    public static convertBucketNamesToArns(bucketNames: Array<string>): Array<string> {
        return bucketNames.map((bucketName) => "arn:aws:s3:::" + bucketName)
    }



    public static convertBucketsToNames(buckets: Array<s3.IBucket>): Array<string> {
        return buckets.map((bucket) => bucket.bucketName)
    }

    public static convertLambdasToArn(lambdas: Array<lambda.Function>): Array<string> {
        return lambdas.map((lambda) => lambda.functionArn)

    }
}