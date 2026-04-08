import serverless from 'serverless-http';
import setupApp, { app } from '../../server.js';

let isInitialized = false;

export const handler = async (event: any, context: any) => {
  try {
    if (!isInitialized) {
      console.log('Initializing Agendia API...');
      await setupApp();
      isInitialized = true;
      console.log('API Initialized successfully.');
    }
    
    const h = serverless(app);
    return await h(event, context);
  } catch (error) {
    console.error('CRITICAL ERROR in Netlify Function:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal Server Error', details: String(error) })
    };
  }
};
