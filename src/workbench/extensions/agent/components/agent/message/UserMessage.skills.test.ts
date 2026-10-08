import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import {
  listSkillPacks,
  SkillPacksApiError
} from '@/platform/skills/api/skillsApi'
import { useSkillPacksStore } from '@/platform/skills/stores/skillPacksStore'
import type { SkillPack } from '@/platform/skills/types'
import { nextTick } from 'vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/skills/api/skillsApi'), { spy: true })
vi.mock(import('@/platform/telemetry/reportError'))

function currentPack(description = 'Current description'): SkillPack {
  return {
    id: 'portrait',
    name: 'portrait',
    description,
    body: '',
    body_hash: '',
    created_at: '',
    updated_at: ''
  }
}
import type { PromptSnapshot } from '../../../types/workflowReference'
import { composerPromptForSend } from '../../../utils/composerPrompt'
import { parseSkillReferenceText } from '../../../utils/skillReferenceText'
import {
  selectedUserMessageClipboard,
  userMessageClipboard
} from './userMessageClipboard'
import UserMessage from './UserMessage.vue'

function renderMessage(snapshot: PromptSnapshot) {
  return render(UserMessage, {
    props: { ...snapshot, editable: true },
    global: { plugins: [i18n] }
  })
}

describe('UserMessage skill rendering', () => {
  beforeEach(async () => {
    const skills = useSkillPacksStore()
    skills.flagsEnabled = true
    vi.mocked(listSkillPacks).mockResolvedValue([currentPack()])
    await skills.refreshPacks()
  })
  const snapshot: PromptSnapshot = {
    text: 'Use  for this',
    workflowReferences: [{ id: 'workflow', name: 'Reference', textOffset: 4 }],
    skillReference: {
      name: 'portrait',
      description: 'Compose a portrait\nPreserve the subject',
      textOffset: 4
    }
  }

  it('renders explicit restored display metadata and returns it when editing', async () => {
    const view = renderMessage(structuredClone(snapshot))
    const bubble = screen.getByTestId('user-message-bubble')
    const skill = within(bubble).getByTestId('skill-reference')
    expect(skill).toHaveTextContent('/portrait')
    expect(skill).toHaveClass('underline', 'cursor-pointer')
    expect(
      within(bubble).getByRole('button', { name: 'Open Reference' })
    ).toBeVisible()
    await userEvent.hover(skill)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Compose a portrait\s+Preserve the subject$/
    )
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(view.emitted().edit).toEqual([[snapshot]])
  })

  it('shows a renamed skill as not available while keeping its original name and description', async () => {
    const view = renderMessage(structuredClone(snapshot))
    const skills = useSkillPacksStore()
    vi.mocked(listSkillPacks).mockResolvedValueOnce([
      {
        ...currentPack('Renamed current description'),
        name: 'renamed-portrait'
      }
    ])
    await skills.refreshPacksInBackground()
    const skill = screen.getByTestId('skill-reference')
    expect(skill).toHaveTextContent(/^\/portrait$/)
    expect(skill).toHaveClass('text-muted-foreground', 'underline')
    expect(skill).toHaveAccessibleDescription('Not available')
    await userEvent.hover(skill)
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      /^Not available$/
    )
    const bubble = screen.getByTestId('user-message-bubble')
    const range = document.createRange()
    range.selectNodeContents(bubble)
    const selection = document.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    const copied = selectedUserMessageClipboard(bubble, selection)
    expect(copied?.text).toContain('/portrait')
    expect(copied?.html).toContain('data-skill-name="portrait"')
    expect(copied?.html).not.toContain('renamed-portrait')
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(view.emitted().edit).toEqual([[snapshot]])
  })

  it('shows a skill deleted then recreated with the same name as available again without changing historical metadata', async () => {
    const view = renderMessage(structuredClone(snapshot))
    const skills = useSkillPacksStore()
    const skill = screen.getByTestId('skill-reference')
    expect(skill).toHaveClass('text-warning-background')
    skills.removePack('portrait')
    await nextTick()
    expect(skill).toHaveClass('text-muted-foreground', 'underline')
    expect(skill).toHaveAccessibleDescription('Not available')
    await userEvent.hover(skill)
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent(/^Not available$/)
    expect(within(tooltip).queryByRole('button')).toBeNull()
    skills.upsertPack({
      ...currentPack('Recreated description'),
      id: 'recreated'
    })
    await nextTick()
    expect(skill).toHaveClass('text-warning-background')
    expect(skill).not.toHaveAttribute('aria-description')
    expect(tooltip).toHaveTextContent(
      /^Compose a portrait\s+Preserve the subject$/
    )
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(view.emitted().edit).toEqual([[snapshot]])
  })

  it('renders a sent link with a legacy ID as a reference judged by name', async () => {
    const view = renderMessage(
      parseSkillReferenceText(
        'Use [Use the saved skill /portrait](skill://portrait?description=Compose%20a%20portrait%0APreserve%20the%20subject&id=stale-id) for this'
      )
    )
    const skills = useSkillPacksStore()
    const skill = screen.getByTestId('skill-reference')
    expect(screen.getByTestId('user-message-bubble')).toHaveTextContent(
      /^Use \/portrait for this$/
    )
    expect(skill).toHaveClass('text-warning-background')
    expect(skill).not.toHaveAttribute('aria-description')
    skills.removePack('portrait')
    await nextTick()
    expect(skill).toHaveAccessibleDescription('Not available')
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(view.emitted().edit).toEqual([
      [
        {
          text: 'Use  for this',
          workflowReferences: [],
          skillReference: {
            name: 'portrait',
            description: 'Compose a portrait\nPreserve the subject',
            textOffset: 4,
            workflowIndex: 0
          }
        }
      ]
    ])
  })

  it.for(['present', 'failed', 'unavailable'] as const)(
    'shows a normal reference without an availability claim while checking, then after a %s catalog',
    async (result) => {
      const skills = useSkillPacksStore()
      let resolve: (packs: SkillPack[]) => void = () => {}
      let reject: (error: Error) => void = () => {}
      vi.mocked(listSkillPacks).mockReturnValueOnce(
        new Promise<SkillPack[]>((yes, no) => {
          resolve = yes
          reject = no
        })
      )
      const refresh = skills.refreshPacks()
      renderMessage(structuredClone(snapshot))
      const skill = screen.getByTestId('skill-reference')
      expect(skill).toHaveClass('text-warning-background')
      expect(skill).not.toHaveAttribute('aria-description')
      await userEvent.hover(skill)
      const tooltip = await screen.findByRole('tooltip')
      expect(tooltip).toHaveTextContent(
        /^Compose a portrait\s+Preserve the subject$/
      )
      if (result === 'present') resolve([currentPack('Fresh description')])
      else
        reject(
          new SkillPacksApiError('Unavailable', result === 'failed' ? 503 : 404)
        )
      await refresh
      await nextTick()
      expect(skill).toHaveClass('text-warning-background')
      expect(skill).not.toHaveAttribute('aria-description')
      expect(tooltip).toHaveTextContent(
        /^Compose a portrait\s+Preserve the subject$/
      )
    }
  )

  it('uses the same positioned snapshot produced by the editor boundary', () => {
    const prepared = composerPromptForSend({
      text: 'Use  for this',
      references: [
        {
          kind: 'skill',
          name: 'portrait',
          description: 'Use defaults',
          textOffset: 4,
          scope: 'user/workspace'
        }
      ]
    })
    renderMessage(prepared)
    expect(screen.getByTestId('user-message-bubble')).toHaveTextContent(
      'Use /portrait for this'
    )
  })

  it('leaves plain slash text unrecognized without explicit metadata', () => {
    renderMessage({ text: 'Use /portrait for this', workflowReferences: [] })
    expect(screen.queryByTestId('skill-reference')).toBeNull()
    expect(screen.getByTestId('user-message-bubble')).toHaveTextContent(
      '/portrait'
    )
  })

  it('copies readable skill display metadata alongside workflows', () => {
    const clipboard = userMessageClipboard(snapshot)
    expect(clipboard.text).toBe('Use @[Workflow: Reference]/portrait for this')
    expect(clipboard.html).toContain('data-workflow-id="workflow"')
    expect(clipboard.html).toContain('/portrait')
    expect(clipboard.html).toContain('data-skill-name="portrait"')
    expect(clipboard.html).toContain(
      'data-skill-description="Compose a portrait\nPreserve the subject"'
    )
    expect(clipboard.html).not.toContain('skill://')
  })

  it.for([0, 1, 2])(
    'preserves adjacent skill/workflow order in selected message copy at workflow index %s',
    (workflowIndex) => {
      renderMessage({
        text: 'Before  after',
        workflowReferences: [
          { id: 'a', name: 'A', textOffset: 7 },
          { id: 'b', name: 'B', textOffset: 7 }
        ],
        skillReference: {
          name: 'portrait',
          description: 'Original description',
          textOffset: 7,
          workflowIndex
        }
      })
      const bubble = screen.getByTestId('user-message-bubble')
      const range = document.createRange()
      range.selectNodeContents(bubble)
      const selection = document.getSelection()
      selection?.removeAllRanges()
      selection?.addRange(range)
      const clipboard = selectedUserMessageClipboard(bubble, selection)
      const tokens = ['@[Workflow: A]', '@[Workflow: B]']
      tokens.splice(workflowIndex, 0, '/portrait')
      expect(clipboard?.text).toBe(`Before ${tokens.join('')} after`)
    }
  )
})
