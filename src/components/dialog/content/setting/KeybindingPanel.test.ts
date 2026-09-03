import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import enMessages from '@/locales/en/main.json' with { type: 'json' }
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

import KeybindingPanel from './KeybindingPanel.vue'

const editKeybinding = vi.hoisted(() => vi.fn())

vi.mock('@/composables/useEditKeybindingDialog', () => ({
  useEditKeybindingDialog: () => ({ show: editKeybinding })
}))

vi.mock('@/platform/keybindings/keybindingService', () => ({
  useKeybindingService: () => ({ persistUserKeybindings: vi.fn() })
}))

vi.mock('@/platform/keybindings/presetService', () => ({
  useKeybindingPresetService: () => ({
    deletePreset: vi.fn(),
    exportPreset: vi.fn(),
    importPreset: vi.fn(),
    listPresets: vi.fn().mockResolvedValue([]),
    loadPreset: vi.fn(),
    promptAndSaveNewPreset: vi.fn(),
    switchPreset: vi.fn(),
    switchToDefaultPreset: vi.fn()
  })
}))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: vi.fn() })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: { en: enMessages }
})

function registerCommand(id: string, label: string) {
  useCommandStore().registerCommand({ id, label, function: vi.fn() })
}

function renderPanel() {
  for (const id of ['keybinding-panel-header', 'keybinding-panel-actions']) {
    const target = document.createElement('div')
    target.id = id
    document.body.append(target)
  }

  return render(KeybindingPanel, {
    global: {
      directives: { tooltip: () => {} },
      plugins: [i18n],
      stubs: {
        DropdownMenu: true,
        KeybindingPresetToolbar: true
      }
    }
  })
}

function getVisibleCommandIds(container: Element) {
  if (!(container instanceof HTMLElement)) {
    throw new Error('Expected an HTML render container')
  }
  return within(container)
    .queryAllByTitle(/^command-/)
    .map((element) => element.getAttribute('title'))
}

describe('KeybindingPanel', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('activates focused rows from the keyboard', async () => {
    const user = userEvent.setup()
    registerCommand('command-multi', 'Multiple bindings')
    const keybindingStore = useKeybindingStore()
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'command-multi',
        combo: { key: 'A', ctrl: true }
      })
    )
    keybindingStore.addDefaultKeybinding(
      new KeybindingImpl({
        commandId: 'command-multi',
        combo: { key: 'B', ctrl: true }
      })
    )
    renderPanel()
    let row = screen.getByRole('row', {
      name: /Multiple bindings.*Keybindings:.* -$/
    })

    expect(row).toHaveAttribute('tabindex', '0')
    await user.tab()
    await user.tab()
    expect(row).toHaveFocus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(
        screen.getByRole('row', {
          name: /Multiple bindings.*Keybindings:.* -$/
        })
      ).toHaveAttribute('data-state', 'selected')
    )
    row = screen.getByRole('row', {
      name: /Multiple bindings.*Keybindings:.* -$/
    })
    expect(screen.getByTestId('keybinding-expansion-content')).toBeVisible()

    expect(row).toHaveFocus()
    await user.keyboard(' ')
    expect(
      screen.queryByTestId('keybinding-expansion-content')
    ).not.toBeInTheDocument()
  })

  it('changes page size, navigates to the last page, and resets on search', async () => {
    const user = userEvent.setup()
    for (let index = 0; index < 105; index++) {
      const suffix = index.toString().padStart(3, '0')
      registerCommand(`command-${suffix}`, `Command ${suffix}`)
    }
    const { container } = renderPanel()

    await user.click(screen.getByRole('combobox', { name: 'Items per page' }))
    await user.click(await screen.findByRole('option', { name: '25' }))

    await waitFor(() =>
      expect(getVisibleCommandIds(container)).toHaveLength(25)
    )
    await user.click(screen.getByRole('button', { name: 'Last page' }))

    await waitFor(() => expect(getVisibleCommandIds(container)).toHaveLength(5))
    expect(screen.getByTitle('command-100')).toBeVisible()

    await user.type(
      screen.getByPlaceholderText('Search Keybindings...'),
      'command-000'
    )

    expect(await screen.findByTitle('command-000')).toBeVisible()
    expect(screen.queryByTitle('command-100')).not.toBeInTheDocument()
  })

  it('preserves insertion order until the command column is sorted', async () => {
    const user = userEvent.setup()
    registerCommand('command-zulu', 'Zulu')
    registerCommand('command-alpha', 'Alpha')
    registerCommand('command-middle', 'Middle')
    const { container } = renderPanel()

    expect(getVisibleCommandIds(container)).toEqual([
      'command-zulu',
      'command-alpha',
      'command-middle'
    ])

    await user.click(screen.getByRole('button', { name: 'Command' }))
    expect(getVisibleCommandIds(container)).toEqual([
      'command-alpha',
      'command-middle',
      'command-zulu'
    ])

    await user.click(screen.getByRole('button', { name: 'Command' }))
    expect(getVisibleCommandIds(container)).toEqual([
      'command-zulu',
      'command-middle',
      'command-alpha'
    ])
  })
})
