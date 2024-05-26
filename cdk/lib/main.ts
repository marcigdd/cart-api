export async function handler(event: any, context: any) {
  console.log('Hello from test handler');
  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'Hello from test handler' }),
  };
}
