import vm from 'node:vm';
import fs from 'node:fs/promises';
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

// ── Unauthenticated singleton ─────────────────────────────────────────────────
// Store the Promise (not the result) to avoid the race condition where two
// concurrent callers both see _promise === null and create two instances.
let _promise = null;

/** Returns the shared unauthenticated Innertube singleton. Safe to call concurrently. */
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

// ── Authenticated singleton (with cookies) ────────────────────────────────────
// Creating a new Innertube instance is EXPENSIVE (~15s): fetches /iframe_api,
// the full player JS, and runs JsAnalyzer. We do it once and reuse it.
// Cookies authenticate as a real browser session — required to bypass
// bot detection on Render datacenter IPs.
let _authedPromise = null;

/**
 * Parse a Netscape-format cookie file into a single `key=value; ...` string
 * suitable for the `cookie` option of Innertube.create().
 * @param {string} cookiesFilePath
 * @returns {Promise<string>}
 */
export const readCookieString = async (cookiesFilePath) => {
  try {
    const raw = await fs.readFile(cookiesFilePath, 'utf-8');
    return raw
      .split('\n')
      .filter((line) => line && !line.startsWith('#'))
      .map((line) => {
        const parts = line.split('\t');
        return parts.length >= 7 ? `${parts[5]}=${parts[6]}` : null;
      })
      .filter(Boolean)
      .join('; ');
  } catch {
    return '';
  }
};

/**
 * Returns the shared authenticated Innertube singleton (with cookies).
 * Creating a fresh instance costs ~15s — the result is cached indefinitely.
 * Falls back to the unauthenticated singleton if the authed instance fails.
 *
 * @param {string} cookiesFilePath  Path to a writable Netscape cookie file.
 * @returns {Promise<import('youtubei.js').Innertube>}
 */
export const getAuthedInnertube = (cookiesFilePath) => {
  if (_authedPromise) return _authedPromise;

  _authedPromise = (async () => {
    const cookieStr = await readCookieString(cookiesFilePath);
    const createOpts = {
      generate_session_locally: true,
      retrieve_player: true,
    };
    if (cookieStr) createOpts.cookie = cookieStr;
    try {
      const yt = await Innertube.create(createOpts);
      logger.info('Authenticated Innertube instance created');
      return yt;
    } catch (err) {
      logger.warn({ err: err.message }, 'Authed Innertube create failed, using shared singleton');
      _authedPromise = null; // allow retry next time
      return getInnertube();
    }
  })();

  return _authedPromise;
};
