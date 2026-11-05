import { TestRunner, assert, vi } from 'vitest'

import type { api as RealApi } from '@/scripts/api'

type ApiState = Pick<
  typeof RealApi,
  'socket' | 'clientId' | 'initialClientId' | 'user' | 'api_host' | 'api_base'
> & { events: EventTarget }

const stateKey = Symbol('api mock state')

declare module 'vitest' {
  interface TestContext {
    [stateKey]?: ApiState
  }
}

function createState(): ApiState {
  return {
    events: new EventTarget(),
    socket: null,
    clientId: undefined,
    initialClientId: null,
    user: '',
    api_host: 'localhost:3000',
    api_base: ''
  }
}

const collectionState = createState()

function state(): ApiState {
  const test = TestRunner.getCurrentTest()
  return test ? (test.context[stateKey] ??= createState()) : collectionState
}

const actions = vi.mockObject<
  Pick<
    typeof RealApi,
    | 'addEventListener'
    | 'removeEventListener'
    | 'addCustomEventListener'
    | 'removeCustomEventListener'
    | 'dispatchEvent'
    | 'dispatchCustomEvent'
    | 'apiURL'
    | 'internalURL'
    | 'fileURL'
    | 'fetchApi'
    | 'getServerFeature'
    | 'getClientFeatureFlags'
    | 'getSettings'
    | 'storeSetting'
    | 'storeSettings'
    | 'getUserData'
    | 'storeUserData'
    | 'deleteUserData'
    | 'moveUserData'
    | 'listUserDataFullInfo'
    | 'getGlobalSubgraphs'
    | 'getNodeDefs'
    | 'getEmbeddings'
    | 'getQueue'
    | 'getHistory'
    | 'clearItems'
    | 'deleteItem'
    | 'cancelJob'
    | 'getJobDetail'
    | 'getJobAssets'
    | 'getModels'
    | 'getModelFolders'
    | 'viewMetadata'
    | 'getFolderPaths'
    | 'getSystemStats'
    | 'getUserConfig'
    | 'subscribeLogs'
    | 'getLogs'
    | 'getRawLogs'
    | 'getShareableAssets'
    | 'socketAuthParams'
  >
>(
  {
    addEventListener: (...args: Parameters<EventTarget['addEventListener']>) =>
      state().events.addEventListener(...args),
    removeEventListener: (
      ...args: Parameters<EventTarget['removeEventListener']>
    ) => state().events.removeEventListener(...args),
    addCustomEventListener: (type, callback, options) =>
      state().events.addEventListener(type, callback as EventListener, options),
    removeCustomEventListener: (type, callback, options) =>
      state().events.removeEventListener(
        type,
        callback as EventListener,
        options
      ),
    dispatchEvent: (event) => state().events.dispatchEvent(event),
    dispatchCustomEvent: (type: string, detail?: unknown) =>
      state().events.dispatchEvent(new CustomEvent(type, { detail })),
    apiURL: (url) =>
      state().api_base + (url.startsWith('/api') ? url : `/api${url}`),
    internalURL: (url) => `${state().api_base}/internal${url}`,
    fileURL: (url) => state().api_base + url,
    async fetchApi() {
      assert.fail('Configure api.fetchApi for this test')
    },
    getServerFeature: <T>(_name: string, fallback?: T) => fallback as T,
    getClientFeatureFlags: () => ({}),
    async getSettings() {
      assert.fail('Configure api.getSettings for this test')
    },
    storeSetting: async () => new Response(null, { status: 200 }),
    storeSettings: async () => new Response(null, { status: 200 }),
    getUserData: async () => new Response(null, { status: 404 }),
    storeUserData: async () => new Response(null, { status: 200 }),
    deleteUserData: async () => new Response(null, { status: 204 }),
    moveUserData: async () => new Response(null, { status: 200 }),
    listUserDataFullInfo: async () => [],
    getGlobalSubgraphs: async () => ({}),
    getNodeDefs: async () => ({}),
    getEmbeddings: async () => [],
    getQueue: async () => ({ Running: [], Pending: [] }),
    getHistory: async () => [],
    async clearItems() {},
    async deleteItem() {},
    async cancelJob() {},
    getJobDetail: async () => undefined,
    async getJobAssets() {
      assert.fail('Configure api.getJobAssets for this test')
    },
    getModels: async () => [],
    getModelFolders: async () => [],
    viewMetadata: async () => ({}),
    getFolderPaths: async () => ({}),
    async getSystemStats() {
      assert.fail('Configure api.getSystemStats for this test')
    },
    async getUserConfig() {
      assert.fail('Configure api.getUserConfig for this test')
    },
    async subscribeLogs() {},
    getLogs: async () => '',
    getRawLogs: async () => ({ entries: [], size: { cols: 80, row: 24 } }),
    async getShareableAssets() {
      assert.fail('Configure api.getShareableAssets for this test')
    },
    socketAuthParams: async () => new URLSearchParams()
  },
  { spy: true }
)

export const api = {
  ...actions,
  get socket() {
    return state().socket
  },
  set socket(value: ApiState['socket']) {
    state().socket = value
  },
  get clientId() {
    return state().clientId
  },
  set clientId(value: ApiState['clientId']) {
    state().clientId = value
  },
  get initialClientId() {
    return state().initialClientId
  },
  set initialClientId(value: ApiState['initialClientId']) {
    state().initialClientId = value
  },
  get user() {
    return state().user
  },
  set user(value: ApiState['user']) {
    state().user = value
  },
  get api_host() {
    return state().api_host
  },
  set api_host(value: ApiState['api_host']) {
    state().api_host = value
  },
  get api_base() {
    return state().api_base
  },
  set api_base(value: ApiState['api_base']) {
    state().api_base = value
  }
}
