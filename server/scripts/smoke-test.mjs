import { setTimeout as delay } from 'node:timers/promises';

const baseUrl = process.env.API_BASE_URL ?? 'http://127.0.0.1:3001';

const waitForServer = async () => {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/health`);
      if (response.ok) {
        return;
      }
    } catch (error) {
      // ignore
    }
    await delay(500);
  }
  throw new Error(`Server not reachable at ${baseUrl}`);
};

const assertOk = async (path) => {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}`);
  }
};

const run = async () => {
  await waitForServer();
  await assertOk('/health');
  await assertOk('/api/status');
  console.log('Smoke tests passed.');
};

run().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
