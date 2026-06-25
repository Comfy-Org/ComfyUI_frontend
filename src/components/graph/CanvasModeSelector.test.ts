import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import CanvasModeSelector from '@/components/graph/CanvasModeSelector.vue'

const mockExecute = vi.fn()
const mockGetCommand = vi.fn().mockReturnValue({
  keybinding: { combo: { getKeySequences: () => ['V'] } }
})
const mockFormatKeySequence = vi.fn().mockReturnValue('V')

const canvasMock = { read_only: false }

vi.mock('@/stores/commandStore', () => ({
  useCommandStore: () => ({
    execute: mockExecute,
    getCommand: mockGetCommand,
    formatKeySequence: mockFormatKeySequence
  })
}))

vi.mock('@/renderer/core/canvas/canvasStore', () => ({
  useCanvasStore: () => ({ canvas: canvasMock })
}))

const i18n = createI18n({
  legacy: false,
  locale: 'en',
  messages: {
    en: {
      graphCanvasMenu: {
        select: 'Select',
        hand: 'Hand',
        canvasMode: 'Canvas Mode'
      }
    }
  }
})

function renderComponent() {
  const user = userEvent.setup()
  render(CanvasModeSelector, {
    global: { plugins: [i18n] }
  })
  return { user }
}

async function openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Canvas Mode' }))
}

describe('CanvasModeSelector', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    canvasMock.read_only = false
  })

  it('renders Select and Hand menu items when opened', async () => {
    const { user } = renderComponent()
    await openMenu(user)

    expect(
      await screen.findByRole('menuitem', { name: /Select/ })
    ).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: /Hand/ })).toBeInTheDocument()
  })

  it('executes Comfy.Canvas.Lock when Hand is selected from non-readonly state', async () => {
    const { user } = renderComponent()
    await openMenu(user)

    await user.click(await screen.findByRole('menuitem', { name: /Hand/ }))

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.Lock')
  })

  it('executes Comfy.Canvas.Unlock when Select is chosen from readonly state', async () => {
    canvasMock.read_only = true
    const { user } = renderComponent()
    await openMenu(user)

    await user.click(await screen.findByRole('menuitem', { name: /Select/ }))

    expect(mockExecute).toHaveBeenCalledWith('Comfy.Canvas.Unlock')
  })
})
