/** `scripts/api.js`. Event registration is recorded but nothing is dispatched. */
export const api = {
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => {},
  fetchApi: async () => new Response('{}', { status: 200 }),
  getNodeDefs: async () => ({}),
  apiURL: (path) => `/api${path}`,
  fileURL: (path) => path
}
