import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigw from 'aws-cdk-lib/aws-apigateway';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as path from 'path';
import * as ec2 from 'aws-cdk-lib/aws-ec2';

export class CdkStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'VPC', {
      maxAzs: 3, // Default is all AZs in the region
      natGateways: 0, // Default is 1 NAT gateway per AZ
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'public-subnet',
          subnetType: ec2.SubnetType.PUBLIC, // Configure subnet as public
        },
        {
          cidrMask: 24,
          name: 'private-subnet',
          subnetType: ec2.SubnetType.PRIVATE_WITH_NAT, // Configure subnet as private with NAT
        },
      ],
    });

    const securityGroup = new ec2.SecurityGroup(this, 'SecurityGroup', {
      vpc, // Associate the security group with the VPC
      description: 'Allow traffic to RDS from Lambda function',
      allowAllOutbound: true, // Allow outbound traffic by default
    });

    // Define the RDS instance
    const dbInstance = new rds.DatabaseInstance(this, 'DBInstance', {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      securityGroups: [securityGroup],
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_16_2,
      }),
      allocatedStorage: 20,
      backupRetention: cdk.Duration.days(0),
      deletionProtection: false,
      maxAllocatedStorage: 100,
      multiAz: false,
      publiclyAccessible: true, // Make it publicly accessible for simplicity
      storageType: rds.StorageType.GP2,
      databaseName: 'mydb',
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T3,
        ec2.InstanceSize.MICRO,
      ),
    });

    // Create a Lambda function with Node.js and your Nest.js application
    const nestJsFunction = new lambda.Function(this, 'NestJsFunction', {
      vpc, // Assign the VPC to the Lambda funct
      allowPublicSubnet: true,
      vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT },
      securityGroups: [securityGroup],
      environment: {
        SECRET_ARN: dbInstance.secret?.secretArn || '',
      },
      code: lambda.Code.fromAsset(path.resolve(__dirname, '../cart-api.zip')),
      handler: 'dist/src/lambda.handler', // The exported handler in your entry point file
      runtime: lambda.Runtime.NODEJS_20_X,
      logRetention: cdk.aws_logs.RetentionDays.FIVE_DAYS,
      memorySize: 1256,
      timeout: cdk.Duration.seconds(5),
    });

    nestJsFunction.role?.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: [dbInstance.secret?.secretArn || ''],
      }),
    );

    // Create a VPC endpoint for Secrets Manager
    const secretManagerEndpoint = new ec2.InterfaceVpcEndpoint(
      this,
      'SecretsManagerEndpoint',
      {
        service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
        vpc,
        subnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_NAT },
      },
    );

    // Update the Lambda function's security group to allow outbound traffic to Secrets Manager
    const lambdaSecurityGroup = nestJsFunction.connections.securityGroups[0];
    secretManagerEndpoint.connections.allowFrom(
      lambdaSecurityGroup,
      ec2.Port.tcp(443),
    );

    const lambdaRole = new iam.Role(this, 'LambdaRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // Attach an inline policy granting access to Secrets Manager
    lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'], // Adjust resource ARN as needed
      }),
    );
    // Assign the IAM role to the Lambda function
    nestJsFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['secretsmanager:GetSecretValue'],
        resources: ['*'], // Adjust resource ARN as needed
      }),
    );

    // Create the API Gateway
    const api = new apigw.LambdaRestApi(this, 'rest-api-gateway', {
      handler: nestJsFunction,
      restApiName: 'NestJsApiGateway',
      proxy: true,
      deploy: true,
    });

    // Create the API Gateway
  }
}

const app = new cdk.App();
new CdkStack(app, 'CdkStack');
app.synth();
