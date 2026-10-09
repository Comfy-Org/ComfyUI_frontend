import { render, screen, within } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'

import { i18n } from '@/i18n'
import type { PromptSnapshot } from '../../../types/workflowReference'
import UserMessage from './UserMessage.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('@/platform/telemetry/reportError'))

it('renders a sent skill with its own description beside workflows and returns it when editing', async () => {
  const snapshot: PromptSnapshot = {
    text: 'Use  for this',
    workflowReferences: [{ id: 'workflow', name: 'Reference', textOffset: 4 }],
    skillReference: {
      name: 'portrait',
      description: 'Compose a portrait\nPreserve the subject',
      textOffset: 4
    }
  }
  const view = render(UserMessage, {
    props: { ...structuredClone(snapshot), editable: true },
    global: { plugins: [i18n] }
  })
  const bubble = screen.getByTestId('user-message-bubble')
  const skill = within(bubble).getByTestId('skill-reference')
  expect(skill).toHaveTextContent(/^\/portrait$/)
  await userEvent.hover(skill)
  expect(await screen.findByRole('tooltip')).toHaveTextContent(
    /^Compose a portrait\s+Preserve the subject$/
  )
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
  expect(view.emitted().edit).toEqual([[snapshot]])
})
