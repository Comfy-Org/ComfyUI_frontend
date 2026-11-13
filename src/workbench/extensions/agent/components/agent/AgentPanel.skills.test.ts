import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'
import { listSkillPacks } from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import AgentPanel from './AgentPanel.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'

setupInlinePromptEditorDom()

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@comfyorg/telemetry'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })

function mount(props: Partial<ComponentProps<typeof AgentPanel>> = {}) {
  return render(AgentPanel, {
    props: {
      entries: [],
      historyGroups: { current: [], today: [], yesterday: [], earlier: [] },
      ...props
    },
    global: { plugins: [i18n], stubs: { WorkflowSelectorChip: true } }
  })
}

function pack(name: string, description: string): SkillPack {
  return {
    id: name,
    name,
    description,
    body: 'Instructions',
    body_hash: 'hash',
    created_at: '2026-10-06T00:00:00Z',
    updated_at: '2026-10-06T00:00:00Z'
  }
}

const PORTRAIT = pack('portrait', 'Compose a portrait')

function seedSkills(packs: SkillPack[]) {
  vi.mocked(listSkillPacks).mockResolvedValue(packs)
  const skills = useSkillPacksStore()
  skills.flagsEnabled = true
  skills.hasLoaded = true
  skills.catalogConfirmed = true
  skills.packs = packs
  vi.spyOn(skills, 'startFlagGate').mockResolvedValue()
}

function backToChat() {
  return userEvent.click(screen.getByRole('button', { name: 'Back to chat' }))
}

describe('AgentPanel skills screen', () => {
  beforeEach(() => {
    seedSkills([])
    useAgentPanelStore().view = { screen: 'skills' }
  })

  it('replaces the chat while keeping the panel header', () => {
    mount()

    expect(screen.getByRole('heading', { name: 'Skills' })).toBeVisible()
    expect(screen.queryByTestId('agent-panel-chat-controls')).toBeNull()
    expect(screen.queryByTestId('agent-panel-footer')).toBeNull()
    expect(screen.getByRole('button', { name: 'New chat' })).toBeVisible()
  })

  it('returns to the chat with the draft intact and the prompt focused', async () => {
    useAgentComposerStore().setText('unfinished draft')
    mount()

    await backToChat()

    expect(useAgentPanelStore().view).toEqual({ screen: 'chat' })
    const prompt = await screen.findByRole('textbox')
    expect(prompt).toHaveTextContent('unfinished draft')
    expect(prompt).toHaveFocus()
  })

  it('shows the conversation as it stands on return, including turns that arrived meanwhile', async () => {
    const first = {
      id: toTurnId('turn-1'),
      role: 'user' as const,
      text: 'first request'
    }
    const second = {
      id: toTurnId('turn-2'),
      role: 'user' as const,
      text: 'second request'
    }
    const { rerender } = mount({ entries: [first] })

    await rerender({ entries: [first, second] })
    await backToChat()

    expect(await screen.findByText('second request')).toBeVisible()
  })

  it('starts a new chat from the panel header and shows it', async () => {
    const { emitted } = mount()

    await userEvent.click(screen.getByRole('button', { name: 'New chat' }))

    expect(emitted().newChat).toEqual([['new_chat_button']])
    expect(useAgentPanelStore().view).toEqual({ screen: 'chat' })
    expect(screen.getByTestId('agent-panel-footer')).toBeVisible()
  })

  it('leaves an open form for a new chat without asking, dropping what was typed', async () => {
    const { emitted } = mount()
    await userEvent.click(
      screen.getAllByRole('button', { name: 'Add skill' })[0]
    )
    await userEvent.click(await screen.findByRole('textbox', { name: 'Name' }))
    await userEvent.keyboard('portrait')

    await userEvent.click(screen.getByRole('button', { name: 'New chat' }))

    expect(emitted().newChat).toEqual([['new_chat_button']])
    expect(screen.queryByText('Discard unsaved changes?')).toBeNull()
    expect(useAgentPanelStore().view).toEqual({ screen: 'chat' })
    expect(screen.getByTestId('agent-panel-footer')).toBeVisible()
  })

  it('reports the standing paywall only while the chat is visible', async () => {
    const { emitted } = mount({ creditsExhausted: true })

    expect(emitted().standingPaywallShown).toBeUndefined()
    expect(screen.queryByTestId('agent-credits-exhausted-paywall')).toBeNull()

    await backToChat()

    expect(emitted().standingPaywallShown).toHaveLength(1)
    expect(
      await screen.findByTestId('agent-credits-exhausted-paywall')
    ).toBeVisible()
  })

  it('hides the top free-use banner until the chat is back', async () => {
    mount({ freeUsePlacement: 'top-banner' })

    expect(screen.queryByRole('note', { name: 'Free use notice' })).toBeNull()

    await backToChat()

    expect(
      await screen.findByRole('note', { name: 'Free use notice' })
    ).toBeVisible()
  })

  it.for([
    { blocked: true, inert: true },
    { blocked: false, inert: false }
  ])(
    'follows the host fence: blocked=$blocked makes the screen inert=$inert',
    ({ blocked, inert }) => {
      mount({ blocked })

      const element = screen.getByTestId('agent-skills-screen')

      expect(element.hasAttribute('inert')).toBe(inert)
    }
  )
})

describe('AgentPanel reaching the skills screen', () => {
  beforeEach(() => {
    seedSkills([PORTRAIT])
    useAgentPanelStore().view = { screen: 'chat' }
  })

  async function openSkillsSubmenu() {
    await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Skills' })
    )
  }

  it('opens from the add menu with the keyboard alone and puts focus on Back', async () => {
    mount()
    await userEvent.click(screen.getByRole('button', { name: 'Add to prompt' }))
    screen.getByRole('menuitem', { name: 'Skills' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    const manage = await screen.findByRole('menuitem', {
      name: 'Manage skills'
    })
    manage.focus()
    await userEvent.keyboard('{Enter}')

    expect(await screen.findByRole('heading', { name: 'Skills' })).toBeVisible()
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Back to chat' })).toHaveFocus()
    )
  })

  it('keeps the draft and its skill reference untouched while the screen is open', async () => {
    const composer = useAgentComposerStore()
    mount()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('Compare ')
    await openSkillsSubmenu()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'portrait' })
    )
    const before = structuredClone(composer.prompt)

    await openSkillsSubmenu()
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Manage skills' })
    )

    expect(await screen.findByRole('heading', { name: 'Skills' })).toBeVisible()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(composer.prompt).toEqual(before)

    await backToChat()

    expect(await screen.findByTestId('skill-reference')).toHaveTextContent(
      '/portrait'
    )
    expect(composer.prompt).toEqual(before)
  })

  it('keeps the add menu out of reach while the host fence is up', () => {
    mount({ blocked: true })

    const footer = screen.getByTestId('agent-panel-footer')

    expect(footer).toHaveAttribute('inert')
    expect(
      within(footer).getByRole('button', { name: 'Add to prompt' })
    ).toBeInTheDocument()
  })
})
