import { render, screen, waitFor, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'
import {
  listSkillPacks,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'

import { useAgentComposerStore } from '../../stores/agent/agentComposerStore'
import { parseSkillReferenceText } from '../../utils/skillReferenceText'
import Composer from './Composer.vue'
import { setupInlinePromptEditorDom } from './composer/inlinePromptEditorTestSetup'
import UserMessage from './message/UserMessage.vue'
import { userMessageClipboard } from './message/userMessageClipboard'

setupInlinePromptEditorDom()
vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/scripts/api'))
vi.mock(import('@/platform/telemetry'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })
vi.mock(import('@/platform/telemetry/reportError'))

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

function mount(props: ComponentProps<typeof Composer> = {}) {
  const skills = useSkillPacksStore()
  skills.flagsEnabled = true
  skills.hasLoaded = true
  skills.catalogConfirmed = true
  skills.packs = [
    pack('landscape', 'Compose a landscape'),
    pack('portrait', 'Compose a portrait\nKeep the subject recognizable')
  ]
  vi.spyOn(skills, 'startFlagGate').mockResolvedValue()
  const view = render(Composer, {
    props: { hasWorkflowTarget: true, ...props },
    global: { plugins: [i18n], directives: { tooltip: () => {} } }
  })
  return { ...view, skills, composer: useAgentComposerStore() }
}

async function type(text: string) {
  await userEvent.click(screen.getByRole('textbox'))
  await userEvent.keyboard(text)
}

describe('Composer skill selection', () => {
  beforeEach(() => {
    vi.mocked(listSkillPacks).mockResolvedValue([
      pack('landscape', 'Compose a landscape'),
      pack('portrait', 'Compose a portrait\nKeep the subject recognizable')
    ])
  })

  it('refreshes on opening and reopening while retaining cached matches, without fetching on filter edits', async () => {
    let resolve: (packs: SkillPack[]) => void = () => {}
    const pending = new Promise<SkillPack[]>((settle) => {
      resolve = settle
    })
    vi.mocked(listSkillPacks).mockReturnValueOnce(pending)
    mount()
    await type('/')
    expect(screen.getByRole('menuitem', { name: 'portrait' })).toBeVisible()
    const created = pack('created-by-agent', 'A newly authored skill')
    resolve([created])
    expect(
      await screen.findByRole('menuitem', { name: 'created-by-agent' })
    ).toBeVisible()
    await userEvent.keyboard('created')
    expect(listSkillPacks).toHaveBeenCalledOnce()
    await userEvent.keyboard('{Escape}{Control>}a{/Control}{Backspace}')
    vi.mocked(listSkillPacks).mockResolvedValueOnce([
      pack('latest-skill', 'Another new skill')
    ])
    await userEvent.keyboard('/')
    expect(
      await screen.findByRole('menuitem', { name: 'latest-skill' })
    ).toBeVisible()
    expect(listSkillPacks).toHaveBeenCalledTimes(2)
  })

  it.for(['removed', 'reordered'])(
    'keeps keyboard selection usable when the highlighted cached skill is %s by refresh',
    async (change) => {
      let resolve: (packs: SkillPack[]) => void = () => {}
      const pending = new Promise<SkillPack[]>((settle) => {
        resolve = settle
      })
      vi.mocked(listSkillPacks).mockReturnValueOnce(pending)
      mount()
      await type('/')
      await userEvent.keyboard('{ArrowDown}{ArrowDown}')
      const created = pack('created-by-agent', 'New skill')
      resolve(
        change === 'removed'
          ? [created]
          : [
              created,
              pack('landscape', 'Landscape'),
              pack('portrait', 'Portrait')
            ]
      )
      await screen.findByRole('menuitem', { name: 'created-by-agent' })
      await userEvent.keyboard('{Enter}')
      expect(screen.getByTestId('skill-reference')).toHaveTextContent(
        change === 'removed' ? '/created-by-agent' : '/portrait'
      )
    }
  )
  it('keeps an @ workflow search containing a slash open', async () => {
    mount({ availableWorkflows: [{ id: 'workflow', name: 'Input/Output' }] })
    await type('@')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    await userEvent.keyboard('Input/Output')
    expect(screen.getByRole('menuitem', { name: 'Input/Output' })).toBeVisible()
  })

  it('keeps an open @ search when its query contains a spaced slash', async () => {
    const { composer } = mount()
    composer.addAttachment({
      id: 'asset',
      name: 'Flux / SDXL.png',
      ref: 'Flux / SDXL.png'
    })
    await type('@Flux /')
    const menu = screen.getByRole('menu', { name: 'Add to prompt' })
    expect(
      within(menu).getByRole('menuitem', { name: 'Flux / SDXL.png' })
    ).toBeVisible()
    await userEvent.keyboard(' SDXL')
    expect(
      within(screen.getByRole('menu', { name: 'Add to prompt' })).getByRole(
        'menuitem',
        { name: 'Flux / SDXL.png' }
      )
    ).toBeVisible()
    expect(screen.queryByRole('menu', { name: 'Skills' })).toBeNull()
  })

  it('keeps the @ Workflows section while its query contains a spaced slash', async () => {
    mount({ availableWorkflows: [{ id: 'workflow', name: 'Flux / SDXL' }] })
    await type('@')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    await userEvent.keyboard('Flux / SDXL')
    const menu = screen.getByRole('menu', { name: 'Add to prompt' })
    expect(within(menu).getByRole('menuitem', { name: 'Back' })).toBeVisible()
    expect(
      within(menu).getByRole('menuitem', { name: 'Flux / SDXL' })
    ).toBeVisible()
  })

  it('refreshes for a remounted skill draft but not for a fresh pick', async () => {
    const first = mount()
    await type('/por')
    await waitFor(() => expect(first.skills.loading).toBe(false))
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
    await waitFor(() => expect(first.skills.loading).toBe(false))
    expect(listSkillPacks).toHaveBeenCalledOnce()

    first.unmount()
    const second = mount()
    await waitFor(() => expect(listSkillPacks).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(second.skills.loading).toBe(false))
    expect(second.skills.catalogConfirmed).toBe(true)
  })

  it('inserts a skill immediately before existing workflow and asset references', async () => {
    const { composer, emitted } = mount()
    const attachment = { id: 'asset', name: 'image.png', ref: 'image.png' }
    composer.addAttachment(attachment)
    composer.restorePrompt({
      text: '',
      references: [
        { kind: 'workflow', id: 'workflow', name: 'Reference', textOffset: 0 },
        { kind: 'asset', attachment, textOffset: 0 }
      ]
    })
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Control>}a{/Control}{ArrowLeft}/por{Enter}')
    expect(composer.prompt.references.map((item) => item.kind)).toEqual([
      'skill',
      'workflow',
      'asset'
    ])
    expect(screen.getByTestId('asset-reference-chip')).toBeVisible()
    expect(screen.getByTestId('workflow-reference-chip')).toBeVisible()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    const marker =
      '[Use the saved skill /portrait](skill://portrait?description=Compose%20a%20portrait%0AKeep%20the%20subject%20recognizable)'
    expect(emitted().send).toEqual([
      [
        `${marker} @[Image: image.png]`,
        [attachment],
        [{ id: 'workflow', name: 'Reference', textOffset: marker.length + 1 }]
      ]
    ])
  })
  it('uses the approved placeholder', () => {
    mount()
    expect(
      screen.getByText(
        'Describe ideas, / use skills, @ add references, drag in assets'
      )
    ).toBeVisible()
  })

  it('leaves the slash hint out of the placeholder and textbox name when skills are disabled', async () => {
    const { skills } = mount()
    const withSkills =
      'Describe ideas, / use skills, @ add references, drag in assets'
    const withoutSkills = 'Describe ideas, @ add references, drag in assets'
    expect(screen.getByRole('textbox', { name: withSkills })).toBeVisible()

    skills.flagsEnabled = false
    await nextTick()
    expect(screen.getByText(withoutSkills)).toBeVisible()
    expect(screen.queryByText(withSkills)).toBeNull()
    expect(screen.getByRole('textbox', { name: withoutSkills })).toBeVisible()
  })

  it('opens a skills-only menu and filters names case-insensitively', async () => {
    mount()
    await type('/')
    const menu = screen.getByRole('menu', { name: 'Skills' })
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(2)
    expect(within(menu).queryByText('Nodes')).toBeNull()
    await userEvent.keyboard('POR')
    expect(within(menu).getAllByRole('menuitem')).toHaveLength(1)
    expect(
      within(menu).getByRole('menuitem', { name: 'portrait' })
    ).toBeVisible()
  })

  it('hints to type after a bare slash without adding the hint to the draft', async () => {
    const { composer } = mount()
    await type('/')
    expect(screen.getByText('type to search')).toBeVisible()
    expect(composer.draft).toBe('/')
    await userEvent.keyboard('p')
    expect(screen.queryByText('type to search')).toBeNull()
    await userEvent.keyboard('{Backspace}')
    expect(screen.getByText('type to search')).toBeVisible()
    await userEvent.keyboard('{Backspace}@')
    expect(screen.queryByText('type to search')).toBeNull()
  })

  it('keeps the slash hint out of the accessibility tree and removes it on Escape', async () => {
    mount()
    await type('/')
    expect(screen.getByText('type to search')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('type to search')).toBeNull()
  })

  it('highlights nothing after a bare slash, even after a refresh, so Enter and Tab pick nothing', async () => {
    const view = mount()
    await type('/')
    await waitFor(() => expect(view.skills.loading).toBe(false))
    const menu = screen.getByRole('menu', { name: 'Skills' })
    for (const row of within(menu).getAllByRole('menuitem'))
      expect(row).toHaveAttribute('data-active', 'false')
    expect(screen.getByRole('textbox')).not.toHaveAttribute(
      'aria-activedescendant'
    )
    await userEvent.keyboard('{Enter}{Tab}')
    expect(view.emitted().send).toBeUndefined()
    expect(view.composer.prompt.references).toEqual([])
    expect(view.composer.draft).toBe('/')
    expect(menu).toBeVisible()
  })

  it('picks with arrows and Tab without sending, and preserves the semantic reference on remount', async () => {
    const view = mount()
    await type('/')
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{Tab}')
    expect(view.emitted().send).toBeUndefined()
    expect(view.composer.prompt.references).toEqual([
      expect.objectContaining({
        kind: 'skill',
        name: 'portrait',
        textOffset: 0
      })
    ])
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
    expect(screen.queryByRole('menu')).toBeNull()
    view.unmount()
    mount()
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
  })

  it('replaces the previous skill in one undo step while preserving other references', async () => {
    const { composer } = mount()
    composer.addAttachment({ id: 'asset', name: 'image.png', ref: 'image.png' })
    composer.referenceAttachment('asset')
    await type('/land')
    await userEvent.keyboard('{Enter}')
    await userEvent.keyboard('/por{Enter}')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
    expect(
      composer.prompt.references.filter((item) => item.kind === 'skill')
    ).toHaveLength(1)
    expect(composer.attachments).toHaveLength(1)
    expect(screen.getByTestId('asset-reference-chip')).toBeVisible()
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent(
      '/landscape'
    )
    expect(screen.getByTestId('asset-reference-chip')).toBeVisible()
  })

  it('removes a skill with Backspace and restores it with undo', async () => {
    const { composer } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}{Backspace}{Backspace}')
    expect(screen.queryByTestId('skill-reference')).toBeNull()
    expect(composer.prompt.references).toEqual([])
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
  })

  it('shows only the description when hovering an underlined inline reference', async () => {
    mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    const reference = screen.getByTestId('skill-reference')
    expect(reference).toHaveClass(
      'underline',
      'cursor-pointer',
      'text-warning-background'
    )
    expect(reference).not.toHaveAttribute('aria-description')
    await userEvent.hover(reference)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Compose a portrait\s+Keep the subject recognizable$/
    )
  })

  it('closes the picker before stopping a run and ignores IME Enter', async () => {
    const { emitted, composer } = mount({ streaming: true })
    await type('/')
    screen.getByRole('textbox').dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Enter',
        isComposing: true,
        bubbles: true
      })
    )
    expect(composer.prompt.references).toEqual([])
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('menu')).toBeNull()
    expect(emitted().stop).toBeUndefined()
    await userEvent.keyboard('{Escape}')
    expect(emitted().stop).toEqual([['escape']])
  })

  it('inserts a newline with Shift+Enter without selecting or sending', async () => {
    const { composer, emitted } = mount()
    await type('/por')
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}next')
    expect(composer.draft).toBe('/por\nnext')
    expect(composer.prompt.references).toEqual([])
    expect(screen.queryByRole('menu')).toBeNull()
    expect(emitted().send).toBeUndefined()
  })

  it('deletes forward and restores a skill through undo and redo', async () => {
    const { composer } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}{Control>}a{/Control}{ArrowLeft}{Delete}')
    expect(screen.queryByTestId('skill-reference')).toBeNull()
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(screen.queryByTestId('skill-reference')).toBeNull()
    expect(composer.prompt.references).toEqual([])
  })

  it('pastes a complete leading skill and preserves suffix and atomic history', async () => {
    const { composer } = mount()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('/portrait  keep colors\nplease')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
    expect(composer.prompt.text).toBe('  keep colors\nplease')
    expect(
      composer.prompt.references.find((reference) => reference.kind === 'skill')
        ?.description
    ).toBe('Compose a portrait\nKeep the subject recognizable')
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(composer.prompt.references).toEqual([])
    expect(composer.prompt.text).toBe('')
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
  })

  it.for([
    '/portrait/path text',
    'https://example.com/portrait',
    '```\n/portrait\n```'
  ])('keeps non-command paste literal: %s', async (text) => {
    const { composer } = mount()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(text)
    expect(composer.prompt.references).toEqual([])
    expect(composer.prompt.text).toBe(text)
  })

  it('preserves an existing selected skill when pasting another', async () => {
    const { composer } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    await userEvent.paste('/landscape hello')
    expect(
      composer.prompt.references.find((reference) => reference.kind === 'skill')
        ?.name
    ).toBe('portrait')
    expect(composer.prompt.text).toContain('/landscape hello')
  })

  it('restores copied display metadata in the receiving scope', async () => {
    const { composer, skills } = mount()
    const user = userEvent.setup()
    await user.click(screen.getByRole('textbox'))
    await user.paste('/portrait old description')
    await user.keyboard('{Control>}a{/Control}')
    const clipboard = await user.copy()
    await user.keyboard('{Backspace}')
    skills.packs = []
    await user.paste(clipboard)
    const reference = composer.prompt.references.find(
      (item) => item.kind === 'skill'
    )
    expect(reference).toMatchObject({
      name: 'portrait',
      description: 'Compose a portrait\nKeep the subject recognizable',
      scope: skills.scope
    })
    expect(composer.prompt.text).toBe(' old description')
  })

  it.for([
    'portrait.v2',
    '_portrait',
    '-portrait',
    '.portrait',
    'a'.repeat(64)
  ])('recognizes the catalog name grammar on plain paste: %s', async (name) => {
    const { composer } = mount()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(`/${name}\t next`)
    expect(composer.prompt.references).toEqual([
      expect.objectContaining({ kind: 'skill', name, textOffset: 0 })
    ])
    expect(composer.prompt.text).toBe('\t next')
  })

  it.for(['a'.repeat(65), '.', '..', 'portrait/path'])(
    'leaves an invalid complete pasted name literal: %s',
    async (name) => {
      const { composer } = mount()
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste(`/${name} next`)
      expect(composer.prompt).toEqual({
        text: `/${name} next`,
        references: []
      })
    }
  )

  it('isolates paste history from text typed before and after it', async () => {
    const { composer } = mount()
    await type('Before ')
    await userEvent.paste('/portrait  colors')
    await userEvent.keyboard(' afterward')
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(composer.prompt.text).toBe('Before   colors')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(composer.prompt).toEqual({ text: 'Before ', references: [] })
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(composer.prompt.text).toBe('Before   colors')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
  })

  it.for(['present', 'undone', 'scope-changed'] as const)(
    'resolves cold-cache plain paste metadata safely when the reference is %s',
    async (state) => {
      let resolve: (packs: SkillPack[]) => void = () => {}
      const pending = new Promise<SkillPack[]>((settle) => {
        resolve = settle
      })
      vi.mocked(listSkillPacks).mockReturnValueOnce(pending)
      const { composer, skills } = mount()
      skills.packs = []
      skills.hasLoaded = false
      skills.catalogConfirmed = false
      await type('Before ')
      await userEvent.paste('/portrait  colors')
      expect(composer.prompt.references[0]).toMatchObject({ description: '' })
      expect(screen.getByTestId('skill-reference')).not.toHaveAttribute(
        'aria-description'
      )
      if (state === 'undone') await userEvent.keyboard('{Control>}z{/Control}')
      if (state === 'scope-changed') {
        Object.assign(useTeamWorkspaceStore(), { workspaceId: 'new-workspace' })
        await nextTick()
      }
      resolve([pack('portrait', 'Fresh description')])
      await waitFor(() => expect(skills.loading).toBe(false))
      if (state !== 'present') {
        expect(composer.prompt.references).toEqual([])
        expect(composer.prompt.text).toBe(
          state === 'undone' ? 'Before ' : 'Before   colors'
        )
        if (state === 'scope-changed') {
          await userEvent.keyboard('{Control>}z{/Control}')
          expect(composer.prompt.references).toEqual([])
          return
        }
        await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
      }
      await waitFor(() =>
        expect(composer.prompt.references[0]).toMatchObject({
          name: 'portrait',
          description: 'Fresh description',
          scope: skills.scope
        })
      )
      await userEvent.keyboard('{Control>}z{/Control}')
      expect(composer.prompt).toEqual({ text: 'Before ', references: [] })
      await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
      expect(composer.prompt.references[0]).toMatchObject({
        description: 'Fresh description'
      })
    }
  )

  it('keeps a rich pasted skill hovering its own copied description through remount', async () => {
    const first = mount()
    const copied = userMessageClipboard({
      text: ' colors',
      skillReference: {
        name: 'portrait',
        description: 'Copied description',
        textOffset: 0
      }
    })
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', copied.text)
    clipboard.setData('text/html', copied.html)
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(clipboard)
    await waitFor(() => expect(first.skills.loading).toBe(false))
    first.unmount()
    const second = mount()
    await waitFor(() => expect(second.skills.loading).toBe(false))
    expect(second.composer.prompt.references[0]).toMatchObject({
      name: 'portrait',
      description: 'Copied description'
    })
    await userEvent.hover(screen.getByTestId('skill-reference'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Copied description$/
    )
  })

  it('resolves a cold plain paste description only after full confirmation, including remount', async () => {
    const first = mount()
    let resolve: (packs: SkillPack[]) => void = () => {}
    vi.mocked(listSkillPacks).mockReturnValueOnce(
      new Promise<SkillPack[]>((settle) => {
        resolve = settle
      })
    )
    first.skills.catalogConfirmed = false
    const refresh = first.skills.refreshPacks()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('/portrait colors')
    expect(first.composer.prompt.references[0]).toMatchObject({
      name: 'portrait',
      description: ''
    })
    first.unmount()
    render(Composer, {
      props: { hasWorkflowTarget: true },
      global: { plugins: [i18n] }
    })
    expect(first.composer.prompt.references[0]).toMatchObject({
      description: ''
    })
    resolve([pack('portrait', 'New original')])
    await refresh
    await waitFor(() =>
      expect(first.composer.prompt.references[0]).toMatchObject({
        name: 'portrait',
        description: 'New original'
      })
    )
    first.skills.upsertPack(pack('portrait', 'Replacement'))
    await nextTick()
    expect(first.composer.prompt.references[0]).toMatchObject({
      description: 'New original'
    })
    expect(screen.getByTestId('skill-reference')).not.toHaveAttribute(
      'aria-description'
    )
  })

  it('keeps a rich pasted skill missing from the catalog through remount and sends it with a warning', async () => {
    const first = mount()
    const copied = userMessageClipboard({
      text: ' colors',
      skillReference: {
        name: 'retired',
        description: 'Original snapshot',
        textOffset: 0
      }
    })
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', copied.text)
    clipboard.setData('text/html', copied.html)
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(clipboard)
    await waitFor(() => expect(first.skills.loading).toBe(false))
    expect(first.composer.prompt.references[0]).toMatchObject({
      name: 'retired',
      description: 'Original snapshot'
    })
    await userEvent.keyboard(
      '{Control>}z{/Control}{Control>}{Shift>}z{/Shift}{/Control}'
    )
    await waitFor(() => expect(first.skills.loading).toBe(false))
    first.unmount()
    const second = mount()
    await waitFor(() => expect(second.skills.loading).toBe(false))
    expect(second.composer.prompt.references[0]).toMatchObject({
      name: 'retired',
      description: 'Original snapshot'
    })
    expect(screen.getByTestId('skill-reference')).toHaveAccessibleDescription(
      'Not available'
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect((second.emitted().send[0] as [string])[0]).toBe(
      '[Use the saved skill /retired](skill://retired?description=Original%20snapshot) colors'
    )
  })

  it.for([
    { format: 'plain', checking: undefined, confirmed: 'Catalog description' },
    {
      format: 'rich',
      checking: 'Copied description',
      confirmed: 'Copied description'
    }
  ] as const)(
    'hovers a $format pasted skill with its own description and claims availability only once confirmed',
    async ({ format, checking, confirmed }) => {
      const { skills } = mount()
      skills.catalogConfirmed = false
      let resolve: (packs: SkillPack[]) => void = () => {}
      vi.mocked(listSkillPacks).mockReturnValueOnce(
        new Promise<SkillPack[]>((settle) => {
          resolve = settle
        })
      )
      const clipboard = new DataTransfer()
      const copied = userMessageClipboard({
        text: ' colors',
        skillReference: {
          name: 'portrait',
          description: 'Copied description',
          textOffset: 0
        }
      })
      clipboard.setData('text/plain', copied.text)
      if (format === 'rich') clipboard.setData('text/html', copied.html)
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste(clipboard)
      let skill = screen.getByTestId('skill-reference')
      expect(skill).toHaveClass('text-warning-background')
      expect(skill).not.toHaveAttribute('aria-description')
      await userEvent.hover(skill)
      if (checking)
        expect(await screen.findByRole('tooltip')).toHaveTextContent(checking)
      else {
        await waitFor(() => expect(skill).toHaveAttribute('data-state', 'open'))
        expect(screen.queryByRole('tooltip')).toBeNull()
      }
      await userEvent.unhover(skill)
      resolve([pack('portrait', 'Catalog description')])
      await waitFor(() => expect(skills.catalogConfirmed).toBe(true))
      skill = screen.getByTestId('skill-reference')
      await userEvent.hover(skill)
      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        new RegExp(`^${confirmed}$`)
      )
      expect(skill).toHaveClass('text-warning-background')
      vi.mocked(listSkillPacks).mockResolvedValueOnce([])
      await skills.refreshPacks()
      await waitFor(() => expect(skill).toHaveClass('text-muted-foreground'))
      expect(skill).toHaveAccessibleDescription('Not available')
      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        /^Not available$/
      )
    }
  )

  it.for(['plain', 'rich'] as const)(
    'keeps %s pasted skills as text when the feature is disabled',
    async (format) => {
      const { composer, skills } = mount()
      skills.flagsEnabled = false
      const user = userEvent.setup()
      await user.click(screen.getByRole('textbox'))
      if (format === 'plain') await user.paste('/portrait next')
      else {
        const copied = userMessageClipboard({
          text: ' next',
          skillReference: {
            name: 'portrait',
            description: 'Original',
            textOffset: 0
          }
        })
        const clipboard = new DataTransfer()
        clipboard.setData('text/plain', copied.text)
        clipboard.setData('text/html', copied.html)
        await user.paste(clipboard)
      }
      expect(composer.prompt).toEqual({
        text: '/portrait next',
        references: []
      })
      expect(screen.queryByRole('menu')).toBeNull()
    }
  )

  it('keeps only one skill from rich paste and preserves readable extra skills and workflow order', async () => {
    const { composer, skills } = mount()
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', '/portrait\t/landscape\nReference')
    clipboard.setData(
      'text/html',
      '<span data-comfy-skill="1" data-skill-name="portrait" data-skill-description="Original">/portrait</span>\t<span data-comfy-skill="1" data-skill-name="landscape" data-skill-description="Landscape">/landscape</span>\n<span data-comfy-workflow="1" data-workflow-id="workflow">Reference</span>'
    )
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(clipboard)
    expect(composer.prompt.references).toEqual([
      {
        kind: 'skill',
        name: 'portrait',
        description: 'Original',
        scope: skills.scope,
        textOffset: 0
      },
      { kind: 'workflow', id: 'workflow', name: 'Reference', textOffset: 12 }
    ])
    expect(composer.prompt.text).toBe('\t/landscape\n')
  })

  it.for(['missing', 'failed'] as const)(
    'preserves a plain pasted skill and enabled sending with a %s catalog',
    async (state) => {
      const { composer, skills, emitted } = mount()
      skills.packs = []
      skills.catalogConfirmed = false
      if (state === 'missing')
        vi.mocked(listSkillPacks).mockResolvedValueOnce([])
      else
        vi.mocked(listSkillPacks).mockRejectedValueOnce(
          new SkillPacksApiError('Unavailable', 503)
        )
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste(
        '/artistic-sketch-from-photo can you update the skill so that it also includes colors, and not just B&W'
      )
      await waitFor(() => expect(skills.loading).toBe(false))
      expect(composer.prompt.references[0]).toMatchObject({
        name: 'artistic-sketch-from-photo',
        description: '',
        scope: skills.scope
      })
      expect(composer.prompt.text).toBe(
        ' can you update the skill so that it also includes colors, and not just B&W'
      )
      const selected = screen.getByTestId('skill-reference')
      expect(selected).toHaveClass(
        state === 'missing'
          ? 'text-muted-foreground'
          : 'text-warning-background'
      )
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      expect(emitted().send).toEqual([
        [
          '[Use the saved skill /artistic-sketch-from-photo](skill://artistic-sketch-from-photo?description=) can you update the skill so that it also includes colors, and not just B&W',
          []
        ]
      ])
    }
  )

  it('pastes before existing workflow, node and asset references without changing their ownership or order', async () => {
    const { composer } = mount()
    const attachment = { id: 'asset', name: 'image.png', ref: 'image.png' }
    composer.setNodeScope('target')
    const references = [
      {
        kind: 'workflow' as const,
        id: 'workflow',
        name: 'Reference',
        textOffset: 0
      },
      {
        kind: 'node' as const,
        scope: 'target',
        node: { id: '12', title: 'Sampler' },
        textOffset: 0
      },
      { kind: 'asset' as const, attachment, textOffset: 0 }
    ]
    composer.restorePrompt({ text: ' after', references }, [attachment])
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Control>}a{/Control}{ArrowLeft}')
    await userEvent.paste('/portrait\tcolors ')
    expect(composer.prompt.references.map((item) => item.kind)).toEqual([
      'skill',
      'workflow',
      'node',
      'asset'
    ])
    expect(composer.prompt.text).toBe('\tcolors  after')
    expect(composer.prompt.references.slice(1)).toEqual(
      references.map((item) => ({ ...item, textOffset: 8 }))
    )
    expect(composer.attachments).toEqual([attachment])
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(composer.prompt).toEqual({ text: ' after', references })
    expect(composer.attachments).toEqual([attachment])
  })

  it('shows shared loading and error states and requests a retry', async () => {
    let reject: (reason: unknown) => void = () => {}
    const pending = new Promise<SkillPack[]>((_resolve, fail) => {
      reject = fail
    })
    vi.mocked(listSkillPacks).mockReturnValueOnce(pending)
    const { skills } = mount()
    skills.packs = []
    skills.hasLoaded = false
    await type('/')
    expect(screen.getByRole('status')).toHaveTextContent('Loading skills')
    reject(new SkillPacksApiError('unavailable', 503))
    const retry = await screen.findByRole('button', { name: 'Retry' })
    vi.spyOn(skills, 'ensurePacks').mockImplementation(async () => {
      skills.upsertPack(pack('portrait', 'Compose a portrait'))
    })
    await userEvent.click(retry)
    expect(
      await screen.findByRole('menuitem', { name: 'portrait' })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it.for([
    'https://example.com/portrait',
    '/Users/ryan/file',
    'folder/portrait',
    'word/portrait',
    '/portrait\nnext'
  ])(
    'leaves a path or non-trigger slash as ordinary text: %s',
    async (text) => {
      const { composer } = mount()
      await type(text)
      expect(screen.queryByRole('menu')).toBeNull()
      expect(composer.prompt.references).toEqual([])
      expect(composer.draft).toBe(text)
    }
  )

  it('shows an empty result instead of sending a slash search', async () => {
    const { emitted } = mount()
    await type('/missing')
    expect(screen.getByRole('status')).toHaveTextContent('No skills found')
    await userEvent.keyboard('{Enter}')
    expect(emitted().send).toBeUndefined()
  })

  it('hides the picker when its feature gate is disabled', async () => {
    const { skills } = mount()
    skills.flagsEnabled = false
    await type('/')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('allows sending a selected skill as an explicit named-skill request', async () => {
    const { emitted, composer } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    await userEvent.keyboard('Render it{Enter}')
    expect(emitted().send).toEqual([
      [
        '[Use the saved skill /portrait](skill://portrait?description=Compose%20a%20portrait%0AKeep%20the%20subject%20recognizable) Render it',
        []
      ]
    ])
    expect(composer.draft).toContain('Render it')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent('/portrait')
  })

  it('judges a selected skill by name when it is renamed or recreated, sending its own name and description unchanged', async () => {
    const { skills, composer, emitted } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    const original = structuredClone(composer.prompt)
    const marker =
      '[Use the saved skill /portrait](skill://portrait?description=Compose%20a%20portrait%0AKeep%20the%20subject%20recognizable)'
    vi.mocked(listSkillPacks).mockResolvedValueOnce([
      pack('renamed-portrait', 'Current renamed description')
    ])
    await skills.refreshPacksInBackground()
    const skill = within(screen.getByRole('textbox')).getByTestId(
      'skill-reference'
    )
    expect(skill).toHaveTextContent(/^\/portrait$/)
    expect(skill).toHaveAccessibleDescription('Not available')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send).toEqual([[marker, []]])
    expect(composer.prompt).toEqual(original)
    vi.mocked(listSkillPacks).mockResolvedValueOnce([
      { ...pack('portrait', 'Recreated description'), id: 'recreated' }
    ])
    await skills.refreshPacksInBackground()
    expect(skill).toHaveTextContent(/^\/portrait$/)
    expect(skill).not.toHaveAttribute('aria-description')
    await userEvent.hover(skill)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Compose a portrait\s+Keep the subject recognizable$/
    )
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect((emitted().send[1] as [string])[0]).toBe(marker)
    expect(composer.prompt).toEqual(original)
  })

  it.for(['background', 'foreground', 'scope'] as const)(
    'sends the selected name through %s catalog changes',
    async (state) => {
      const { skills, composer, emitted } = mount()
      await type('/por')
      await userEvent.keyboard('{Enter}')
      const original = structuredClone(composer.prompt)
      const skill = screen.getByTestId('skill-reference')
      expect(skill).toHaveTextContent(/^\/portrait$/)
      if (state === 'scope') {
        Object.assign(useTeamWorkspaceStore(), {
          workspaceId: 'another-workspace'
        })
        await nextTick()
        expect(screen.queryByTestId('skill-reference')).toBeNull()
        expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
        expect(composer.prompt.references).toEqual([])
        expect(emitted().send).toBeUndefined()
        return
      } else {
        let reject: (error: Error) => void = () => {}
        vi.mocked(listSkillPacks).mockReturnValueOnce(
          new Promise<SkillPack[]>((_resolve, fail) => {
            reject = fail
          })
        )
        const pending =
          state === 'background'
            ? skills.refreshPacksInBackground()
            : skills.refreshPacks()
        await nextTick()
        expect(skill).toHaveTextContent(/^\/portrait$/)
        expect(skill).not.toHaveAttribute('aria-description')
        reject(new SkillPacksApiError('Failed', 503))
        await pending
      }
      expect(skill).toHaveTextContent(/^\/portrait$/)
      expect(skill).not.toHaveAttribute('aria-description')
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      expect((emitted().send[0] as [string])[0]).toBe(
        '[Use the saved skill /portrait](skill://portrait?description=Compose%20a%20portrait%0AKeep%20the%20subject%20recognizable)'
      )
      expect(composer.prompt).toEqual(original)
    }
  )

  it('keeps a rich pasted skill’s copied description when the same-name catalog skill differs, through undo and remount', async () => {
    const first = mount()
    const copied = userMessageClipboard({
      text: ' colors',
      skillReference: {
        name: 'portrait',
        description: 'Copied original',
        textOffset: 0
      }
    })
    const clipboard = new DataTransfer()
    clipboard.setData('text/plain', copied.text)
    clipboard.setData('text/html', copied.html)
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(clipboard)
    await waitFor(() => expect(first.skills.loading).toBe(false))
    vi.mocked(listSkillPacks).mockResolvedValue([
      pack('portrait', 'Current catalog description')
    ])
    await first.skills.refreshPacksInBackground()
    const skill = screen.getByTestId('skill-reference')
    expect(skill).toHaveTextContent(/^\/portrait$/)
    expect(skill).not.toHaveAttribute('aria-description')
    await userEvent.hover(skill)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Copied original$/
    )
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard(
      '{Control>}z{/Control}{Control>}{Shift>}z{/Shift}{/Control}'
    )
    await waitFor(() =>
      expect(screen.getByTestId('skill-reference')).toHaveTextContent(
        /^\/portrait$/
      )
    )
    expect(first.composer.prompt.references[0]).toMatchObject({
      name: 'portrait',
      description: 'Copied original'
    })
    first.unmount()
    const second = mount()
    await waitFor(() =>
      expect(screen.getByTestId('skill-reference')).toHaveTextContent(
        /^\/portrait$/
      )
    )
    expect(second.composer.prompt.references[0]).toMatchObject({
      name: 'portrait',
      description: 'Copied original'
    })
  })

  it.for(['deleted', 'unavailable'])(
    'preserves the requested name when the selected catalog entry becomes %s',
    async (state) => {
      const { emitted, skills } = mount()
      await type('/por')
      await userEvent.keyboard('{Enter}')
      if (state === 'deleted') skills.removePack('portrait')
      else skills.markUnavailable()
      await userEvent.click(screen.getByRole('button', { name: 'Send' }))
      expect(emitted().send).toEqual([
        [
          '[Use the saved skill /portrait](skill://portrait?description=Compose%20a%20portrait%0AKeep%20the%20subject%20recognizable)',
          []
        ]
      ])
    }
  )

  it('warns about a deleted selected skill while preserving hover, focus, sending and undo', async () => {
    const { skills, composer, emitted } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    skills.removePack('portrait')
    const skill = screen.getByTestId('skill-reference')
    await waitFor(() => expect(skill).toHaveClass('text-muted-foreground'))
    expect(skill).toHaveClass('underline', 'cursor-pointer')
    expect(skill).not.toHaveClass('text-warning-background')
    expect(skill).toHaveAccessibleDescription('Not available')
    skill.focus()
    expect(skill).toHaveFocus()
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent(/^Not available$/)
    expect(within(tooltip).queryByRole('button')).toBeNull()
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send).toEqual([
      [
        '[Use the saved skill /portrait](skill://portrait?description=Compose%20a%20portrait%0AKeep%20the%20subject%20recognizable)',
        []
      ]
    ])
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Control>}a{/Control}{Backspace}')
    expect(screen.queryByTestId('skill-reference')).toBeNull()
    expect(composer.prompt.references).toEqual([])
    vi.mocked(listSkillPacks).mockResolvedValueOnce([])
    await userEvent.keyboard('{Control>}z{/Control}')
    await waitFor(() =>
      expect(screen.getByTestId('skill-reference')).toHaveClass(
        'text-muted-foreground'
      )
    )
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(screen.queryByTestId('skill-reference')).toBeNull()
  })

  type CatalogState =
    | 'uninitialized'
    | 'loading'
    | 'failed'
    | 'disabled'
    | 'unavailable'

  async function removeSelectedSkillWithCatalog(
    state: CatalogState
  ): Promise<() => Promise<void>> {
    const { skills } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    skills.removePack('portrait')
    await waitFor(() =>
      expect(screen.getByTestId('skill-reference')).toHaveClass(
        'text-muted-foreground'
      )
    )
    let finishRefresh = async () => {}
    if (state === 'uninitialized') {
      skills.markUnavailable()
      skills.routesAvailable = true
    }
    if (state === 'loading') {
      let resolve: (packs: SkillPack[]) => void = () => {}
      vi.mocked(listSkillPacks).mockReturnValueOnce(
        new Promise<SkillPack[]>((settle) => {
          resolve = settle
        })
      )
      const pending = skills.refreshPacks()
      finishRefresh = async () => {
        resolve([])
        await pending
      }
    }
    if (state === 'failed') {
      vi.mocked(listSkillPacks).mockRejectedValueOnce(
        new SkillPacksApiError('unavailable', 503)
      )
      await skills.refreshPacks()
    }
    if (state === 'disabled') skills.flagsEnabled = false
    if (state === 'unavailable') skills.markUnavailable()
    await nextTick()
    return finishRefresh
  }

  it.for(['uninitialized', 'disabled', 'unavailable'] as const)(
    'shows a selected skill normally without an availability claim when the catalog is %s',
    async (state) => {
      const finishRefresh = await removeSelectedSkillWithCatalog(state)
      const skill = screen.getByTestId('skill-reference')
      expect(skill).toHaveClass('text-warning-background')
      expect(skill).not.toHaveAttribute('aria-description')
      await userEvent.hover(skill)
      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        /^Compose a portrait\s+Keep the subject recognizable$/
      )
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
      await finishRefresh()
    }
  )

  it.for(['loading', 'failed'] as const)(
    'keeps a confirmed-unavailable selected skill marked while the catalog is %s',
    async (state) => {
      const finishRefresh = await removeSelectedSkillWithCatalog(state)
      const skill = screen.getByTestId('skill-reference')
      expect(skill).toHaveClass('text-muted-foreground')
      expect(skill).toHaveAccessibleDescription('Not available')
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
      await finishRefresh()
    }
  )

  it.for(['present', 'absent'] as const)(
    'shows a restored reference normally while checking and resolves it after a complete %s catalog',
    async (result) => {
      const { skills, composer } = mount()
      skills.catalogConfirmed = false
      let resolve: (packs: SkillPack[]) => void = () => {}
      vi.mocked(listSkillPacks).mockReturnValueOnce(
        new Promise<SkillPack[]>((settle) => {
          resolve = settle
        })
      )
      composer.replacePrompt({
        text: ' colors',
        workflowReferences: [],
        skillReference: {
          name: 'portrait',
          description: 'Original',
          textOffset: 0
        }
      })
      await waitFor(() => expect(skills.loading).toBe(true))
      const skill = screen.getByTestId('skill-reference')
      expect(skill).toHaveClass('text-warning-background', 'underline')
      expect(skill).not.toHaveAttribute('aria-description')
      expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
      resolve(result === 'present' ? [pack('portrait', 'Current')] : [])
      await waitFor(() => expect(skills.loading).toBe(false))
      expect(skill).toHaveClass(
        result === 'present'
          ? 'text-warning-background'
          : 'text-muted-foreground'
      )
      if (result === 'present')
        expect(skill).not.toHaveAttribute('aria-description')
      else expect(skill).toHaveAccessibleDescription('Not available')
      expect(composer.prompt.references[0]).toMatchObject({
        description: 'Original'
      })
    }
  )

  it('keeps an available selection normal during refresh', async () => {
    const { skills } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    await waitFor(() => expect(skills.loading).toBe(false))
    const skill = screen.getByTestId('skill-reference')
    expect(skill).toHaveClass('text-warning-background')
    let resolve: (packs: SkillPack[]) => void = () => {}
    vi.mocked(listSkillPacks).mockReturnValueOnce(
      new Promise<SkillPack[]>((settle) => {
        resolve = settle
      })
    )
    const refresh = skills.refreshPacks()
    await nextTick()
    expect(skills.catalogConfirmed).toBe(true)
    expect(skill).toHaveClass('text-warning-background')
    expect(skill).not.toHaveAttribute('aria-description')
    resolve([pack('portrait', 'Current')])
    await refresh
    await nextTick()
    expect(skill).toHaveClass('text-warning-background')
    expect(skill).not.toHaveAttribute('aria-description')
  })

  it('restores normal styling when a missing name returns without replacing the selected description', async () => {
    const { skills, composer } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    skills.removePack('portrait')
    await waitFor(() =>
      expect(screen.getByTestId('skill-reference')).toHaveClass(
        'text-muted-foreground'
      )
    )
    skills.upsertPack(pack('portrait', 'New description'))
    await waitFor(() =>
      expect(screen.getByTestId('skill-reference')).toHaveClass(
        'text-warning-background'
      )
    )
    expect(screen.getByTestId('skill-reference')).not.toHaveAttribute(
      'aria-description'
    )
    expect(composer.prompt.references[0]).toMatchObject({
      name: 'portrait',
      description: 'Compose a portrait\nKeep the subject recognizable'
    })
  })

  it('does not infer absence from a partial cache when authoring supersedes the first catalog refresh', async () => {
    const { skills, composer } = mount()
    skills.markUnavailable()
    skills.routesAvailable = true
    let resolve: (packs: SkillPack[]) => void = () => {}
    vi.mocked(listSkillPacks).mockReturnValueOnce(
      new Promise<SkillPack[]>((settle) => {
        resolve = settle
      })
    )
    composer.replacePrompt({
      text: ' render it',
      workflowReferences: [],
      skillReference: {
        name: 'portrait',
        description: 'Original description',
        textOffset: 0
      }
    })
    await waitFor(() => expect(listSkillPacks).toHaveBeenCalledOnce())
    const pending = skills.refreshPacks()
    skills.upsertPack(pack('landscape', 'Created while loading'))
    await nextTick()
    const skill = screen.getByTestId('skill-reference')
    try {
      expect(skill).toHaveClass('text-warning-background')
      expect(skill).not.toHaveAttribute('aria-description')
    } finally {
      resolve([])
      await pending
    }
    expect(skills.catalogConfirmed).toBe(false)
    expect(skill).toHaveClass('text-warning-background')
    expect(skill).not.toHaveAttribute('aria-description')
    expect(screen.getByRole('button', { name: 'Send' })).toBeEnabled()
  })

  it('keeps reloaded history unchanged while refreshing, warning and resending its edited skill', async () => {
    const { skills, composer, emitted } = mount()
    const marker =
      '[Use the saved skill /portrait](skill://portrait?description=Original%20description)'
    const snapshot = parseSkillReferenceText(`${marker} render it`, [
      { id: 'reference', name: 'Reference', textOffset: marker.length }
    ])
    render(UserMessage, {
      props: { ...snapshot, editable: true, onEdit: composer.replacePrompt },
      global: { plugins: [i18n] }
    })
    const historicalSkill = within(
      screen.getByTestId('user-message-bubble')
    ).getByTestId('skill-reference')
    let resolve: (packs: SkillPack[]) => void = () => {}
    vi.mocked(listSkillPacks).mockReturnValueOnce(
      new Promise<SkillPack[]>((settle) => {
        resolve = settle
      })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await waitFor(() => expect(listSkillPacks).toHaveBeenCalledOnce())
    const draftSkill = within(screen.getByRole('textbox')).getByTestId(
      'skill-reference'
    )
    for (const skill of [draftSkill, historicalSkill]) {
      expect(skill).toHaveClass('text-warning-background')
      expect(skill).not.toHaveAttribute('aria-description')
    }
    resolve([])
    await waitFor(() => expect(skills.loading).toBe(false))
    expect(draftSkill).toHaveAccessibleDescription('Not available')
    expect(historicalSkill).toHaveAccessibleDescription('Not available')
    await userEvent.hover(draftSkill)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Not available$/
    )
    expect(skills.packs).toEqual([])
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Control>}a{/Control}{ArrowRight} more')
    expect(listSkillPacks).toHaveBeenCalledOnce()
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send).toEqual([
      [
        `${marker} render it more`,
        [],
        [{ id: 'reference', name: 'Reference', textOffset: marker.length }]
      ]
    ])
  })

  it('judges an edited legacy link by name and resends it without its ID', async () => {
    const { composer, emitted, skills } = mount()
    render(UserMessage, {
      props: {
        ...parseSkillReferenceText(
          '[Use the saved skill /portrait](skill://portrait?description=Original%20description&id=stale-id) render it'
        ),
        editable: true,
        onEdit: composer.replacePrompt
      },
      global: { plugins: [i18n] }
    })
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    const skill = within(screen.getByRole('textbox')).getByTestId(
      'skill-reference'
    )
    await waitFor(() => expect(skills.loading).toBe(false))
    expect(skills.catalogConfirmed).toBe(true)
    expect(skill).toHaveClass('text-warning-background')
    expect(skill).not.toHaveAttribute('aria-description')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send).toEqual([
      [
        '[Use the saved skill /portrait](skill://portrait?description=Original%20description) render it',
        []
      ]
    ])
  })
})
