import {
  getDefaultNormalizer,
  render,
  screen,
  within
} from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import type { UserEvent } from '@testing-library/user-event'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import { listSkillPacks } from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })
vi.mock(import('@/platform/telemetry/reportError'))

const DESCRIPTION_DELAY_MS = 250
const HOVER_CLOSE_DELAY_MS = 150
const LANDSCAPE = 'Compose a landscape'
const PORTRAIT = 'Compose a portrait\nKeep the subject recognizable'

function pack(name: string, description: string): SkillPack {
  return {
    id: name,
    name,
    description,
    body: 'Private instructions never needed by the picker',
    body_hash: 'hash',
    created_at: '2026-10-06T00:00:00Z',
    updated_at: '2026-10-06T00:00:00Z'
  }
}

function mount() {
  const skills = useSkillPacksStore()
  skills.flagsEnabled = true
  skills.hasLoaded = true
  skills.catalogConfirmed = true
  skills.packs = [pack('landscape', LANDSCAPE), pack('portrait', PORTRAIT)]
  vi.spyOn(skills, 'startFlagGate').mockResolvedValue()
  render(Composer, {
    props: { hasWorkflowTarget: true },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return useAgentComposerStore()
}

const elapse = (ms: number) => vi.advanceTimersByTimeAsync(ms)
const INPUT_SETTLE_MS = 50

async function openMenu(trigger: '/' | '@') {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
  const composer = mount()
  await user.click(screen.getByRole('textbox'))
  await user.keyboard(trigger)
  return { user, composer }
}

function shownDescription(text: string) {
  return screen.queryByText(text, {
    normalizer: getDefaultNormalizer({ collapseWhitespace: false })
  })
}

function skillRow(name: string) {
  return within(screen.getByRole('menu', { name: 'Skills' })).getByRole(
    'menuitem',
    { name }
  )
}

async function describePortrait() {
  const opened = await openMenu('/')
  await opened.user.keyboard('{ArrowDown}{ArrowDown}')
  await elapse(DESCRIPTION_DELAY_MS)
  expect(shownDescription(PORTRAIT)).toBeVisible()
  return opened
}

describe('Composer skill menu description', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.mocked(listSkillPacks).mockResolvedValue([
      pack('landscape', LANDSCAPE),
      pack('portrait', PORTRAIT)
    ])
  })

  it.for([
    { input: 'typing a filter', keys: 'po', description: PORTRAIT },
    { input: 'an arrow key', keys: '{ArrowDown}', description: LANDSCAPE }
  ])(
    'describes the highlighted skill after $input, only after the delay and without a title',
    async ({ keys, description }) => {
      const { user } = await openMenu('/')
      await user.keyboard(keys)
      await elapse(INPUT_SETTLE_MS)
      expect(shownDescription(description)).toBeNull()

      await elapse(DESCRIPTION_DELAY_MS)
      expect(shownDescription(description)).toBeVisible()
      expect(screen.getByRole('menuitem', { description })).toBeVisible()
      expect(screen.queryByText(/^\/(portrait|landscape)$/)).toBeNull()
    }
  )

  it('describes nothing at a bare slash, including after deleting a filter back to it', async () => {
    const { user } = await openMenu('/')
    await elapse(DESCRIPTION_DELAY_MS * 2)
    expect(shownDescription(LANDSCAPE)).toBeNull()
    expect(shownDescription(PORTRAIT)).toBeNull()
    await user.keyboard('po')
    await elapse(INPUT_SETTLE_MS + DESCRIPTION_DELAY_MS)
    expect(shownDescription(PORTRAIT)).toBeVisible()
    await user.keyboard('{Backspace}{Backspace}')
    await elapse(DESCRIPTION_DELAY_MS * 2)
    expect(shownDescription(PORTRAIT)).toBeNull()
    expect(skillRow('portrait')).toHaveAttribute('data-active', 'false')
  })

  it.for([
    {
      input: 'keyboard',
      activateLandscape: (user: UserEvent) => user.keyboard('{ArrowUp}')
    },
    {
      input: 'mouse',
      activateLandscape: (user: UserEvent) => user.hover(skillRow('landscape'))
    }
  ])(
    'moves the description to the row activated by $input after the delay',
    async ({ activateLandscape }) => {
      const { user } = await describePortrait()
      await activateLandscape(user)
      expect(shownDescription(PORTRAIT)).toBeNull()
      expect(shownDescription(LANDSCAPE)).toBeNull()

      await elapse(DESCRIPTION_DELAY_MS)
      expect(shownDescription(LANDSCAPE)).toBeVisible()
      expect(skillRow('landscape')).toHaveAccessibleDescription(LANDSCAPE)
      expect(shownDescription(PORTRAIT)).toBeNull()
    }
  )

  it('hides a hovered description once the pointer leaves the menu', async () => {
    const { user } = await openMenu('/')
    await user.hover(skillRow('portrait'))
    await elapse(DESCRIPTION_DELAY_MS)
    expect(shownDescription(PORTRAIT)).toBeVisible()
    await user.unhover(screen.getByRole('menu', { name: 'Skills' }))
    await elapse(HOVER_CLOSE_DELAY_MS)
    expect(shownDescription(PORTRAIT)).toBeNull()
  })

  it('does not describe a skill when the caret returns to an existing slash query', async () => {
    const { user } = await openMenu('/')
    await user.keyboard('po hello')
    expect(screen.queryByRole('menu', { name: 'Skills' })).toBeNull()
    const textbox = screen.getByRole('textbox')
    const text = document
      .createTreeWalker(textbox, NodeFilter.SHOW_TEXT)
      .nextNode()
    assert.exists(text)
    const selection = document.getSelection()
    assert.exists(selection)
    selection.collapse(text, '/po'.length)
    document.dispatchEvent(new Event('selectionchange'))
    await elapse(DESCRIPTION_DELAY_MS * 2)
    expect(skillRow('portrait')).toHaveAttribute('data-active', 'true')
    expect(shownDescription(PORTRAIT)).toBeNull()

    await user.keyboard('{ArrowDown}')
    await elapse(DESCRIPTION_DELAY_MS)
    expect(shownDescription(PORTRAIT)).toBeVisible()
  })

  it.for([
    {
      cause: 'the pointer leaves it',
      closeDescription: async (user: UserEvent, description: HTMLElement) => {
        await user.unhover(description)
        await elapse(HOVER_CLOSE_DELAY_MS)
      }
    },
    {
      cause: 'another row is hovered',
      closeDescription: (user: UserEvent) => user.hover(skillRow('landscape'))
    }
  ])(
    'keeps a hovered description open under the pointer and returns focus to the prompt when it closes because $cause',
    async ({ closeDescription }) => {
      const { user } = await openMenu('/')
      await user.hover(skillRow('portrait'))
      await elapse(DESCRIPTION_DELAY_MS)
      const description = shownDescription(PORTRAIT)
      assert.exists(description)
      await user.click(description)
      await elapse(HOVER_CLOSE_DELAY_MS * 2)
      expect(description).toBeVisible()
      expect(description).toHaveFocus()

      await closeDescription(user, description)
      expect(shownDescription(PORTRAIT)).toBeNull()
      expect(screen.getByRole('textbox')).toHaveFocus()
      expect(screen.getByRole('menu', { name: 'Skills' })).toBeVisible()
    }
  )

  it.for([
    {
      action: 'Escape',
      dismiss: (user: UserEvent) => user.keyboard('{Escape}')
    },
    {
      action: 'focus leaving the composer',
      dismiss: (user: UserEvent) => user.click(document.body)
    }
  ])(
    'hides the description on $action and keeps it hidden',
    async ({ dismiss }) => {
      const { user } = await describePortrait()
      await dismiss(user)
      expect(shownDescription(PORTRAIT)).toBeNull()
      await elapse(DESCRIPTION_DELAY_MS * 2)
      expect(shownDescription(PORTRAIT)).toBeNull()
      expect(shownDescription(LANDSCAPE)).toBeNull()
    }
  )

  it('lets the description be focused for selection and keeps the menu open when focus returns to the prompt', async () => {
    const { user, composer } = await describePortrait()
    const description = shownDescription(PORTRAIT)
    assert.exists(description)
    await user.click(description)
    expect(description).toHaveFocus()
    expect(shownDescription(PORTRAIT)).toBeVisible()
    expect(screen.getByRole('menu', { name: 'Skills' })).toBeVisible()
    expect(composer.draft).toBe('/')
    expect(composer.prompt.references).toEqual([])

    await user.click(screen.getByRole('textbox'))
    expect(screen.getByRole('menu', { name: 'Skills' })).toBeVisible()
  })

  it('closes the menu and returns focus to the prompt on Escape in a focused description', async () => {
    const { user, composer } = await describePortrait()
    const description = shownDescription(PORTRAIT)
    assert.exists(description)
    await user.click(description)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('menu', { name: 'Skills' })).toBeNull()
    expect(shownDescription(PORTRAIT)).toBeNull()
    expect(screen.getByRole('textbox')).toHaveFocus()
    expect(composer.draft).toBe('/')
    expect(composer.prompt.references).toEqual([])
  })

  it('closes the menu when focus moves from the description to another composer control', async () => {
    const { user } = await describePortrait()
    const description = shownDescription(PORTRAIT)
    assert.exists(description)
    await user.click(description)
    await user.click(screen.getByRole('button', { name: 'Add to prompt' }))
    expect(screen.queryByRole('menu', { name: 'Skills' })).toBeNull()
    expect(shownDescription(PORTRAIT)).toBeNull()
  })

  it('does not describe rows in the @ menu', async () => {
    await openMenu('@')
    await elapse(DESCRIPTION_DELAY_MS)
    expect(
      screen
        .getAllByRole('menuitem')
        .filter((row) => row.hasAttribute('aria-describedby'))
    ).toEqual([])
  })
})
