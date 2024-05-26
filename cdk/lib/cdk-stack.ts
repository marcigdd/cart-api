import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import path = require('path');

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a Lambda function with Node.js and your Nest.js application
    const nestJsFunction = new lambda.Function(this, 'NestJsFunction', {
      code: lambda.Code.fromAsset(
        path.resolve(__dirname, '../cart-api.zip'),
      ),
      handler: 'dist/src/lambda.handler', // The exported handler in your entry point file
      runtime: lambda.Runtime.NODEJS_20_X,
      logRetention: cdk.aws_logs.RetentionDays.FIVE_DAYS,
      memorySize: 1256,
      timeout: cdk.Duration.seconds(10),
    });

    const api = new apigw.LambdaRestApi(this, 'rest-api-gateway', {
      handler: nestJsFunction,
      restApiName: 'NestJsApiGateway',
      proxy: true,
      deploy: true,
    });
  }
}
