import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'

import ComfyMenuButton from './ComfyMenuButton.vue'

vi.mock(import('@/platform/telemetry'))

const NODES_2_LABEL = 'Nodes 2.0'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: { g: { beta: 'BETA' } } }
})

async function openMenu({ vueNodesEnabled = false } = {}) {
  const user = userEvent.setup()
  const enabled = ref(vueNodesEnabled)
  const settingStore = useSettingStore()

  vi.mocked(settingStore.get).mockImplementation((key) =>
    key === 'Comfy.VueNodes.Enabled' ? enabled.value : undefined
  )
  vi.mocked(settingStore.set).mockImplementation(async (key, value) => {
    if (key === 'Comfy.VueNodes.Enabled') enabled.value = Boolean(value)
  })

  render(ComfyMenuButton, {
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

  await user.click(screen.getByTestId('comfy-menu-button'))

  return {
    user,
    settingStore,
    row: screen.getByTestId('nodes-2-toggle-item'),
    label: screen.getByText(NODES_2_LABEL)
  }
}

describe('ComfyMenuButton', () => {
  describe.for(['row', 'label'] as const)('clicking the %s', (target) => {
    it('toggles Nodes 2.0 exactly once', async () => {
      const menu = await openMenu()

      await menu.user.click(menu[target])

      expect(menu.settingStore.set).toHaveBeenCalledExactlyOnceWith(
        'Comfy.VueNodes.Enabled',
        true
      )
    })
  })

  describe.for([
    { enabled: false, written: true },
    { enabled: true, written: false }
  ])('while Nodes 2.0 is $enabled', ({ enabled, written }) => {
    it('writes the opposite value and shows it on the switch', async () => {
      const menu = await openMenu({ vueNodesEnabled: enabled })

      await menu.user.click(menu.row)

      expect(menu.settingStore.set).toHaveBeenCalledExactlyOnceWith(
        'Comfy.VueNodes.Enabled',
        written
      )
      await nextTick()
      expect(
        screen.getByRole('menuitemcheckbox', { name: NODES_2_LABEL })
      ).toHaveAttribute('aria-checked', String(written))
    })
  })

  it('does not advertise Nodes 2.0 as beta', async () => {
    await openMenu()

    expect(screen.queryByText('BETA')).not.toBeInTheDocument()
  })
})
