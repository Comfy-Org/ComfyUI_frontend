import { datadogRum } from '@datadog/browser-rum'
import { expect, it, onTestFinished, vi } from 'vitest'

it('flushes pending view flags when a page hides, freezes, or unloads', async () => {
  vi.spyOn(HTMLIFrameElement.prototype, 'contentWindow', 'get').mockReturnValue(
    null
  )
  vi.useFakeTimers({
    toFake: [
      'Date',
      'performance',
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval'
    ],
    shouldAdvanceTime: false
  })
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>().mockResolvedValue(new Response())
  )
  const sendBeacon = vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true)
  datadogRum.init({
    clientToken: 'test',
    applicationId: 'test',
    trackViewsManually: true,
    sessionPersistence: 'local-storage',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0,
    allowUntrustedEvents: true,
    compressIntakeRequests: false
  })
  onTestFinished(() => datadogRum.stopSession())
  datadogRum.startView('flag updates before exit')
  const viewId = datadogRum.getInternalContext()?.view?.id
  expect(viewId).toBeDefined()

  function flushWithFlags(event: string, enabled: boolean): unknown[] {
    datadogRum.addFeatureFlagEvaluation('assets', enabled)
    datadogRum.setViewContextProperty('ready', enabled)
    sendBeacon.mockClear()
    window.dispatchEvent(new Event(event))
    const payload = sendBeacon.mock.calls.at(-1)?.[1]
    if (typeof payload !== 'string')
      throw new Error('Missing RUM beacon payload')
    return payload.split('\n').map((line): unknown => JSON.parse(line))
  }

  await vi.advanceTimersByTimeAsync(100)
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
  expect(flushWithFlags('visibilitychange', true)).toContainEqual(
    expect.objectContaining({
      type: 'view',
      view: expect.objectContaining({ id: viewId }),
      feature_flags: { assets: true },
      context: { ready: true }
    })
  )

  await vi.advanceTimersByTimeAsync(100)
  expect(flushWithFlags('freeze', false)).toContainEqual(
    expect.objectContaining({
      type: 'view',
      view: expect.objectContaining({ id: viewId }),
      feature_flags: { assets: false },
      context: { ready: false }
    })
  )

  await vi.advanceTimersByTimeAsync(100)
  expect(flushWithFlags('beforeunload', true)).toContainEqual(
    expect.objectContaining({
      type: 'view',
      view: expect.objectContaining({ id: viewId }),
      feature_flags: { assets: true },
      context: { ready: true }
    })
  )
})
