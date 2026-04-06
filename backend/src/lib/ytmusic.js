import { Innertube } from 'youtubei.js';
import { logger } from './logger.js';

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
