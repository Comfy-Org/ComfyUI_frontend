import { datadogLogs } from '@datadog/browser-logs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { WorkshopAnalyticsEvent } from './workshop-analytics'
import { captureWorkshopHealth } from './workshop-datadog'

const event: WorkshopAnalyticsEvent = {
  name: 'delivery_finished',
  properties: {
    model_slug: 'vertexai--gemini-nano-banana-2--generate-images',
    router_id: 'vertexai/gemini-nano-banana-2',
    provider: 'Google',
    modality: 'image',
    attempt_id: 'client-attempt',
    request_id: 'router-request',
    status: 'succeeded',
    duration_ms: 100,
    output_kind: 'image',
    user_id: 'private-user',
    workspace_id: 'private-workspace'
  }
}

describe('Workshop Datadog capture', () => {
  beforeEach(() => {
    vi.spyOn(datadogLogs, 'init').mockImplementation(() => {})
    vi.spyOn(datadogLogs.logger, 'info').mockImplementation(() => {})
  })

  it.for(['comfy.org', 'www.comfy.org', 'website-preview.vercel.app'])(
    'delivers structured health from %s',
    async (hostname) => {
      vi.spyOn(window.location, 'hostname', 'get').mockReturnValue(hostname)

      captureWorkshopHealth(event)

      await vi.waitFor(() =>
        expect(datadogLogs.logger.info).toHaveBeenCalledExactlyOnceWith(
          'workshop run',
          expect.objectContaining({
            feature: 'models',
            event_name: 'delivery_finished',
            service_health: 'success',
            model_slug: event.properties.model_slug,
            client_attempt_id: 'client-attempt',
            request_id: 'router-request'
          })
        )
      )
      expect(
        JSON.stringify(vi.mocked(datadogLogs.logger.info).mock.calls)
      ).not.toContain('private')
    }
  )

  it('does not initialize or send during server rendering', async () => {
    vi.stubGlobal('window', undefined)

    captureWorkshopHealth(event)
    await vi.dynamicImportSettled()

    expect(datadogLogs.init).not.toHaveBeenCalled()
    expect(datadogLogs.logger.info).not.toHaveBeenCalled()
  })

  it('contains a logging failure and sends the next outcome', async () => {
    vi.spyOn(window.location, 'hostname', 'get').mockReturnValue('comfy.org')
    vi.mocked(datadogLogs.logger.info).mockImplementationOnce(() => {
      throw new Error('Logging unavailable')
    })

    expect(() => captureWorkshopHealth(event)).not.toThrow()
    await vi.waitFor(() =>
      expect(datadogLogs.logger.info).toHaveBeenCalledOnce()
    )

    captureWorkshopHealth(event)

    await vi.waitFor(() =>
      expect(datadogLogs.logger.info).toHaveBeenNthCalledWith(
        2,
        'workshop run',
        expect.objectContaining({ service_health: 'success' })
      )
    )
  })

  it.for(['localhost', 'comfy.org.attacker.example'])(
    'does not initialize or send from %s',
    async (hostname) => {
      vi.spyOn(window.location, 'hostname', 'get').mockReturnValue(hostname)

      captureWorkshopHealth(event)
      await vi.dynamicImportSettled()

      expect(datadogLogs.init).not.toHaveBeenCalled()
      expect(datadogLogs.logger.info).not.toHaveBeenCalled()
    }
  )
})
