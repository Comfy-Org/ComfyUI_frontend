import { expect, it, vi } from 'vitest'

vi.mock(import('@/scripts/app'))
vi.mock(import('@/platform/telemetry/reportError'))

const { initialize } = vi.hoisted(() => ({ initialize: vi.fn() }))
vi.mock(import('./main'), async () => {
  const { useApp } = await import('@/scripts/appRegistry')
  initialize(useApp())
  return {}
})

it('reports an unregistered app during boot and stops dependent initialization', async () => {
  vi.stubEnv('DEV', false)
  const { reportError } = await import('@/platform/telemetry/reportError')

  await import('./bootstrap')

  expect(initialize).not.toHaveBeenCalled()
  expect(reportError).toHaveBeenCalledExactlyOnceWith(expect.any(Error), {
    errorType: 'failure_initializing_app',
    surface: 'platform'
  })
})
