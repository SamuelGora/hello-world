import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';

import { initDatabase } from './db.js';
import { registerApiRoutes } from './routes.js';

const app = Fastify({
  logger: true,
});

app.get('/health', async () => {
  return { status: 'ok' };
});

app.get('/api/status', async () => {
  return {
    service: 'Arcadia Clash Backend',
    version: '0.1.0',
    environment: process.env.NODE_ENV ?? 'development',
  };
});

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3001);
    const host = process.env.HOST ?? '0.0.0.0';
    const { db, resolvedPath } = await initDatabase();

    app.decorate('db', db);
    app.decorate('dbPath', resolvedPath);

    await app.register(cookie, {
      secret: process.env.COOKIE_SECRET ?? 'dev-cookie-secret-change-me',
    });

    await app.register(jwt, {
      secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    });

    app.addHook('onClose', async (instance) => {
      await instance.db.close();
    });

    registerApiRoutes(app);

    await app.listen({ port, host });
    app.log.info(`Server listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
