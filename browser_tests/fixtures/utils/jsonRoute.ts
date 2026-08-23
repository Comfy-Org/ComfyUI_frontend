/**
 * Build a 200 JSON body for `route.fulfill()`. Generic so callers can type the
 * payload (e.g. `jsonRoute({ ... } satisfies RemoteConfig)`) and catch contract
 * drift against the real API shape.
 */
export function jsonRoute<T>(body: T) {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(body)
  }
}
