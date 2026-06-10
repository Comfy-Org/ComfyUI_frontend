/**
 * Reserved asset tags used by the assets API.
 * Kept dependency-free so components can import them without pulling in
 * the asset service's network/i18n import chain.
 */
export const MODELS_TAG = 'models'
export const INPUT_TAG = 'input'
export const OUTPUT_TAG = 'output'
/** Asset tag used by the backend for temporary (preview) workflow outputs. */
export const TEMP_TAG = 'temp'
/** Asset tag used by the backend for placeholder records that are not installed. */
export const MISSING_TAG = 'missing'
