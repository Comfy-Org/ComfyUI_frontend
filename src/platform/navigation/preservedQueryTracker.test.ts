import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Router, RouterHistory } from 'vue-router'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  clearPreservedQuery,
  getPreservedQueryParam
} from '@/platform/navigation/preservedQueryManager'
import { installPreservedQueryTracker } from '@/platform/navigation/preservedQueryTracker'

const STRIPPED_NAMESPACE = 'test_strip'
const SECOND_STRIPPED_NAMESPACE = 'test_strip_b'
const PLAIN_NAMESPACE = 'test_plain'

const strippedDefinition = {
  namespace: STRIPPED_NAMESPACE,
  keys: ['one_time_code'],
  stripAfterCapture: true
}

const plainDefinition = {
  namespace: PLAIN_NAMESPACE,
  keys: ['plain_code', 'plain_source']
}

function createTestRouter(
  history: RouterHistory = createMemoryHistory()
): Router {
  return createRouter({
    history,
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }]
  })
}

describe('installPreservedQueryTracker', () => {
  beforeEach(() => {
    sessionStorage.clear()
    clearPreservedQuery(STRIPPED_NAMESPACE)
    clearPreservedQuery(SECOND_STRIPPED_NAMESPACE)
    clearPreservedQuery(PLAIN_NAMESPACE)
  })

  it('strips marked keys from the URL while preserving other query and hash', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/?one_time_code=otc_abc123&keep=a+b#frag')

    expect(router.currentRoute.value.fullPath).toBe('/?keep=a+b#frag')
    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_abc123'
    )
  })

  it('keeps params of non-strip namespaces in the URL and still captures them', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [plainDefinition])

    await router.push('/?plain_code=alpha&plain_source=beta')

    expect(router.currentRoute.value.fullPath).toBe(
      '/?plain_code=alpha&plain_source=beta'
    )
    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_code')).toBe('alpha')
    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_source')).toBe('beta')
  })

  it('replaces a non-strip namespace stash on later captures', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [plainDefinition])

    await router.push('/?plain_code=alpha&plain_source=beta')
    await router.push('/?plain_code=gamma')

    expect(getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_code')).toBe('gamma')
    expect(
      getPreservedQueryParam(PLAIN_NAMESPACE, 'plain_source')
    ).toBeUndefined()
  })

  it('navigates exactly once when no strip-marked keys are present', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])
    let completedNavigations = 0
    router.afterEach(() => {
      completedNavigations++
    })

    await router.push('/?keep=1')

    expect(router.currentRoute.value.fullPath).toBe('/?keep=1')
    expect(completedNavigations).toBe(1)
  })

  it('scrubs empty and null values from the URL without stashing them', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/?one_time_code=')
    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(
      getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')
    ).toBeUndefined()

    await router.push('/?one_time_code')
    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(
      getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')
    ).toBeUndefined()
  })

  it('clears a stale stripped value when the URL supplies an empty value', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/?one_time_code=otc_abc123')
    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_abc123'
    )

    await router.push('/?one_time_code=')

    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(
      getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')
    ).toBeUndefined()
  })

  it('stashes the first value of a repeated param and cleans the URL', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/?one_time_code=otc_A&one_time_code=otc_B')

    expect(router.currentRoute.value.fullPath).toBe('/')
    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_A'
    )
  })

  it('strips keys of multiple marked namespaces in a single redirect', async () => {
    const router = createTestRouter()
    let navigationAttempts = 0
    router.beforeEach((_to, _from, next) => {
      navigationAttempts++
      next()
    })
    installPreservedQueryTracker(router, [
      strippedDefinition,
      {
        namespace: SECOND_STRIPPED_NAMESPACE,
        keys: ['second_code'],
        stripAfterCapture: true
      }
    ])

    await router.push('/?one_time_code=otc_x&second_code=sc_y&keep=1')

    expect(router.currentRoute.value.fullPath).toBe('/?keep=1')
    expect(navigationAttempts).toBe(2)
    expect(getPreservedQueryParam(STRIPPED_NAMESPACE, 'one_time_code')).toBe(
      'otc_x'
    )
    expect(
      getPreservedQueryParam(SECOND_STRIPPED_NAMESPACE, 'second_code')
    ).toBe('sc_y')
  })

  it('keeps the prior history entry reachable after the strip redirect', async () => {
    const router = createTestRouter()
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/start')
    await router.push('/?one_time_code=otc_abc123')
    expect(router.currentRoute.value.fullPath).toBe('/')

    router.go(-1)
    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe('/start')
    )
  })

  it('keeps replace navigation from adding a back target', async () => {
    const history = createMemoryHistory()
    const router = createTestRouter(history)
    installPreservedQueryTracker(router, [strippedDefinition])

    await router.push('/start')
    await router.replace('/?one_time_code=otc_abc123')
    expect(router.currentRoute.value.fullPath).toBe('/')

    router.go(-1)

    expect(history.location).toBe('/')
  })
})
