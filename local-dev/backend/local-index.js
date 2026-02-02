import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';

import { initDatabase } from './db.js';
import { registerApiRoutes } from './routes.js';

const app = Fastify({ logger: true });

const registerPlugins = async () => {
  await app.register(cors, {
    origin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:4173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await app.register(cookie, {
    secret: process.env.COOKIE_SECRET ?? 'dev-cookie-secret-change-me',
  });

  await app.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
  });
};

const registerDecorators = () => {
  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (error) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.decorate('requireRoles', (allowedRoles) => async (request, reply) => {
    await app.authenticate(request, reply);
    if (reply.sent) {
      return;
    }

    const userId = request.user?.id;
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' });
    }

    const roles = await app.db.all(
      `SELECT roles.name
         FROM user_roles
         JOIN roles ON roles.id = user_roles.role_id
        WHERE user_roles.user_id = ?`,
      [userId]
    );
    const roleNames = roles.map((role) => role.name);
    const hasRole = allowedRoles.some((role) => roleNames.includes(role));
    if (!hasRole) {
      return reply.code(403).send({ error: 'Forbidden' });
    }
  });
};

const registerRoutes = () => {
  app.get('/health', async () => ({ status: 'ok' }));
  app.get('/api/status', async () => ({
    service: 'Arcadia Clash Backend (Local)',
    version: '0.1.0-local',
    environment: process.env.NODE_ENV ?? 'development',
  }));

  registerApiRoutes(app);
};

const start = async () => {
  try {
    const port = Number(process.env.PORT ?? 3001);
    const host = process.env.HOST ?? '0.0.0.0';

    const { db, resolvedPath } = await initDatabase();
    app.decorate('db', db);
    app.decorate('dbPath', resolvedPath);

    await registerPlugins();
    registerDecorators();
    registerRoutes();

    app.addHook('onClose', async (instance) => {
      await instance.db.close();
    });

    await app.listen({ port, host });
    app.log.info(`Local server listening on http://${host}:${port}`);
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();
