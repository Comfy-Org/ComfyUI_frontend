import { createTestingPinia } from '@pinia/testing'
import { render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import { i18n } from '@/i18n'
import { coachmarkElements } from '@/platform/onboarding/coachmarkRegistry'
import { vCoachmark } from '@/platform/onboarding/vCoachmark'
import { useSettingStore } from '@/platform/settings/settingStore'

vi.mock('@/components/actionbar/ComfyRunButton', () => ({
  default: { template: '<button type="button">Run</button>' }
}))

const configureSettings = (
  pinia: ReturnType<typeof createTestingPinia>,
  showRunProgressBar: boolean
) => {
  const settingStore = useSettingStore(pinia)
  vi.mocked(settingStore.get).mockImplementation((key) => {
    if (key === 'Comfy.UseNewMenu') return 'Top'
    if (key === 'Comfy.Queue.QPOV2') return true
    if (key === 'Comfy.Queue.ShowRunProgressBar') return showRunProgressBar
    return undefined
  })
}

const renderActionbar = (showRunProgressBar: boolean) => {
  const dockedProgressContainer = document.createElement('div')
  document.body.appendChild(dockedProgressContainer)

  const pinia = createTestingPinia({ createSpy: vi.fn })
  configureSettings(pinia, showRunProgressBar)

  const rendered = render(ComfyActionbar, {
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
        Panel: {
          name: 'Panel',
          template: '<div><slot /></div>'
        },
        StatusBadge: true,
        QueueInlineProgress: true
      },
      directives: {
        coachmark: vCoachmark,
        tooltip: () => {}
      }
    }
  })

  return { dockedProgressContainer, rendered }
}

describe('ComfyActionbar', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('registers the resolved run button as a coachmark target', async () => {
    const { dockedProgressContainer, rendered } = renderActionbar(false)

    try {
      await rendered.findByText('Run')
      await nextTick()

      expect(coachmarkElements('first-run-run-button')).toHaveLength(1)
    } finally {
      dockedProgressContainer.remove()
    }
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
