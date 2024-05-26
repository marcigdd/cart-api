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

export async function handler(event: APIGatewayProxyEvent, context: Context) {
  verbose('Event: %j', event);
  verbose('Context: %j', context);
  console.log('Event: ', event);
  console.log('Context: ', context);
  cachedServer = await bootstrap();
  return proxy(cachedServer, event, context, 'PROMISE').promise;
}
