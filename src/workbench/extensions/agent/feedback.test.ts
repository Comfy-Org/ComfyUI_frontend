import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { useCurrentUser } from '@/composables/auth/useCurrentUser'
import type * as useCurrentUserModule from '@/composables/auth/useCurrentUser'
import { openFeedbackDialog as openGeneralFeedbackDialog } from '@/platform/support/feedbackDialog'
import { openTypeformDialog } from '@/platform/surveys/openTypeformDialog'
import type * as telemetryModule from '@/platform/telemetry'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { openFeedbackDialog } from './feedback'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

vi.mock(import('@/platform/surveys/openTypeformDialog'), () => ({
  openTypeformDialog: vi.fn()
}))

vi.mock(import('@/platform/support/feedbackDialog'), () => ({
  openFeedbackDialog: vi.fn()
}))

const trackUiButtonClicked = vi.fn()
vi.mock(import('@/platform/telemetry'), (): typeof telemetryModule =>
  fromPartial({
    useTelemetry: vi.fn(() => fromPartial({ trackUiButtonClicked }))
  })
)

const userEmail = vi.hoisted((): { value: string | undefined } => ({
  value: undefined
}))
vi.mock(
  import('@/composables/auth/useCurrentUser'),
  (): typeof useCurrentUserModule =>
    fromPartial({
      useCurrentUser: (): ReturnType<typeof useCurrentUser> =>
        fromPartial({ userEmail })
    })
)

describe('openFeedbackDialog (agent)', () => {
  beforeEach(() => {
    userEmail.value = undefined
    vi.stubGlobal('__COMFYUI_FRONTEND_VERSION__', '1.55.4')
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel')
  })

  it('falls back to the general feedback dialog when Agent is disabled', () => {
    useAgentPanelStore().enabled = false

    openFeedbackDialog('agent-panel')

    expect(openGeneralFeedbackDialog).toHaveBeenCalledWith('agent-panel')
    expect(openTypeformDialog).not.toHaveBeenCalled()
  })

  it('opens the approved agent form with bounded context when Agent is enabled', () => {
    useAgentPanelStore().enabled = true
    userEmail.value = 'alpha@example.com'
    const conversation = useAgentConversationStore()
    conversation.setThreadId('thread-264')
    conversation.recordUser(toTurnId('turn-private'), 'private prompt', [
      { name: 'private-log.txt' }
    ])

    openFeedbackDialog('agent-panel')

    expect(openTypeformDialog).toHaveBeenCalledWith({
      key: 'global-feedback',
      typeformId: 'MZ6cjWIB',
      title: 'Share Feedback',
      hiddenFields: [
        'email=alpha@example.com',
        'source=agent-panel',
        'version=1.55.4',
        'os=MacIntel',
        'session=thread-264'
      ].join(',')
    })
  })

  it('omits missing optional context rather than sending placeholders', () => {
    useAgentPanelStore().enabled = true
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('')

    openFeedbackDialog('agent-panel')

    expect(openTypeformDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        hiddenFields: 'source=agent-panel,version=1.55.4'
      })
    )
  })

  it('escapes delimiters so an email cannot introduce an extra hidden field', () => {
    useAgentPanelStore().enabled = true
    userEmail.value = 'alpha,graph=private@example.com'

    openFeedbackDialog('agent-panel')

    expect(openTypeformDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        hiddenFields: [
          'email=alpha\\,graph=private@example.com',
          'source=agent-panel',
          'version=1.55.4',
          'os=MacIntel'
        ].join(',')
      })
    )
  })

  it('tracks the button click when Agent is enabled', () => {
    useAgentPanelStore().enabled = true

    openFeedbackDialog('agent-panel')

    expect(trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'feedback_button_clicked',
      element_group: 'agent-panel'
    })
  })
})
