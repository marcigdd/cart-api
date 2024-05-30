import { Context } from 'vm';

// lambda/index.js
import * as AWS from 'aws-sdk';

exports.handler = async function (event: any, context: Context) {
  const secretsManager = new AWS.SecretsManager();
  console.log('Event:', event);
  const secretName = process.env.SECRET_NAME ?? '';
  console.log(secretName);

  try {
    const data = await secretsManager
      .getSecretValue({ SecretId: secretName })
      .promise();
    console.log('Secret:', data.SecretString);
  } catch (err) {
    console.error('Error retrieving secret:', err);
  }
};
