import { createMemoryHistory } from 'vue-router'

import { safeReturnTo } from '@/auth/returnTo'
import { createBillingRouter } from '@/router'
import type { BillingWebSessionPhase } from '@/router'

function routerAt(phase: BillingWebSessionPhase) {
  return createBillingRouter(createMemoryHistory(), () => phase)
}

describe('the billing route guard', () => {
  it.for(['pending', 'signed-out', 'minting', 'error'] as const)(
    'sends a %s visitor to sign-in with the path to come back to',
    async (phase) => {
      const router = routerAt(phase)

      await router.push('/')

      expect(router.currentRoute.value.path).toBe('/sign-in')
      expect(router.currentRoute.value.query.returnTo).toBe('/')
    }
  )

  it('lets an authenticated visitor onto the billing route', async () => {
    const router = routerAt('authenticated')

    await router.push('/')

    expect(router.currentRoute.value.path).toBe('/')
  })

  it('keeps the sign-in page reachable while signed out', async () => {
    const router = routerAt('signed-out')

    await router.push('/sign-in')

    expect(router.currentRoute.value.path).toBe('/sign-in')
  })

  it('recovers an unknown static-host path through the guard', async () => {
    const router = routerAt('signed-out')

    await router.push('/unknown-path')

    expect(router.currentRoute.value.path).toBe('/sign-in')
    expect(router.currentRoute.value.query.returnTo).toBe('/')
  })
})

describe('the return destination', () => {
  it.for([
    ['/', '/'],
    ['/checkout?plan=creator', '/checkout?plan=creator'],
    ['https://evil.example/steal', '/'],
    ['//evil.example/steal', '/'],
    ['/\\evil.example', '/'],
    ['javascript:alert(1)', '/'],
    ['', '/']
  ] as const)('resolves %s to %s', ([raw, expected]) => {
    expect(safeReturnTo(raw)).toBe(expected)
  })

  it('ignores a repeated query parameter that is not a single path', () => {
    expect(safeReturnTo(['https://evil.example', '/'])).toBe('/')
  })
})
