import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'

import { testI18n } from '@/components/searchbox/v2/__test__/testUtils'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

import KeybindingPanel from './KeybindingPanel.vue'

const editKeybinding = vi.hoisted(() => vi.fn())

vi.mock(import('@/composables/useEditKeybindingDialog'), () => ({
  useEditKeybindingDialog: () => ({ show: editKeybinding })
}))

vi.mock(import('@/platform/keybindings/presetService'), () => ({
  useKeybindingPresetService: () => ({
    applyPreset: vi.fn(),
    deletePreset: vi.fn(),
    exportPreset: vi.fn(),
    importPreset: vi.fn(),
    listPresets: vi.fn(async () => []),
    loadPreset: vi.fn(),
    promptAndSaveNewPreset: vi.fn(),
    savePreset: vi.fn(),
    switchPreset: vi.fn(),
    switchToDefaultPreset: vi.fn()
  })
}))

function registerCommand(id: string, label: string, keys: string[] = []) {
  useCommandStore().registerCommand({ id, label, function: vi.fn() })
  for (const key of keys) {
    useKeybindingStore().addDefaultKeybinding(
      new KeybindingImpl({ commandId: id, combo: { key, ctrl: true } })
    )
  }
}

function registerCommands(count: number) {
  for (let index = 0; index < count; index++) {
    const suffix = index.toString().padStart(3, '0')
    registerCommand(`command-${suffix}`, `Command ${suffix}`)
  }
}

function renderPanel() {
  for (const id of ['keybinding-panel-header', 'keybinding-panel-actions']) {
    const target = document.createElement('div')
    target.id = id
    document.body.append(target)
    onTestFinished(() => target.remove())
  }

  return render(KeybindingPanel, {
    global: {
      directives: { tooltip: () => {} },
      plugins: [testI18n],
      stubs: {
        Menu: true,
        KeybindingPresetToolbar: true
      }
    }
  })
}

async function waitForSearchAutofocus() {
  await waitFor(() =>
    expect(screen.getByPlaceholderText('Search Keybindings...')).toHaveFocus()
  )
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
  it('activates focused rows from the keyboard and exposes expansion', async () => {
    const user = userEvent.setup()
    registerCommand('command-multi', 'Multiple bindings', ['A', 'B'])
    registerCommand('command-single', 'Single binding', ['S'])
    renderPanel()
    const multiRow = () =>
      screen.getByRole('row', { name: /Multiple bindings.*Keybindings:.* -$/ })

    expect(
      screen.getByRole('row', { name: /Single binding/ })
    ).not.toHaveAttribute('aria-expanded')
    expect(multiRow()).toHaveAttribute('aria-expanded', 'false')
    expect(multiRow()).toHaveAttribute('tabindex', '0')

    await waitForSearchAutofocus()
    multiRow().focus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(multiRow()).toHaveAttribute('data-state', 'selected')
    )
    expect(multiRow()).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByTestId('keybinding-expansion-content')).toBeVisible()

    expect(multiRow()).toHaveFocus()
    await user.keyboard(' ')
    expect(multiRow()).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.queryByTestId('keybinding-expansion-content')
    ).not.toBeInTheDocument()
  })

  it('changes page size, navigates to the last page, and resets on search', async () => {
    const user = userEvent.setup()
    registerCommands(105)
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

  it.for([
    {
      change: 'sorting',
      act: (user: UserEvent) =>
        user.click(screen.getByRole('button', { name: 'Command' })),
      expectedRows: 50
    },
    {
      change: 'changing the page size',
      act: async (user: UserEvent) => {
        await user.click(
          screen.getByRole('combobox', { name: 'Items per page' })
        )
        await user.click(await screen.findByRole('option', { name: '100' }))
      },
      expectedRows: 100
    }
  ])(
    'returns from the last page to the first after $change',
    async ({ act, expectedRows }) => {
      const user = userEvent.setup()
      registerCommands(105)
      const { container } = renderPanel()
      await user.click(screen.getByRole('button', { name: 'Last page' }))
      await waitFor(() =>
        expect(getVisibleCommandIds(container)).toHaveLength(5)
      )

      await act(user)

      await waitFor(() =>
        expect(getVisibleCommandIds(container)).toHaveLength(expectedRows)
      )
      expect(getVisibleCommandIds(container)[0]).toBe('command-000')
    }
  )

  it('preserves insertion order until the command column is sorted', async () => {
    const user = userEvent.setup()
    registerCommand('command-zulu', 'Zulu')
    registerCommand('command-alpha', 'Alpha')
    registerCommand('command-middle', 'Middle')
    const { container } = renderPanel()

    expect(
      screen.getByRole('columnheader', { name: 'Command' })
    ).toHaveAttribute('aria-sort', 'none')
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

  it('runs row action buttons once without activating the row', async () => {
    const user = userEvent.setup()
    registerCommand('command-single', 'Single binding', ['S'])
    renderPanel()
    await waitForSearchAutofocus()
    const row = screen.getByRole('row', { name: /Single binding/ })

    await user.click(within(row).getByRole('button', { name: 'Edit' }))
    expect(editKeybinding).toHaveBeenCalledOnce()
    expect(editKeybinding).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: 'command-single', mode: 'edit' })
    )
    expect(row).not.toHaveAttribute('data-state', 'selected')

    editKeybinding.mockClear()
    await user.dblClick(
      within(row).getByRole('button', { name: 'Add new keybinding' })
    )
    expect(editKeybinding).not.toHaveBeenCalledWith(
      expect.objectContaining({ mode: 'edit' })
    )

    editKeybinding.mockClear()
    within(row).getByRole('button', { name: 'Add new keybinding' }).focus()
    await user.keyboard('{Enter}')
    expect(editKeybinding).toHaveBeenCalledOnce()
    expect(editKeybinding).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: 'command-single', mode: 'add' })
    )
    expect(row).not.toHaveAttribute('data-state', 'selected')
  })

  it('opens a row context menu whose command fires once', async () => {
    const user = userEvent.setup()
    registerCommand('command-plain', 'Plain command')
    renderPanel()
    const row = screen.getByRole('row', { name: /Plain command/ })

    await user.pointer({ keys: '[MouseRight]', target: row })
    expect(
      await screen.findByRole('menuitem', { name: 'Change keybinding' })
    ).toHaveAttribute('aria-disabled', 'true')
    await user.click(
      screen.getByRole('menuitem', { name: 'Add new keybinding' })
    )

    expect(editKeybinding).toHaveBeenCalledOnce()
    expect(editKeybinding).toHaveBeenCalledWith(
      expect.objectContaining({ commandId: 'command-plain', mode: 'add' })
    )
    await waitFor(() =>
      expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    )
  })
})
