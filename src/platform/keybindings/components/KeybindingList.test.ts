import { render, screen } from '@testing-library/vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'

import { KeybindingImpl } from '@/platform/keybindings/keybinding'

import KeybindingList from './KeybindingList.vue'

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      g: {
        nMoreKeybindings: '+ {count} more',
        nMoreKeybindingsCompact: '+ {count}',
        keybindingListAriaLabel: 'Keybindings: {combos}'
      }
    }
  }
})

function makeKeybinding(key: string, ctrl = false, shift = false) {
  return new KeybindingImpl({
    commandId: 'test.cmd',
    combo: { key, ctrl, shift }
  })
}

function renderList(props: {
  keybindings: KeybindingImpl[]
  isModified?: boolean
}) {
  return render(KeybindingList, {
    props,
    global: { plugins: [i18n] }
  })
}

describe('KeybindingList', () => {
  it('renders "-" placeholder when there are no keybindings', () => {
    renderList({ keybindings: [] })
    expect(screen.getByText('-')).toBeInTheDocument()
    expect(screen.queryByTestId('keybinding-list')).not.toBeInTheDocument()
  })

  it('renders a single keybinding without any "more" badge', () => {
    renderList({ keybindings: [makeKeybinding('A', true)] })
    expect(screen.getByTestId('keybinding-list')).toBeInTheDocument()
    expect(
      screen.queryByTestId('keybinding-list-more-wide')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('keybinding-list-more-medium')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('keybinding-list-more-compact')
    ).not.toBeInTheDocument()
  })

  it('with 2 keybindings: omits wide-tier badge, shows medium/compact for narrow widths', () => {
    renderList({
      keybindings: [makeKeybinding('A', true), makeKeybinding('B', true)]
    })

    expect(
      screen.queryByTestId('keybinding-list-more-wide')
    ).not.toBeInTheDocument()

    expect(screen.getByTestId('keybinding-list-more-medium')).toHaveTextContent(
      '+ 1 more'
    )
    expect(
      screen.getByTestId('keybinding-list-more-compact')
    ).toHaveTextContent('+ 1')
  })

  it('with 3 keybindings: wide-tier uses count-minus-two, narrower tiers use count-minus-one', () => {
    renderList({
      keybindings: [
        makeKeybinding('A', true),
        makeKeybinding('B', true),
        makeKeybinding('C', true)
      ]
    })

    expect(screen.getByTestId('keybinding-list-more-wide')).toHaveTextContent(
      '+ 1 more'
    )
    expect(screen.getByTestId('keybinding-list-more-medium')).toHaveTextContent(
      '+ 2 more'
    )
    expect(
      screen.getByTestId('keybinding-list-more-compact')
    ).toHaveTextContent('+ 2')
  })

  it('uses a container query parent so the visible tier can adapt to width', () => {
    renderList({
      keybindings: [makeKeybinding('A', true), makeKeybinding('B', true)]
    })
    expect(screen.getByTestId('keybinding-list').className).toContain(
      '@container/keybindings'
    )
  })

  it('emits an accessible label listing all combos', () => {
    renderList({
      keybindings: [makeKeybinding('A', true), makeKeybinding('B', true, true)]
    })
    const ariaText = screen.getByTestId('keybinding-list-aria').textContent
    expect(ariaText).toContain('Keybindings:')
    expect(ariaText).toContain('Ctrl')
    expect(ariaText).toContain('A')
    expect(ariaText).toContain('Shift')
    expect(ariaText).toContain('B')
  })
})
