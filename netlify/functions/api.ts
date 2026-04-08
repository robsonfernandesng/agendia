import serverless from 'serverless-http';
import setupApp, { app } from '../../server.js';

let isInitialized = false;

export const handler = async (event: any, context: any) => {
  if (!isInitialized) {
    await setupApp();
    isInitialized = true;
  }
  
  const h = serverless(app);
  return h(event, context);
};
