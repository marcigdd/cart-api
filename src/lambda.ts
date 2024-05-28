import { APIGatewayProxyEvent, Context } from 'aws-lambda';

import * as debug from 'debug';
import * as express from 'express';
import { Server } from 'http';
import { AppModule } from './app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { eventContext } from 'aws-serverless-express/middleware';
import * as helmet from 'helmet';
import { createServer, proxy } from 'aws-serverless-express';
import { Client } from 'pg';
import * as AWS from 'aws-sdk';

const verbose = debug('api:verbose handler');
let cachedServer: Server;

const bootstrap = async () => {
  if (!cachedServer) {
    const expressApp = express();
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      { cors: true, logger: ['error', 'warn', 'log', 'verbose', 'debug'] },
    );
    app.setGlobalPrefix('cart');
    app.use(eventContext());
    app.use(helmet());
    app.use(helmet.noSniff());
    app.use(helmet.hidePoweredBy());
    app.use(helmet.contentSecurityPolicy());
    await app.init();
    cachedServer = createServer(expressApp, undefined);
  }
  return cachedServer;
};

const setDBPasswordFromSecretsManager = async () => {
  console.log(AWS.SecretsManager);
  console.log('Secret ARN: ', process.env.SECRET_ARN);
  const secretsManager = new AWS.SecretsManager({
    region: 'us-east-2', // Replace with your AWS region
  });
  console.log('secretsManageer'); // Create Secrets Manager instance
  const dbSecretArn = process.env.SECRET_ARN;

  if (dbSecretArn) {
    // Fetch secret value from Secrets Manager
    console.time('getSecretValue');
    const data = await secretsManager
      .getSecretValue({ SecretId: dbSecretArn })
      .promise();
    console.timeEnd('getSecretValue');
    const secret = JSON.parse(data.SecretString || '');
    console.log('Secret: ', secret);
    const dbPassword = secret.password;
    process.env.DB_PASSWORD = dbPassword;
    return secret; // Set DB password as environment variable
  } else {
    console.error('DB_SECRET_ARN environment variable not set.');
  }
};

export async function handler(event: APIGatewayProxyEvent, context: Context) {
  verbose('Event: %j', event);
  verbose('Context: %j', context);
  console.log('Event: ', event);
  console.log('Context: ', context);
  console.log('Secret: ', process.env.SECRET_ARN);
  let secret: any;
  try {
    secret = await setDBPasswordFromSecretsManager();
  } catch (error) {
    console.error('Error setting DB password from Secrets Manager: ', error);
  }
  // console.log('SecretsManager: ', secretsManager);
  // const secretData = await secretsManager
  //   .getSecretValue({
  //     SecretId: process.env.SECRET_ARN,
  //   })
  //   .promise();
  // const secret = JSON.parse(secretData.SecretString);
  console.log('trying to connect to pg client: ');
  const client = new Client({
    host: secret.host,
    port: secret.port,
    database: secret.dbname,
    user: secret.username,
    password: secret.password,
  });
  console.log('client: ', client);

  await client.connect();

  console.log('connected to pg client: ');

  // Run your queries here, for example:
  const res = await client.query('SELECT NOW()');
  console.log(res.rows[0].now);

  await client.end();
  console.log('Secret: ', secret);

  console.log('Result: ', res);
  cachedServer = await bootstrap();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
}
