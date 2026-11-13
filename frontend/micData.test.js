import assert from 'node:assert/strict';
import { before, beforeEach, afterEach, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

let data;
let storageDescriptor;
const cachedMic = { id: 7, name: 'Cached mic', startDate: '2026-11-13', edit_version: 1 };
const liveMic = { ...cachedMic, name: 'Updated mic', edit_version: 2 };

before(async () => {
  const server = await createServer({
    configFile: false,
    envFile: false,
    root: fileURLToPath(new URL('.', import.meta.url)),
    server: { middlewareMode: true, watch: null },
    optimizeDeps: { noDiscovery: true, include: [] },
    define: { 'import.meta.env.VITE_MICFINDER_API_URL': JSON.stringify('http://micfinder.test') },
  });
  try {
    data = await server.ssrLoadModule('/src/micData.js');
  } finally {
    await server.close();
  }
});

beforeEach(() => {
  storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const values = new Map();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
    },
  });
});

afterEach(() => {
  if (storageDescriptor) Object.defineProperty(globalThis, 'localStorage', storageDescriptor);
  else delete globalThis.localStorage;
});

test('cached lists and details remain readable with the backend unavailable', async t => {
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Backend unavailable'); });
  data.cacheMics([cachedMic]);
  assert.deepEqual(await data.readMics(), [cachedMic]);
  assert.deepEqual(await data.readMic('7'), cachedMic);
  assert.deepEqual(await data.readMic(7, { mics: [liveMic] }), liveMic);
  data.cacheMics([]);
  assert.deepEqual(await data.readMics(), []);
});

test('cache misses fetch lists and individual mic details', async t => {
  t.mock.method(globalThis, 'fetch', async url => Response.json(
    url.endsWith('/mics') ? { mics: [liveMic] } : { mic: liveMic }
  ));
  assert.deepEqual(await data.readMics(), [liveMic]);
  assert.deepEqual(await data.readMic(7, { mics: [] }), liveMic);
});

test('fresh reads use current server data rather than cached edit versions', async t => {
  data.cacheMics([cachedMic]);
  t.mock.method(globalThis, 'fetch', async url => Response.json(
    url.endsWith('/mics') ? [liveMic] : { mic: liveMic }
  ));
  assert.deepEqual(await data.readMics({ fresh: true }), [liveMic]);
  assert.deepEqual(await data.readMic(7, { fresh: true, mics: [cachedMic] }), liveMic);
});

test('failed fresh reads never fall back to stale records for editing', async t => {
  data.cacheMics([cachedMic]);
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 503 }));
  await assert.rejects(data.readMic(7, { fresh: true }), /Failed to fetch/);
  await assert.rejects(data.readMics({ fresh: true }), /Failed to fetch/);
  assert.deepEqual(await data.readMic(7), cachedMic);
});

test('corrupt or unavailable storage does not prevent backend reads', async t => {
  t.mock.method(globalThis, 'fetch', async () => Response.json({ mics: [liveMic] }));
  const getItem = t.mock.method(localStorage, 'getItem', () => '{broken');
  assert.deepEqual(await data.readMics(), [liveMic]);
  getItem.mock.mockImplementation(() => { throw new Error('Storage disabled'); });
  assert.deepEqual(await data.readMics(), [liveMic]);
});
