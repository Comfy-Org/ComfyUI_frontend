import { createTestingPinia } from '@pinia/testing'
import { mount } from '@vue/test-utils'
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

const mountActionbar = (showRunProgressBar: boolean) => {
  const topMenuContainer = document.createElement('div')
  document.body.appendChild(topMenuContainer)

  const pinia = createTestingPinia({ createSpy: vi.fn })
  configureSettings(pinia, showRunProgressBar)

  const wrapper = mount(ComfyActionbar, {
    attachTo: document.body,
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
        Badge: true,
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

  return {
    wrapper,
    topMenuContainer
  }
}

describe('ComfyActionbar', () => {
  beforeEach(() => {
    i18n.global.locale.value = 'en'
    localStorage.clear()
  })

  it('teleports inline progress when run progress bar is enabled', async () => {
    const { wrapper, topMenuContainer } = mountActionbar(true)

    try {
      await nextTick()

      expect(
        topMenuContainer.querySelector('[data-testid="queue-inline-progress"]')
      ).not.toBeNull()
    } finally {
      wrapper.unmount()
      topMenuContainer.remove()
    }
  })

  it('does not teleport inline progress when run progress bar is disabled', async () => {
    const { wrapper, topMenuContainer } = mountActionbar(false)

    try {
      await nextTick()

      expect(
        topMenuContainer.querySelector('[data-testid="queue-inline-progress"]')
      ).toBeNull()
    } finally {
      wrapper.unmount()
      topMenuContainer.remove()
    }
  })
})
