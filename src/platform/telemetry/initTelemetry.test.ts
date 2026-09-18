import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import type * as apiModule from '@/scripts/api'

import { ClickHouseTelemetryProvider } from './providers/cloud/ClickHouseTelemetryProvider'
import { CustomerIoTelemetryProvider } from './providers/cloud/CustomerIoTelemetryProvider'
import { DatadogRumTelemetryProvider } from './providers/cloud/DatadogRumTelemetryProvider'
import { GtmTelemetryProvider } from './providers/cloud/GtmTelemetryProvider'
import { ImpactTelemetryProvider } from './providers/cloud/ImpactTelemetryProvider'
import { MixpanelTelemetryProvider } from './providers/cloud/MixpanelTelemetryProvider'
import { PostHogTelemetryProvider } from './providers/cloud/PostHogTelemetryProvider'
import { SentryTelemetryProvider } from './providers/cloud/SentryTelemetryProvider'
import { SyftTelemetryProvider } from './providers/cloud/SyftTelemetryProvider'

vi.mock(import('@datadog/browser-rum'))
vi.mock(import('./manualRefreshTracker'))
vi.mock(import('./providers/cloud/DatadogRumTelemetryProvider'), () => ({
  DatadogRumTelemetryProvider: vi.fn<typeof DatadogRumTelemetryProvider>()
}))
vi.mock(import('./providers/cloud/GtmTelemetryProvider'), () => ({
  GtmTelemetryProvider: vi.fn<typeof GtmTelemetryProvider>()
}))
vi.mock(import('./providers/cloud/MixpanelTelemetryProvider'), () => ({
  MixpanelTelemetryProvider: vi.fn<typeof MixpanelTelemetryProvider>()
}))
vi.mock(import('./providers/cloud/ImpactTelemetryProvider'), () => ({
  ImpactTelemetryProvider: vi.fn<typeof ImpactTelemetryProvider>()
}))
vi.mock(import('./providers/cloud/PostHogTelemetryProvider'), () => ({
  PostHogTelemetryProvider: vi.fn<typeof PostHogTelemetryProvider>()
}))
vi.mock(import('./providers/cloud/ClickHouseTelemetryProvider'), () => ({
  ClickHouseTelemetryProvider: vi.fn<typeof ClickHouseTelemetryProvider>()
}))
vi.mock(import('./providers/cloud/SyftTelemetryProvider'), () => ({
  SyftTelemetryProvider: vi.fn<typeof SyftTelemetryProvider>()
}))
vi.mock(import('./providers/cloud/CustomerIoTelemetryProvider'), () => ({
  CustomerIoTelemetryProvider: vi.fn<typeof CustomerIoTelemetryProvider>()
}))
vi.mock(import('./providers/cloud/SentryTelemetryProvider'), () => ({
  SentryTelemetryProvider: vi.fn<typeof SentryTelemetryProvider>()
}))
vi.mock(import('@/scripts/api'), () =>
  fromPartial<typeof apiModule>({
    api: {
      getServerFeature: vi.fn(
        (_key: string, defaultValue?: unknown) => defaultValue
      )
    }
  })
)

const providers = [
  ClickHouseTelemetryProvider,
  CustomerIoTelemetryProvider,
  DatadogRumTelemetryProvider,
  GtmTelemetryProvider,
  ImpactTelemetryProvider,
  MixpanelTelemetryProvider,
  PostHogTelemetryProvider,
  SentryTelemetryProvider,
  SyftTelemetryProvider
]

beforeEach(() => {
  vi.resetModules()
  vi.stubGlobal('__DISTRIBUTION__', 'cloud')
})

it('reports defaults while RUM setup is pending and retains delivery after analytics starts', async () => {
  const { datadogRum } = await import('@datadog/browser-rum')
  const { initDatadogRum } = await import('./initDatadogRum')
  const { initTelemetry } = await import('./initTelemetry')
  const { useTelemetry } = await import('./index')
  const { remoteConfig } = await import('@/platform/remoteConfig/remoteConfig')
  const { startFeatureFlagTelemetry } =
    await import('@/composables/useFeatureFlags')
  let releaseProbe = () => {}
  const probe = new Promise<void>((resolve) => {
    releaseProbe = resolve
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      await probe
      return new Response(null, { status: 503 })
    })
  )

  const rumReady = initDatadogRum('cloud.comfy.org')
  const registry = useTelemetry()
  const stop = startFeatureFlagTelemetry()
  onTestFinished(stop)

  expect(datadogRum.addFeatureFlagEvaluation).toHaveBeenCalledWith(
    'assets',
    true
  )
  expect(datadogRum.addFeatureFlagEvaluation).toHaveBeenCalledWith(
    'asset_rename_enabled',
    false
  )
  expect(datadogRum.init).not.toHaveBeenCalled()
  for (const provider of providers) expect(provider).not.toHaveBeenCalled()

  releaseProbe()
  await rumReady
  remoteConfig.value = { asset_rename_enabled: true }
  await nextTick()
  await Promise.all([initTelemetry(), initTelemetry()])
  await initDatadogRum('cloud.comfy.org')

  expect(useTelemetry()).toBe(registry)
  expect(datadogRum.addFeatureFlagEvaluation).toHaveBeenCalledWith(
    'asset_rename_enabled',
    true
  )
  for (const provider of providers) expect(provider).toHaveBeenCalledOnce()

  vi.mocked(datadogRum.addFeatureFlagEvaluation).mockClear()
  remoteConfig.value = { asset_rename_enabled: false }
  await nextTick()

  expect(
    vi
      .mocked(datadogRum.addFeatureFlagEvaluation)
      .mock.calls.filter(([key]) => key === 'asset_rename_enabled')
  ).toEqual([['asset_rename_enabled', false]])
})

it.for(['', 'desktop'])(
  'keeps cloud telemetry disabled for distribution "%s"',
  async (distribution) => {
    vi.stubGlobal('__DISTRIBUTION__', distribution)
    const { initTelemetry } = await import('./initTelemetry')
    const { useTelemetry } = await import('./index')

    await initTelemetry()

    expect(useTelemetry()).toBeNull()
    for (const provider of providers) expect(provider).not.toHaveBeenCalled()
  }
)
