/**
 * Test runner. No dependencies: `npm test` works on a clean clone.
 * Exits non-zero on failure so CI (when there is any) can gate on it.
 */
import { run } from './harness.js';

// Storage and truck handlers reach for browser globals; give them a stub so the
// core logic can be exercised in Node.
globalThis.window = globalThis;

await import('./yard.test.js');
await import('./fleet.test.js');
await import('./routing.test.js');
await import('./oversize.test.js');
await import('./routebook.test.js');
await import('./defaultroutes.test.js');
await import('./parking.test.js');
await import('./dispatch.test.js');
await import('./transtainer.test.js');

const failed = await run();
process.exit(failed > 0 ? 1 : 0);
