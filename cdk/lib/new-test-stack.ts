import * as cdk from 'aws-cdk-lib/core';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export class MyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create a new VPC
    const vpc = new ec2.Vpc(this, 'MyVPC', { maxAzs: 2 });

    // vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
    //   service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    // });

    // Create a new secret in Secrets Manager
    const secret = new secretsmanager.Secret(this, 'MySecret');

    // Create a new Lambda function and attach it to the VPC
    const fn = new lambda.Function(this, 'MyFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset('lambda'),
      vpc,
      environment: {
        SECRET_NAME: secret.secretName,
      },
    });

    // Grant the Lambda function access to the secret
    secret.grantRead(fn);
  }
}
