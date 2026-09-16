import { datadogRum } from '@datadog/browser-rum'
import type { RumViewEvent } from '@datadog/browser-rum'
import { expect, it, onTestFinished, vi } from 'vitest'

import { trackDatadogFeatureFlagEvaluation } from './datadogFeatureFlags'
import { rumBeforeSend } from './datadogRumBeforeSend'

it('keeps resolved flags on quiet views, route changes, and renewed sessions', async () => {
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
  vi.spyOn(navigator, 'sendBeacon').mockReturnValue(true)
  const views: RumViewEvent[] = []
  trackDatadogFeatureFlagEvaluation('assets', true)
  trackDatadogFeatureFlagEvaluation('asset.deletion.enabled', false)
  datadogRum.init({
    clientToken: 'test',
    applicationId: 'test',
    trackViewsManually: true,
    sessionPersistence: 'local-storage',
    sessionSampleRate: 100,
    sessionReplaySampleRate: 0,
    allowUntrustedEvents: true,
    beforeSend(event, context) {
      const keep = rumBeforeSend(event, context)
      if (event.type === 'view') views.push(event)
      return keep
    }
  })
  onTestFinished(() => datadogRum.stopSession())
  datadogRum.startView('first')
  await vi.advanceTimersByTimeAsync(3000)

  expect(views.at(-1)?.feature_flags).toEqual({
    assets: true,
    asset_deletion_enabled: false
  })

  datadogRum.startView('second')
  await vi.advanceTimersByTimeAsync(3000)

  expect(views.at(-1)).toMatchObject({
    view: { name: 'second' },
    feature_flags: { assets: true, asset_deletion_enabled: false },
    context: { feature_flags_initialized: true }
  })

  trackDatadogFeatureFlagEvaluation('asset.deletion.enabled', true)
  await vi.advanceTimersByTimeAsync(3000)

  expect(views.at(-1)?.feature_flags).toEqual({
    assets: true,
    asset_deletion_enabled: true
  })

  const previousSession = datadogRum.getInternalContext()?.session_id
  datadogRum.stopSession()
  document.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  await vi.advanceTimersByTimeAsync(3000)

  expect(datadogRum.getInternalContext()?.session_id).toBeDefined()
  expect(datadogRum.getInternalContext()?.session_id).not.toBe(previousSession)
  expect(views.at(-1)?.feature_flags).toEqual({
    assets: true,
    asset_deletion_enabled: true
  })

  const viewUpdates = views.length
  await vi.advanceTimersByTimeAsync(6000)
  expect(views).toHaveLength(viewUpdates)
})
