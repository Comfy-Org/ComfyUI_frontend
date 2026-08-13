import { describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import type { RouteLocation } from 'vue-router'

import { unmatchedRouteRedirect } from '@/platform/navigation/unmatchedRoute'

const mockReportError = vi.hoisted(() => vi.fn())
vi.mock('@/platform/telemetry', () => ({
  useTelemetry: () => ({ reportError: mockReportError })
}))

const Blank = { template: '<div />' }

describe('unmatchedRouteRedirect', () => {
  it('sends unknown paths to root', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'root', component: Blank },
        { path: '/:pathMatch(.*)*', redirect: unmatchedRouteRedirect }
      ]
    })

    await router.push('/woiadawd')

    expect(router.currentRoute.value.path).toBe('/')
    expect(router.currentRoute.value.name).toBe('root')
  })

  it('reports the unmatched path as a warning under a static message', () => {
    unmatchedRouteRedirect({ path: '/woiadawd' } as RouteLocation)

    expect(mockReportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ message: 'Unmatched route' }),
      {
        error_type: 'unmatched_route',
        level: 'warning',
        context: { path: '/woiadawd' }
      }
    )
  })
})
