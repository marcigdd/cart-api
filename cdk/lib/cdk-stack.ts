import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import path = require('path');

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a Lambda function with Node.js and your Nest.js application
    const nestJsFunction = new lambdaNodejs.NodejsFunction(
      this,
      'NestJsFunction',
      {
        entry: path.join(__dirname, '..', '..', 'dist', 'src', 'main.js'),
        handler: 'handler', // The exported handler in your entry point file
        runtime: lambda.Runtime.NODEJS_20_X,
        logRetention: cdk.aws_logs.RetentionDays.FIVE_DAYS,
        memorySize: 1256,
        timeout: cdk.Duration.seconds(10),
      },
    );

    const api = new apigw.LambdaRestApi(this, 'rest-api-gateway', {
      handler: nestJsFunction,
      restApiName: 'NestJsApiGateway',
      proxy: true,
      deploy: true,
    });
  }
}
