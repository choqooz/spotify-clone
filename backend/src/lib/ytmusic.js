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
    // youtubei.js v17 calls eval(data, eval_args) where `data` is an object
    // with an `output` property containing the player JS to execute. The
    // generated script ends with a top-level `return process(...)` from
    // getNsigProcessorFn, so we wrap it in an IIFE to make `return` valid.
    shim.eval = (data, _env) => {
      const source = typeof data === 'string' ? data : (data?.output ?? '');
      if (!source) throw new Error('eval shim: empty player script');
      const wrapped = `(function () {\n${source}\n})()`;
      const ctx = vm.createContext({});
      return vm.runInContext(wrapped, ctx, { timeout: 5000 });
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
