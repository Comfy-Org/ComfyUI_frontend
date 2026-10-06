import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/i18n'
import type { PromptSnapshot } from '../../../types/workflowReference'
import { composerPromptForSend } from '../../../utils/composerPrompt'
import { userMessageClipboard } from './userMessageClipboard'
import UserMessage from './UserMessage.vue'

function renderMessage(snapshot: PromptSnapshot) {
  return render(UserMessage, {
    props: { ...snapshot, editable: true },
    global: { plugins: [i18n] }
  })
}

describe('UserMessage skill rendering', () => {
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
    expect(
      await screen.findByRole('tooltip', { name: '/portrait' })
    ).toHaveTextContent('Preserve the subject')
    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    expect(view.emitted().edit).toEqual([[snapshot]])
  })

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

  it('copies a readable skill while retaining rich workflow metadata without private skill identity', () => {
    const clipboard = userMessageClipboard(snapshot)
    expect(clipboard.text).toBe('Use @[Workflow: Reference]/portrait for this')
    expect(clipboard.html).toContain('data-workflow-id="workflow"')
    expect(clipboard.html).toContain('/portrait')
    expect(clipboard.html).not.toContain('Preserve the subject')
    expect(clipboard.html).not.toContain('skill://')
  })
})
