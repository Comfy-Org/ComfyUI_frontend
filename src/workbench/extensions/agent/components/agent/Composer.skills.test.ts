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

const PORTRAIT = 'Compose a portrait\nKeep the subject recognizable'
const PORTRAIT_LINK =
  '[Use the saved skill /portrait](skill://portrait?description=Compose%20a%20portrait%0AKeep%20the%20subject%20recognizable)'

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
    pack('portrait', PORTRAIT)
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

function copiedPortrait(description: string) {
  const copied = userMessageClipboard({
    text: ' next',
    skillReference: { name: 'portrait', description, textOffset: 0 }
  })
  const clipboard = new DataTransfer()
  clipboard.setData('text/plain', copied.text)
  clipboard.setData('text/html', copied.html)
  return clipboard
}

function pendingListing() {
  let resolve: (packs: SkillPack[]) => void = () => {}
  vi.mocked(listSkillPacks).mockReturnValueOnce(
    new Promise<SkillPack[]>((settle) => {
      resolve = settle
    })
  )
  return (packs: SkillPack[]) => resolve(packs)
}

describe('Composer skill selection', () => {
  beforeEach(() => {
    vi.mocked(listSkillPacks).mockResolvedValue([
      pack('landscape', 'Compose a landscape'),
      pack('portrait', PORTRAIT)
    ])
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

  it('refreshes on opening and reopening while retaining cached matches, without fetching on filter edits', async () => {
    const resolve = pendingListing()
    mount()
    await type('/')
    expect(screen.getByRole('menuitem', { name: 'portrait' })).toBeVisible()
    resolve([pack('created-by-agent', 'A newly authored skill')])
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

  it.for([
    {
      change: 'removed',
      refreshed: [pack('created-by-agent', 'New skill')],
      picked: '/created-by-agent'
    },
    {
      change: 'reordered',
      refreshed: [
        pack('created-by-agent', 'New skill'),
        pack('landscape', 'Landscape'),
        pack('portrait', 'Portrait')
      ],
      picked: '/portrait'
    }
  ])(
    'keeps keyboard selection usable when the highlighted cached skill is $change by refresh',
    async ({ refreshed, picked }) => {
      const resolve = pendingListing()
      mount()
      await type('/')
      await userEvent.keyboard('{ArrowDown}{ArrowDown}')
      resolve(refreshed)
      await screen.findByRole('menuitem', { name: 'created-by-agent' })
      await userEvent.keyboard('{Enter}')
      expect(screen.getByTestId('skill-reference')).toHaveTextContent(picked)
    }
  )

  it('highlights nothing for a slash query without matches until arrows reach a skill that appears', async () => {
    const { skills } = mount()
    await type('/zzz')
    await waitFor(() => expect(skills.loading).toBe(false))
    const textbox = screen.getByRole('textbox')
    expect(screen.getByRole('status')).toHaveTextContent('No skills found')
    expect(textbox).not.toHaveAttribute('aria-activedescendant')

    skills.upsertPack(pack('zzz-sketch', 'Sketch it'))
    await screen.findByRole('menuitem', { name: 'zzz-sketch' })
    expect(textbox).not.toHaveAttribute('aria-activedescendant')
    await userEvent.keyboard('{ArrowDown}')
    expect(textbox).toHaveAttribute(
      'aria-activedescendant',
      'agent-reference-item-0'
    )
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('skill-reference')).toHaveTextContent(
      '/zzz-sketch'
    )
  })

  it('highlights nothing once a refresh removes the only highlighted match', async () => {
    const resolve = pendingListing()
    const { composer } = mount()
    await type('/por')
    const textbox = screen.getByRole('textbox')
    expect(textbox).toHaveAttribute(
      'aria-activedescendant',
      'agent-reference-item-0'
    )
    resolve([pack('landscape', 'Compose a landscape')])
    expect(await screen.findByRole('status')).toHaveTextContent(
      'No skills found'
    )
    expect(textbox).not.toHaveAttribute('aria-activedescendant')
    await userEvent.keyboard('{ArrowDown}{Enter}')
    expect(textbox).not.toHaveAttribute('aria-activedescendant')
    expect(composer.prompt.references).toEqual([])
    expect(composer.draft).toBe('/por')
  })

  it('shows loading, then a retryable error, in the skills menu', async () => {
    let reject: (reason: unknown) => void = () => {}
    vi.mocked(listSkillPacks).mockReturnValueOnce(
      new Promise<SkillPack[]>((_resolve, fail) => {
        reject = fail
      })
    )
    const { skills } = mount()
    skills.packs = []
    skills.hasLoaded = false
    await type('/')
    expect(screen.getByRole('status')).toHaveTextContent('Loading skills')
    reject(new SkillPacksApiError('unavailable', 503))
    await userEvent.click(await screen.findByRole('button', { name: 'Retry' }))
    expect(
      await screen.findByRole('menuitem', { name: 'portrait' })
    ).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull()
  })

  it('hints to type after a bare slash, outside the draft and the accessibility tree', async () => {
    const { composer } = mount()
    await type('/')
    expect(screen.getByText('type to search')).toHaveAttribute(
      'aria-hidden',
      'true'
    )
    expect(composer.draft).toBe('/')
    await userEvent.keyboard('p')
    expect(screen.queryByText('type to search')).toBeNull()
    await userEvent.keyboard('{Backspace}')
    expect(screen.getByText('type to search')).toBeVisible()
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByText('type to search')).toBeNull()
  })

  it('highlights nothing after a bare slash, even after a refresh, so Enter and Tab pick nothing', async () => {
    const view = mount()
    await type('/')
    await waitFor(() => expect(view.skills.loading).toBe(false))
    const menu = screen.getByRole('menu', { name: 'Skills' })
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((row) => row.getAttribute('data-active'))
    ).toEqual(['false', 'false'])
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

  it.for([
    { key: 'Backspace', keys: '{Enter}{Backspace}{Backspace}' },
    { key: 'Delete', keys: '{Enter}{Control>}a{/Control}{ArrowLeft}{Delete}' }
  ])(
    'removes a skill with $key and restores it through undo and redo',
    async ({ keys }) => {
      const { composer } = mount()
      await type('/por')
      await userEvent.keyboard(keys)
      expect(screen.queryByTestId('skill-reference')).toBeNull()
      expect(composer.prompt.references).toEqual([])
      await userEvent.keyboard('{Control>}z{/Control}')
      expect(screen.getByTestId('skill-reference')).toHaveTextContent(
        '/portrait'
      )
      await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
      expect(screen.queryByTestId('skill-reference')).toBeNull()
    }
  )

  it('describes an underlined inline reference to assistive technology and shows only the description on hover', async () => {
    mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    const reference = screen.getByTestId('skill-reference')
    expect(reference).toHaveClass(
      'underline',
      'cursor-pointer',
      'text-warning-background'
    )
    expect(reference).toHaveAccessibleDescription(PORTRAIT)
    await userEvent.hover(reference)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Compose a portrait\s+Keep the subject recognizable$/
    )
  })

  it('inserts a skill before existing workflow, node and asset references and keeps their order on send', async () => {
    const { composer, emitted } = mount()
    const attachment = { id: 'asset', name: 'image.png', ref: 'image.png' }
    composer.setNodeScope('target')
    composer.restorePrompt(
      {
        text: '',
        references: [
          {
            kind: 'workflow',
            id: 'workflow',
            name: 'Reference',
            textOffset: 0
          },
          {
            kind: 'node',
            scope: 'target',
            node: { id: '12', title: 'Sampler' },
            textOffset: 0
          },
          { kind: 'asset', attachment, textOffset: 0 }
        ]
      },
      [attachment]
    )
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Control>}a{/Control}{ArrowLeft}/por{Enter}')
    expect(composer.prompt.references.map((item) => item.kind)).toEqual([
      'skill',
      'workflow',
      'node',
      'asset'
    ])
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send).toEqual([
      [
        `${PORTRAIT_LINK} @[Node: Sampler #12]@[Image: image.png]`,
        [attachment],
        [
          {
            id: 'workflow',
            name: 'Reference',
            textOffset: PORTRAIT_LINK.length + 1
          }
        ]
      ]
    ])
  })

  it('marks a selected skill that leaves the catalog as not available, still sends it, and restores it when the name returns', async () => {
    const { skills, composer, emitted } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    skills.removePack('portrait')
    const skill = screen.getByTestId('skill-reference')
    await waitFor(() => expect(skill).toHaveClass('text-muted-foreground'))
    expect(skill).toHaveAccessibleDescription('Not available')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send).toEqual([[PORTRAIT_LINK, []]])

    skills.upsertPack(pack('portrait', 'New description'))
    await waitFor(() => expect(skill).toHaveClass('text-warning-background'))
    expect(skill).toHaveAccessibleDescription(PORTRAIT)
    expect(composer.prompt.references).toMatchObject([
      { name: 'portrait', description: PORTRAIT }
    ])
  })

  it('removes the selected skill and disables sending when the workspace scope changes', async () => {
    const { composer, emitted } = mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    expect(screen.getByTestId('skill-reference')).toBeVisible()
    Object.assign(useTeamWorkspaceStore(), {
      workspaceId: 'another-workspace'
    })
    await nextTick()
    expect(screen.queryByTestId('skill-reference')).toBeNull()
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled()
    expect(composer.prompt.references).toEqual([])
    expect(emitted().send).toBeUndefined()
  })

  it('resends an edited history skill as a canonical link without its legacy ID', async () => {
    const { composer, emitted } = mount()
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
    await waitFor(() => expect(listSkillPacks).toHaveBeenCalledOnce())
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.keyboard('{Control>}a{/Control}{ArrowRight} more')
    await userEvent.click(screen.getByRole('button', { name: 'Send' }))
    expect(emitted().send).toEqual([
      [
        '[Use the saved skill /portrait](skill://portrait?description=Original%20description) render it more',
        []
      ]
    ])
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

  it.for(['https://example.com/portrait', '/Users/ryan/file', 'word/portrait'])(
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

  it('keeps an @ Workflows search containing a spaced slash out of the skills menu', async () => {
    mount({ availableWorkflows: [{ id: 'workflow', name: 'Flux / SDXL' }] })
    await type('@')
    await userEvent.click(screen.getByRole('menuitem', { name: 'Workflows' }))
    await userEvent.keyboard('Flux / SDXL')
    const menu = screen.getByRole('menu', { name: 'Add to prompt' })
    expect(within(menu).getByRole('menuitem', { name: 'Back' })).toBeVisible()
    expect(
      within(menu).getByRole('menuitem', { name: 'Flux / SDXL' })
    ).toBeVisible()
    expect(screen.queryByRole('menu', { name: 'Skills' })).toBeNull()
  })

  it('drops the slash hint and menu when skills are disabled', async () => {
    const { skills } = mount()
    expect(
      screen.getByText(
        'Describe ideas, / use skills, @ add references, drag in assets'
      )
    ).toBeVisible()

    skills.flagsEnabled = false
    await nextTick()
    expect(
      screen.getByText('Describe ideas, @ add references, drag in assets')
    ).toBeVisible()
    expect(
      screen.getByRole('textbox', {
        name: 'Describe ideas, @ add references, drag in assets'
      })
    ).toBeVisible()
    await type('/')
    expect(screen.queryByRole('menu')).toBeNull()
  })

  it('closes an open skills menu when skills become disabled', async () => {
    const { skills } = mount()
    await type('/')
    expect(screen.getByRole('menu', { name: 'Skills' })).toBeVisible()
    skills.flagsEnabled = false
    await nextTick()
    expect(screen.queryByRole('menu', { name: 'Skills' })).toBeNull()
  })

  it.for([
    { format: 'plain', clipboard: () => '/portrait next' },
    { format: 'rich', clipboard: () => copiedPortrait('Original') }
  ])(
    'keeps $format pasted skills as text when skills are disabled',
    async ({ clipboard }) => {
      const { composer, skills } = mount()
      skills.flagsEnabled = false
      await userEvent.click(screen.getByRole('textbox'))
      await userEvent.paste(clipboard())
      expect(composer.prompt).toEqual({
        text: '/portrait next',
        references: []
      })
    }
  )

  it.for([
    {
      when: 'after whitespace',
      typed: 'Before ',
      pasted: '/portrait next',
      text: 'Before  next',
      references: [{ kind: 'skill', name: 'portrait', textOffset: 7 }]
    },
    {
      when: 'right after text',
      typed: 'src',
      pasted: '/portrait next',
      text: 'src/portrait next',
      references: []
    },
    {
      when: 'with a valid name the catalog lacks',
      typed: 'Before ',
      pasted: '/portrait.v2 next',
      text: 'Before  next',
      references: [{ kind: 'skill', name: 'portrait.v2', textOffset: 7 }]
    },
    {
      when: 'with a 64-character name',
      typed: 'Before ',
      pasted: `/${'a'.repeat(64)} next`,
      text: 'Before  next',
      references: [{ kind: 'skill', name: 'a'.repeat(64), textOffset: 7 }]
    },
    {
      when: 'with a 65-character name',
      typed: 'Before ',
      pasted: `/${'a'.repeat(65)} next`,
      text: `Before /${'a'.repeat(65)} next`,
      references: []
    },
    {
      when: 'with a slash inside the name',
      typed: 'Before ',
      pasted: '/portrait/path next',
      text: 'Before /portrait/path next',
      references: []
    }
  ])(
    'pastes a leading /name $when',
    async ({ typed, pasted, text, references }) => {
      const { composer } = mount()
      await type(typed)
      await userEvent.paste(pasted)
      expect(composer.prompt).toMatchObject({ text, references })
    }
  )

  it('takes the catalog description and isolates the paste in one undo step', async () => {
    const { composer } = mount()
    await type('Before ')
    await userEvent.paste('/portrait  colors')
    expect(composer.prompt.references).toMatchObject([
      { name: 'portrait', description: PORTRAIT }
    ])
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

  it('fills a plain pasted description only from a confirmed catalog, through undo and redo', async () => {
    const resolve = pendingListing()
    const { composer, skills } = mount()
    skills.catalogConfirmed = false
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste('/portrait colors')
    expect(composer.prompt).toMatchObject({
      text: ' colors',
      references: [{ name: 'portrait', description: '', textOffset: 0 }]
    })
    resolve([pack('portrait', 'Fresh description')])
    await waitFor(() =>
      expect(composer.prompt.references).toMatchObject([
        { description: 'Fresh description' }
      ])
    )
    await userEvent.keyboard('{Control>}z{/Control}')
    expect(composer.prompt).toEqual({ text: '', references: [] })
    await userEvent.keyboard('{Control>}{Shift>}z{/Shift}{/Control}')
    expect(composer.prompt.references).toMatchObject([
      { description: 'Fresh description' }
    ])
  })

  it('keeps the copied description of a rich in-app paste over the catalog one', async () => {
    const { composer, skills } = mount()
    await userEvent.click(screen.getByRole('textbox'))
    await userEvent.paste(copiedPortrait('Copied description'))
    await waitFor(() => expect(skills.loading).toBe(false))
    expect(composer.prompt).toEqual({
      text: ' next',
      references: [
        {
          kind: 'skill',
          name: 'portrait',
          description: 'Copied description',
          scope: skills.scope,
          textOffset: 0
        }
      ]
    })
    await userEvent.hover(screen.getByTestId('skill-reference'))
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Copied description$/
    )
  })

  it.for([
    {
      source: 'a plain paste after a picked skill',
      typed: '/por{Enter}',
      clipboard: () => '/landscape hello',
      text: ' /landscape hello'
    },
    {
      source: 'a rich paste holding two skills',
      typed: 'Before ',
      clipboard: () => {
        const clipboard = new DataTransfer()
        clipboard.setData('text/plain', '/portrait\t/landscape')
        clipboard.setData(
          'text/html',
          '<span data-comfy-skill="1" data-skill-name="portrait" data-skill-description="Original">/portrait</span>\t<span data-comfy-skill="1" data-skill-name="landscape" data-skill-description="Landscape">/landscape</span>'
        )
        return clipboard
      },
      text: 'Before \t/landscape'
    }
  ])(
    'keeps one skill per message and leaves the extra one as text from $source',
    async ({ typed, clipboard, text }) => {
      const { composer } = mount()
      await type(typed)
      await userEvent.paste(clipboard())
      expect(composer.prompt).toMatchObject({
        text,
        references: [{ kind: 'skill', name: 'portrait' }]
      })
    }
  )
})
