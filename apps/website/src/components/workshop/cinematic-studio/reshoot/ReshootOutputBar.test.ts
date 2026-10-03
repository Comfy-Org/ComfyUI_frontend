import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { h } from 'vue'
import { describe, expect, it, vi } from 'vitest'

import { captureWorkshopEvent } from '../../../../scripts/posthog'
import ReshootOutputBar from './ReshootOutputBar.vue'

vi.mock(import('../../../../scripts/posthog'))

describe('Re-shoot downloads', () => {
  it.for(['example', 'generated'] as const)(
    'attributes a %s output download to Re-shoot without its private URL',
    async (outputSource) => {
      render({
        setup: () => () =>
          h(ReshootOutputBar, {
            href: 'blob:private-output',
            fileName: 'take.mp4',
            view: 'result',
            sound: 'generated',
            outputSource
          })
      })
      const download = screen.getByRole('link', { name: 'Download' })
      download.addEventListener('click', (event) => event.preventDefault(), {
        once: true
      })
      await userEvent.setup().click(download)

      expect(captureWorkshopEvent).toHaveBeenCalledExactlyOnceWith({
        name: 'output_download_clicked',
        properties: {
          model_slug: 'apps/reshoot',
          page_type: 'app',
          app_slug: 'apps/reshoot',
          output_kind: 'video',
          output_source: outputSource
        }
      })
    }
  )
})
