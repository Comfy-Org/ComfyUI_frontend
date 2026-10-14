import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import type { CommandMenuItem } from '@/stores/menuItemStore'
import { useMenuItemStore } from '@/stores/menuItemStore'

import ComfyMenuButton from './ComfyMenuButton.vue'

const mocks = vi.hoisted(() => ({ trackUiButtonClicked: vi.fn() }))

vi.mock<unknown>(import('@/platform/telemetry'), () => ({
  useTelemetry: () => mocks
}))

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
      plugins: [i18n]
    }
  })

  await user.click(screen.getByTestId('comfy-menu-button'))

  return {
    user,
    settingStore,
    row: screen.getByRole('menuitemcheckbox', { name: NODES_2_LABEL }),
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

  function reportedButtonIds() {
    return mocks.trackUiButtonClicked.mock.calls.map(
      ([event]) => event.button_id
    )
  }

  it.for([
    {
      role: 'menuitem',
      name: 'New',
      expected: [
        'sidebar_comfy_menu_opened',
        'comfy_menu_comfy_new_blank_workflow_clicked'
      ]
    },
    {
      role: 'menuitem',
      name: 'Do thing',
      expected: [
        'sidebar_comfy_menu_opened',
        'comfy_menu_extension_command_clicked'
      ]
    },
    {
      role: 'menuitem',
      name: 'Zoom In',
      expected: ['sidebar_comfy_menu_opened']
    },
    {
      role: 'menuitem',
      name: 'g.settings',
      expected: ['sidebar_comfy_menu_opened', 'sidebar_settings_menu_opened']
    },
    {
      role: 'menuitemcheckbox',
      name: NODES_2_LABEL,
      expected: ['sidebar_comfy_menu_opened', 'menu_nodes_2.0_toggle_enabled']
    }
  ] as const)(
    'reports $expected when $name is clicked',
    async ({ role, name, expected }) => {
      useMenuItemStore().menuItems = [
        { label: 'New', commandId: 'Comfy.NewBlankWorkflow', command: vi.fn() },
        {
          label: 'Do thing',
          commandId: 'MyExtension.DoThing',
          command: vi.fn()
        },
        {
          label: 'Zoom In',
          commandId: 'Comfy.Canvas.ZoomIn',
          pressAndHoldInterval: 50,
          command: vi.fn()
        }
      ]
      const menu = await openMenu()

      await menu.user.click(screen.getByRole(role, { name }))

      expect(reportedButtonIds()).toEqual(expected)
    }
  )

  it.for([
    { submenu: 'File', expected: 'comfy_menu_comfy_save_workflow_clicked' },
    { submenu: 'menu.theme', expected: 'comfy_menu_theme_clicked' }
  ])(
    'reports $expected when the first $submenu submenu item is activated',
    async ({ submenu, expected }) => {
      const save: CommandMenuItem = {
        label: 'Save',
        commandId: 'Comfy.SaveWorkflow',
        command: vi.fn()
      }
      useMenuItemStore().menuItems = [
        { key: 'File', label: 'File', items: [save] }
      ]
      const menu = await openMenu()

      await menu.user.hover(screen.getByRole('menuitem', { name: submenu }))
      await screen.findByRole('menu', { name: submenu })
      await menu.user.keyboard('{ArrowRight}{Enter}')

      expect(reportedButtonIds()).toEqual([
        'sidebar_comfy_menu_opened',
        expected
      ])
    }
  )

  it('does not advertise Nodes 2.0 as beta', async () => {
    await openMenu()

    expect(screen.queryByText('BETA')).not.toBeInTheDocument()
  })
})
