import userEvent from '@testing-library/user-event'
import { render, screen } from '@testing-library/vue'
import { describe, expect, it, vi } from 'vitest'
import { nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'

import { useSettingStore } from '@/platform/settings/settingStore'
import type * as telemetry from '@/platform/telemetry'
import { useCommandStore } from '@/stores/commandStore'
import type { CommandMenuItem } from '@/stores/menuItemStore'
import { useMenuItemStore } from '@/stores/menuItemStore'

import ComfyMenuButton from './ComfyMenuButton.vue'

vi.mock(import('@/platform/telemetry'))

const { useTelemetry } = await vi.importMock<typeof telemetry>(
  '@/platform/telemetry'
)

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

  function reportedEvents() {
    return vi
      .mocked(useTelemetry()?.trackUiButtonClicked)
      ?.mock.calls.map(([event]) => event)
  }

  const MENU_OPENED = {
    button_id: 'sidebar_comfy_menu_opened',
    element_group: 'sidebar'
  }

  function comfyMenuEvent(button_id: string) {
    return { button_id, element_group: 'comfy_menu' }
  }

  function registerCommand(id: string, source: string) {
    useCommandStore().registerCommand({
      id,
      label: id,
      function: () => undefined,
      source
    })
  }

  it.for([
    {
      role: 'menuitem',
      name: 'New',
      expected: [
        MENU_OPENED,
        comfyMenuEvent('comfy_menu_comfy_new_blank_workflow_clicked')
      ],
      runsCommand: true
    },
    {
      role: 'menuitem',
      name: 'Fit View',
      expected: [
        MENU_OPENED,
        comfyMenuEvent('comfy_menu_comfy_canvas_fit_view_clicked')
      ],
      runsCommand: true
    },
    {
      role: 'menuitem',
      name: 'Zoom In',
      expected: [
        MENU_OPENED,
        comfyMenuEvent('comfy_menu_comfy_canvas_zoom_in_clicked')
      ],
      runsCommand: true
    },
    {
      role: 'menuitem',
      name: 'Do thing',
      expected: [
        MENU_OPENED,
        comfyMenuEvent('comfy_menu_extension_command_clicked')
      ],
      runsCommand: true
    },
    {
      role: 'menuitem',
      name: 'g.settings',
      expected: [
        MENU_OPENED,
        { button_id: 'sidebar_settings_menu_opened', element_group: 'sidebar' }
      ],
      runsCommand: false
    },
    {
      role: 'menuitem',
      name: 'menuLabels.Browse Templates',
      expected: [
        MENU_OPENED,
        comfyMenuEvent('comfy_menu_browse_templates_clicked')
      ],
      runsCommand: false
    },
    {
      role: 'menuitem',
      name: 'menu.manageExtensions',
      expected: [
        MENU_OPENED,
        comfyMenuEvent('comfy_menu_manage_extensions_clicked')
      ],
      runsCommand: false
    },
    {
      role: 'menuitemcheckbox',
      name: NODES_2_LABEL,
      expected: [
        MENU_OPENED,
        { button_id: 'menu_nodes_2.0_toggle_enabled', element_group: 'sidebar' }
      ],
      runsCommand: false
    }
  ] as const)(
    'reports the button ids for a click on $name',
    async ({ role, name, expected, runsCommand }) => {
      const fixtures = [
        { label: 'New', commandId: 'Comfy.NewBlankWorkflow', source: 'System' },
        {
          label: 'Fit View',
          commandId: 'Comfy.Canvas.FitView',
          source: 'System'
        },
        {
          label: 'Zoom In',
          commandId: 'Comfy.Canvas.ZoomIn',
          source: 'System',
          pressAndHoldInterval: 50
        },
        {
          label: 'Do thing',
          commandId: 'MyExtension.DoThing',
          source: 'MyExtension'
        }
      ]
      const items = fixtures.map(({ source, ...item }) => {
        registerCommand(item.commandId, source)
        return { ...item, command: vi.fn() }
      })
      useMenuItemStore().menuItems = items
      const menu = await openMenu()

      await menu.user.click(screen.getByRole(role, { name }))

      expect(reportedEvents()).toEqual(expected)
      expect(
        items.filter((item) => item.command.mock.calls.length > 0)
      ).toEqual(runsCommand ? [expect.objectContaining({ label: name })] : [])
    }
  )

  it.for([
    {
      submenu: 'File',
      menuItems: (save: () => void) => [
        {
          key: 'File',
          label: 'File',
          items: [
            {
              label: 'Save',
              commandId: 'Comfy.SaveWorkflow',
              command: save
            } satisfies CommandMenuItem
          ]
        }
      ],
      expected: 'comfy_menu_comfy_save_workflow_clicked',
      saveCalls: 1
    },
    {
      submenu: 'menu.theme',
      menuItems: () => [],
      expected: 'comfy_menu_theme_clicked',
      saveCalls: 0
    }
  ])(
    'reports $expected when the first $submenu submenu item is activated',
    async ({ submenu, menuItems, expected, saveCalls }) => {
      const save = vi.fn()
      registerCommand('Comfy.SaveWorkflow', 'System')
      useMenuItemStore().menuItems = menuItems(save)
      const menu = await openMenu()

      await menu.user.hover(screen.getByRole('menuitem', { name: submenu }))
      await screen.findByRole('menu', { name: submenu })
      await menu.user.keyboard('{ArrowRight}{Enter}')

      expect(reportedEvents()).toEqual([MENU_OPENED, comfyMenuEvent(expected)])
      expect(save).toHaveBeenCalledTimes(saveCalls)
    }
  )

  it('does not advertise Nodes 2.0 as beta', async () => {
    await openMenu()

    expect(screen.queryByText('BETA')).not.toBeInTheDocument()
  })
})
