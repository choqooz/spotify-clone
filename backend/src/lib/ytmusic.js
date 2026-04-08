import vm from 'node:vm';
import { Innertube, Platform } from 'youtubei.js';
import { logger } from './logger.js';

// youtubei.js v17 ships with a no-op JS evaluator on the default platform shim,
// which means downloads from the WEB client fail with "To decipher URLs, you
// must provide your own JavaScript evaluator". Patch the shim to use Node's
// built-in vm module so player signatures can be deciphered.
try {
  const shim = Platform.shim;
  if (shim) {
    shim.eval = (code, env = {}) => {
      const ctx = vm.createContext({ ...env });
      return vm.runInContext(code, ctx, { timeout: 5000 });
    };
    logger.info('Patched youtubei.js Platform.shim.eval with Node vm');
  }
} catch (err) {
  logger.warn({ err: err.message }, 'Failed to patch youtubei.js eval shim');
}

// Store the Promise (not the result) to avoid the race condition where two
// concurrent callers both see _promise === null and create two instances.
let _promise = null;

/** Returns the shared Innertube singleton. Safe to call concurrently. */
export const getInnertube = () => {
  if (!_promise) {
    _promise = Innertube.create({
      generate_session_locally: true,
      retrieve_player: true, // required for streaming URL resolution
    });
  }
  return _promise;
};

// Warm up immediately so the first real request doesn't pay the init cost.
getInnertube().catch((err) => {
  logger.error({ err: err.message }, '❌ Failed to initialize Innertube');
  _promise = null; // allow retry on next request
});
