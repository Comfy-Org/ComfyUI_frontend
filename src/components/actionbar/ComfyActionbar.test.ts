import { createTestingPinia } from '@pinia/testing'
import { fireEvent, render } from '@testing-library/vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import ComfyActionbar from '@/components/actionbar/ComfyActionbar.vue'
import { i18n } from '@/i18n'
import { useSettingStore } from '@/platform/settings/settingStore'

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
  const topMenuContainer = document.createElement('div')
  document.body.appendChild(topMenuContainer)

  const pinia = createTestingPinia({ createSpy: vi.fn })
  configureSettings(pinia, showRunProgressBar)

  const utils = render(ComfyActionbar, {
    container: document.body.appendChild(document.createElement('div')),
    props: {
      topMenuContainer,
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

  return { topMenuContainer, ...utils }
}

describe('ComfyActionbar', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    localStorage.clear()
  })

  it('teleports inline progress when run progress bar is enabled', async () => {
    const { topMenuContainer } = renderActionbar(true)

    try {
      await nextTick()

      /* eslint-disable testing-library/no-node-access -- Teleport target verification requires scoping to the container element */
      expect(
        topMenuContainer.querySelector('[data-testid="queue-inline-progress"]')
      ).not.toBeNull()
      /* eslint-enable testing-library/no-node-access */
    } finally {
      topMenuContainer.remove()
    }
  })

  it('does not teleport inline progress when run progress bar is disabled', async () => {
    const { topMenuContainer } = renderActionbar(false)

    try {
      await nextTick()

      /* eslint-disable testing-library/no-node-access -- Teleport target verification requires scoping to the container element */
      expect(
        topMenuContainer.querySelector('[data-testid="queue-inline-progress"]')
      ).toBeNull()
      /* eslint-enable testing-library/no-node-access */
    } finally {
      topMenuContainer.remove()
    }
  })

  it('prevents position jumping when starting a drag from docked state', async () => {
    const { topMenuContainer, container } = renderActionbar(true)

    try {
      await nextTick()

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- querying panel element to spy on getBoundingClientRect
      const panel = container.querySelector('.actionbar')
      if (!(panel instanceof HTMLElement)) {
        throw new Error('Panel not found')
      }

      vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue({
        x: 100,
        y: 200,
        width: 50,
        height: 50,
        top: 200,
        right: 150,
        bottom: 250,
        left: 100,
        toJSON: () => {}
      })

      // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- querying drag handle element by CSS class; no ARIA role available
      const dragHandle = container.querySelector('.drag-handle')
      if (!dragHandle) {
        throw new Error('Drag handle not found')
      }

      // eslint-disable-next-line testing-library/prefer-user-event -- userEvent does not easily expose a raw pointerDown to initiate vueuse drag hooks
      await fireEvent.pointerDown(dragHandle)

      await nextTick()

      expect(panel.style.left).toBe('100px')
      expect(panel.style.top).toBe('200px')
    } finally {
      topMenuContainer.remove()
      // eslint-disable-next-line testing-library/no-container -- Cleanup requires direct container manipulation
      container.remove()
      vi.restoreAllMocks()
    }
  })
})
