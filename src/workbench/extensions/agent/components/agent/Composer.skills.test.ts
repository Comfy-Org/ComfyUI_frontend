import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ComponentProps } from 'vue-component-type-helpers'

import { i18n } from '@/i18n'
import {
  listSkillPacks,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
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
  await userEvent.paste(text)
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
      await userEvent.keyboard('{ArrowDown}')
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

  it('picks with arrows and Tab without sending, and preserves the semantic reference on remount', async () => {
    const view = mount()
    await type('/')
    await userEvent.keyboard('{ArrowDown}{Tab}')
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

  it('shows description from the info icon without selecting the row', async () => {
    const { composer } = mount()
    await type('/')
    const info = screen.getByRole('button', { name: 'About portrait' })
    await userEvent.hover(info)
    expect(
      await screen.findByRole('tooltip', { name: '/portrait' })
    ).toHaveTextContent('Keep the subject recognizable')
    await userEvent.click(info)
    expect(composer.prompt.references).toEqual([])
    expect(screen.getByRole('menu', { name: 'Skills' })).toBeVisible()
  })

  it('shows the same description when hovering an underlined inline reference', async () => {
    mount()
    await type('/por')
    await userEvent.keyboard('{Enter}')
    const reference = screen.getByTestId('skill-reference')
    expect(reference).toHaveClass('underline', 'cursor-pointer')
    await userEvent.hover(reference)
    expect(
      await screen.findByRole('tooltip', { name: '/portrait' })
    ).toHaveTextContent('Compose a portrait')
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

  it('pastes readable slash text without restoring privileged selection identity', async () => {
    const { composer } = mount()
    await type('/portrait')
    expect(composer.prompt.references).toEqual([])
    expect(screen.queryByTestId('skill-reference')).toBeNull()
    await userEvent.keyboard('{Escape}')
    expect(composer.draft).toBe('/portrait')
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
})
