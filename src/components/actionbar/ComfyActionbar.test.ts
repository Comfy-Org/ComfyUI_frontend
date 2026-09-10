import { render } from '@testing-library/vue'
import { getActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import { i18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'

const renderActionbar = (showRunProgressBar: boolean) => {
  const dockedProgressContainer = document.createElement('div')
  document.body.appendChild(dockedProgressContainer)

  const pinia = getActivePinia()!
  useSettingStore().settingValues = {
    'Comfy.UseNewMenu': 'Top',
    'Comfy.Queue.QPOV2': true,
    'Comfy.Queue.ShowRunProgressBar': showRunProgressBar
  }

  render(ComfyActionbar, {
    container: document.body.appendChild(document.createElement('div')),
    props: {
      dockedProgressContainer,
      queueOverlayExpanded: false
    },
    global: {
      plugins: [pinia, i18n],
      stubs: {
        ContextMenu: {
          name: 'ContextMenu',
          template: '<div />'
        },
        StatusBadge: true,
        ComfyRunButton: {
          name: 'ComfyRunButton',
          template: '<button type="button">Run</button>'
        },
        QueueInlineProgress: true
      },
      directives: {
        tooltip: () => {}
      }
    }
  })

  return { dockedProgressContainer }
}

describe('ComfyActionbar', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('teleports inline progress when run progress bar is enabled', async () => {
    const { dockedProgressContainer } = renderActionbar(true)

    try {
      await nextTick()

      /* eslint-disable testing-library/no-node-access -- Teleport target verification requires scoping to the container element */
      expect(
        dockedProgressContainer.querySelector(
          '[data-testid="queue-inline-progress"]'
        )
      ).not.toBeNull()
      /* eslint-enable testing-library/no-node-access */
    } finally {
      dockedProgressContainer.remove()
    }
  })

  it('does not teleport inline progress when run progress bar is disabled', async () => {
    const { dockedProgressContainer } = renderActionbar(false)

    try {
      await nextTick()

      /* eslint-disable testing-library/no-node-access -- Teleport target verification requires scoping to the container element */
      expect(
        dockedProgressContainer.querySelector(
          '[data-testid="queue-inline-progress"]'
        )
      ).toBeNull()
      /* eslint-enable testing-library/no-node-access */
    } finally {
      dockedProgressContainer.remove()
    }
  })
})
