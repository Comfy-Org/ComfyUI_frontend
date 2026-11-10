import { CLOUD_BASE_URL } from '@/config/env'
import { runHandoffBootstrap } from '@/handoff/handoffBootstrap'
import { sessionTabStorage } from '@/handoff/handoffTab'

void runHandoffBootstrap({
  pathname: window.location.pathname,
  search: window.location.search,
  hash: () => window.location.hash,
  replaceUrl: (url) => window.history.replaceState(null, '', url),
  storage: sessionTabStorage,
  fetchImpl: (...args) => window.fetch(...args),
  cloudBaseUrl: CLOUD_BASE_URL,
  now: () => Date.now()
}).then((outcome) => (outcome === 'halt' ? undefined : import('@/main')))
