import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import * as serverlessHttp from 'serverless-http';
import * as helmet from 'helmet';
import { AppModule } from './app.module';

async function createApp() {
  const app = await NestFactory.create(AppModule, new ExpressAdapter());
  app.enableCors({
    origin: (req, callback) => callback(null, true),
  });
  app.use(helmet());
  await app.init(); // Use app.init() instead of app.listen() for Lambda
  return app;
}

// Export the handler function for AWS Lambda
exports.handler = serverlessHttp(createApp);
