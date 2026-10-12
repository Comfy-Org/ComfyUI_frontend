import { render, screen, waitFor, within } from '@testing-library/vue'
import { fromPartial } from '@total-typescript/shoehorn'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { describe, expect, it, onTestFinished, vi } from 'vitest'
import { nextTick } from 'vue'

import { testI18n } from '@/utils/__tests__/testI18n'
import { KeybindingImpl } from '@/platform/keybindings/keybinding'
import { useKeybindingStore } from '@/platform/keybindings/keybindingStore'
import { useCommandStore } from '@/stores/commandStore'

import KeybindingPanel from './KeybindingPanel.vue'

const editKeybinding = vi.hoisted(() => vi.fn())

vi.mock(import('@/composables/useEditKeybindingDialog'), () => ({
  useEditKeybindingDialog: () => ({ show: editKeybinding })
}))

vi.mock(import('@/platform/keybindings/presetService'), () => ({
  useKeybindingPresetService: () =>
    fromPartial({
      listPresets: async () => [],
      loadPreset: async () => null,
      switchToDefaultPreset: async () => {}
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

    expect(
      screen.getByRole('row', { name: /Single binding/ })
    ).not.toHaveAttribute('aria-expanded')
    const multiRow = screen.getByRole('row', { expanded: false })
    expect(multiRow).toHaveAccessibleName(/^Multiple bindings/)

    await waitForSearchAutofocus()
    multiRow.focus()
    await user.keyboard('{Enter}')

    await waitFor(() =>
      expect(multiRow).toHaveAttribute('data-state', 'selected')
    )
    expect(screen.getByRole('row', { expanded: true })).toBe(multiRow)
    expect(screen.getByTestId('keybinding-expansion-content')).toBeVisible()

    expect(multiRow).toHaveFocus()
    await user.keyboard(' ')
    expect(screen.getByRole('row', { expanded: false })).toBe(multiRow)
    expect(
      screen.queryByTestId('keybinding-expansion-content')
    ).not.toBeInTheDocument()
  })

  it('moves between rows with the arrow keys and tabs back to the last row', async () => {
    const user = userEvent.setup()
    registerCommand('command-alpha', 'Alpha')
    registerCommand('command-bravo', 'Bravo')
    renderPanel()
    await waitForSearchAutofocus()
    const sortButton = screen.getByRole('button', { name: 'Command' })
    const alphaRow = screen.getByRole('row', { name: /^Alpha/ })
    const bravoRow = screen.getByRole('row', { name: /^Bravo/ })

    sortButton.focus()
    await user.tab()
    expect(alphaRow).toHaveFocus()

    await user.keyboard('{ArrowDown}')
    expect(bravoRow).toHaveFocus()
    expect(alphaRow).toHaveAttribute('tabindex', '-1')

    sortButton.focus()
    await user.tab()
    expect(bravoRow).toHaveFocus()

    await user.keyboard('{ArrowUp}')
    expect(alphaRow).toHaveFocus()
  })

  it('keeps a row tabbable after tabbing out and hiding the last focused row', async () => {
    const user = userEvent.setup()
    registerCommand('command-alpha', 'Alpha')
    registerCommand('command-bravo', 'Bravo')
    renderPanel()
    await waitForSearchAutofocus()
    const sortButton = screen.getByRole('button', { name: 'Command' })
    const bravoRow = screen.getByRole('row', { name: /^Bravo/ })

    bravoRow.focus()
    bravoRow.addEventListener('keydown', (event) => event.preventDefault(), {
      once: true
    })
    await user.tab({ shift: true })
    await nextTick()
    sortButton.focus()
    await user.type(
      screen.getByPlaceholderText('Search Keybindings...'),
      'Alpha'
    )
    expect(bravoRow).not.toBeInTheDocument()

    sortButton.focus()
    await user.tab()

    expect(screen.getByRole('row', { name: /^Alpha/ })).toHaveFocus()
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
    },
    {
      change: 'searching',
      act: (user: UserEvent) =>
        user.type(
          screen.getByPlaceholderText('Search Keybindings...'),
          'command-00'
        ),
      expectedRows: 10
    }
  ])(
    'returns from the last page to the first after $change',
    async ({ act, expectedRows }) => {
      const user = userEvent.setup()
      registerCommands(105)
      const { container } = renderPanel()
      await user.click(screen.getByRole('button', { name: 'Page 3' }))
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
  })

  it.for(['{Enter}', ' '])(
    'runs a focused row action button once on %j without activating the row',
    async (key) => {
      const user = userEvent.setup()
      registerCommand('command-single', 'Single binding', ['S'])
      renderPanel()
      await waitForSearchAutofocus()
      const row = screen.getByRole('row', { name: /Single binding/ })

      within(row).getByRole('button', { name: 'Add new keybinding' }).focus()
      await user.keyboard(key)

      expect(editKeybinding).toHaveBeenCalledOnce()
      expect(editKeybinding).toHaveBeenCalledWith(
        expect.objectContaining({ commandId: 'command-single', mode: 'add' })
      )
      expect(row).not.toHaveAttribute('data-state', 'selected')
    }
  )

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

  it.for(['{Shift>}{F10}{/Shift}', '{ContextMenu}'])(
    'opens the focused row menu with %s and refocuses the row on Escape',
    async (keys) => {
      const user = userEvent.setup()
      registerCommand('command-plain', 'Plain command')
      renderPanel()
      await waitForSearchAutofocus()
      const row = screen.getByRole('row', { name: /Plain command/ })

      row.focus()
      await user.keyboard(keys)
      await waitFor(() => expect(screen.getByRole('menu')).toHaveFocus())
      await user.keyboard('{Escape}')

      await waitFor(() => expect(row).toHaveFocus())
    }
  )
})
