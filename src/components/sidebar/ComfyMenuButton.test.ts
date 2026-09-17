/* eslint-disable testing-library/no-container, testing-library/no-node-access -- the menu trigger is an unlabelled div with no role */
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

  const trigger = container.querySelector('.comfy-menu-button-wrapper')
  if (!(trigger instanceof HTMLElement)) {
    throw new Error('Expected the menu trigger to be rendered')
  }
  await user.click(trigger)

  return {
    user,
    settingStore,
    row: screen.getByText(NODES_2_LABEL),
    toggle: screen.getByRole('switch', { name: NODES_2_LABEL })
  }
}

describe('ComfyMenuButton', () => {
  it('enables Nodes 2.0 when the row label is clicked', async () => {
    const { user, settingStore, row, toggle } = await openMenu()

    await user.click(row)

    expect(settingStore.set).toHaveBeenCalledExactlyOnceWith(
      'Comfy.VueNodes.Enabled',
      true
    )
    expect(toggle).toBeChecked()
  })

  it('disables Nodes 2.0 when the row label is clicked while enabled', async () => {
    const { user, settingStore, row, toggle } = await openMenu({
      vueNodesEnabled: true
    })

    await user.click(row)

    expect(settingStore.set).toHaveBeenCalledExactlyOnceWith(
      'Comfy.VueNodes.Enabled',
      false
    )
    expect(toggle).not.toBeChecked()
  })

  it('toggles once when the switch itself is clicked', async () => {
    const { user, settingStore, toggle } = await openMenu()

    await user.click(toggle)

    expect(settingStore.set).toHaveBeenCalledExactlyOnceWith(
      'Comfy.VueNodes.Enabled',
      true
    )
    expect(toggle).toBeChecked()
  })

  it('keeps the menu open after toggling so the change can be reverted', async () => {
    const { user, row, toggle } = await openMenu()

    await user.click(row)

    expect(toggle).toBeVisible()
  })
})
