import { expect, it, vi } from 'vitest'

import { app } from '@/scripts/app'

vi.mock(import('@/scripts/app'))

it('allows legacy graph guards before initialization and after restoring the root', () => {
  const graph = app.rootGraph
  vi.mocked(app).rootGraphOrUndefined = undefined

  expect(app.graph).toBeUndefined()
  expect(app.isGraphReady).toBe(false)
  expect(() => app.rootGraph).toThrow('not initialized')

  vi.mocked(app).graph = graph

  expect(app.graph).toBe(graph)
  expect(app.rootGraph).toBe(graph)
  expect(app.isGraphReady).toBe(true)
})
