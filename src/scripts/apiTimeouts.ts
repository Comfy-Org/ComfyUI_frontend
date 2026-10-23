/**
 * The request bounds `api.fetchApi` enforces, in their own leaf module so that
 * a caller which must OUTLAST a request can derive its bound from the same
 * numbers instead of restating them.
 *
 * Deliberately not exported from `api.ts`: `src/scripts/__mocks__/api.ts` is
 * the manual mock every `vi.mock('@/scripts/api')` resolves to, and it exports
 * only `api` — so a constant read through that path arrives `undefined` and any
 * arithmetic on it silently becomes `NaN`. A `setTimeout` armed with `NaN`
 * fires immediately, which is exactly the failure a derived timeout must not
 * have. Importing from here keeps the real values under a mocked `api`.
 */

/** Ceiling on `ComfyApi.waitForAuthInitialization`, spent before the response timer below is armed. */
export const AUTH_INIT_TIMEOUT_MS = 10_000

/**
 * Response-HEADERS timeout for one `fetchApi` attempt — not the body. A 401
 * remint clears this timer and arms a fresh one for the retry, so a single
 * cloud request can spend it twice (`fetchWithUnifiedRemint`).
 */
export const FETCH_RESPONSE_HEADERS_TIMEOUT_MS = 60_000
