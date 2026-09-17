import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'

import ComfyMenuButton from './ComfyMenuButton.vue'

vi.mock(import('@/platform/telemetry'))

const NODES_2_LABEL = 'Nodes 2.0'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: {} }
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

  const { container } = render(ComfyMenuButton, {
    global: {
      plugins: [i18n],
      directives: { tooltip: () => {} }
    }
  })

  // eslint-disable-next-line testing-library/no-container, testing-library/no-node-access -- the menu trigger is an unlabelled div with no role
  const trigger = container.querySelector('.comfy-menu-button-wrapper')
  if (!(trigger instanceof HTMLElement)) {
    throw new Error('Expected the menu trigger to be rendered')
  }
  await user.click(trigger)

  return {
    user,
    settingStore,
    row: screen.getByTestId('nodes-2-toggle-item'),
    label: screen.getByText(NODES_2_LABEL),
    toggle: screen.getByRole('switch', { name: NODES_2_LABEL })
  }
}

describe('ComfyMenuButton', () => {
  describe.for([
    { target: 'row', description: 'anywhere on the row' },
    { target: 'label', description: 'the row label' },
    { target: 'toggle', description: 'the switch itself' }
  ] as const)('clicking $description', ({ target }) => {
    it('enables Nodes 2.0 while it is disabled', async () => {
      const menu = await openMenu()

      await menu.user.click(menu[target])

      expect(menu.settingStore.set).toHaveBeenCalledExactlyOnceWith(
        'Comfy.VueNodes.Enabled',
        true
      )
      expect(menu.toggle).toBeChecked()
    })

    it('disables Nodes 2.0 while it is enabled', async () => {
      const menu = await openMenu({ vueNodesEnabled: true })

      await menu.user.click(menu[target])

      expect(menu.settingStore.set).toHaveBeenCalledExactlyOnceWith(
        'Comfy.VueNodes.Enabled',
        false
      )
      expect(menu.toggle).not.toBeChecked()
    })

    it('keeps the menu open so the change can be reverted', async () => {
      const menu = await openMenu()

      await menu.user.click(menu[target])

      expect(menu.toggle).toBeVisible()
    })
  })
})
