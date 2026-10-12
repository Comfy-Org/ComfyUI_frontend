/**
 * Wire-level websocket event the backend broadcasts when a seed scan's fast
 * (insert) phase completes — the moment newly scanned files' tags and loader
 * paths become queryable.
 */
export const ASSETS_SEED_FAST_COMPLETE_EVENT = 'assets.seed.fast_complete'
