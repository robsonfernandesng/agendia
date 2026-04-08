import setupApp, { app } from '../server.js';

let isInitialized = false;

export default async (req: any, res: any) => {
  if (!isInitialized) {
    await setupApp();
    isInitialized = true;
  }
  return app(req, res);
};
