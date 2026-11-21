import { computed } from 'vue'
import { assert, beforeEach, describe, expect, it, vi } from 'vitest'

import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import { FEEDBACK_TYPEFORM_ID } from '@/platform/support/config'
import { openTypeformDialog } from '@/platform/surveys/openTypeformDialog'
import { useTeamWorkspaceStore } from '@/platform/workspace/stores/teamWorkspaceStore'
import { useTelemetry } from '@comfyorg/telemetry'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'

import { openFeedbackDialog } from './feedback'
import { agentClientSessionId } from './agentClientSession'
import { useAgentComposerStore } from './stores/agent/agentComposerStore'
import { useAgentConsentStore } from './stores/agent/agentConsentStore'
import { useAgentConversationStore } from './stores/agent/agentConversationStore'
import { useAgentPanelStore } from './stores/agent/agentPanelStore'

vi.mock(import('@/platform/surveys/openTypeformDialog'), () => ({
  openTypeformDialog: vi.fn()
}))

vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true,
  isNightly: false
}))

vi.mock(import('@comfyorg/telemetry'))

vi.mock(import('@/composables/auth/useCurrentUser'))

function idleState(consent: 'unchecked' | 'signed_out') {
  return [
    `client=${agentClientSessionId()}`,
    `consent=${consent}`,
    'held=none',
    'composer=idle'
  ].join(',')
}

describe('openFeedbackDialog (agent)', () => {
  beforeEach(() => {
    vi.stubGlobal('__COMFYUI_FRONTEND_VERSION__', '1.55.4')
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel')
  })

  it('falls back to the general feedback dialog when Agent is disabled', () => {
    useAgentPanelStore().enabled = false

    openFeedbackDialog('agent-panel')

    expect(openTypeformDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        typeformId: FEEDBACK_TYPEFORM_ID,
        hiddenFields: 'distribution=ccloud,source=agent-panel'
      })
    )
  })

  it('opens the approved agent form with bounded context when Agent is enabled', () => {
    useAgentPanelStore().enabled = true
    useCurrentUser().userEmail = computed(() => 'alpha@example.com')
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'user-264' }))
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
        'distribution=ccloud',
        'source=agent-panel',
        'email=alpha@example.com',
        'userid=user-264',
        'version=1.55.4',
        'os=MacIntel',
        'session=thread-264',
        idleState('unchecked')
      ].join(',')
    })
  })

  it('carries the user id when no thread has started, so the response stays traceable without a session', () => {
    useAgentPanelStore().enabled = true
    useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'user-264' }))

    openFeedbackDialog('agent-panel')

    expect(openTypeformDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        hiddenFields: `distribution=ccloud,source=agent-panel,userid=user-264,version=1.55.4,os=MacIntel,${idleState('unchecked')}`
      })
    )
  })

  it('omits missing optional context rather than sending placeholders', () => {
    useAgentPanelStore().enabled = true
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('')

    openFeedbackDialog('agent-panel')

    expect(openTypeformDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        hiddenFields: `distribution=ccloud,source=agent-panel,version=1.55.4,${idleState('signed_out')}`
      })
    )
  })

  it('escapes delimiters so an email cannot introduce an extra hidden field', () => {
    useAgentPanelStore().enabled = true
    useCurrentUser().userEmail = computed(
      () => 'alpha,graph=private@example.com'
    )

    openFeedbackDialog('agent-panel')

    expect(openTypeformDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        hiddenFields: [
          'distribution=ccloud',
          'source=agent-panel',
          'email=alpha\\,graph=private@example.com',
          'version=1.55.4',
          'os=MacIntel',
          idleState('signed_out')
        ].join(',')
      })
    )
  })

  describe('diagnostics for a report with no thread', () => {
    function sentFields(): string[] {
      const options = vi.mocked(openTypeformDialog).mock.lastCall?.[0]
      assert.exists(options)
      return options.hiddenFields?.split(',') ?? []
    }

    it('names the client, consent state and the gate holding the send', () => {
      const panel = useAgentPanelStore()
      panel.enabled = true
      panel.heldSendGate = 'coach'
      Object.assign(useAgentConsentStore(), { accepted: true })

      openFeedbackDialog('agent-panel')

      expect(sentFields()).toEqual(
        expect.arrayContaining([
          `client=${agentClientSessionId()}`,
          'consent=accepted',
          'held=coach',
          'composer=idle'
        ])
      )
      expect(sentFields().join(',')).not.toContain('session=')
    })

    it('tells a finished consent check from one that never settled', () => {
      useAgentPanelStore().enabled = true
      useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'user-264' }))
      const consent = useAgentConsentStore()

      Object.assign(consent, { isChecking: true })
      openFeedbackDialog('agent-panel')
      expect(sentFields()).toContain('consent=unchecked')

      Object.assign(consent, { isChecking: false })
      openFeedbackDialog('agent-panel')
      expect(sentFields()).toContain('consent=not_accepted')

      Object.assign(consent, { checkFailed: true })
      openFeedbackDialog('agent-panel')
      expect(sentFields()).toContain('consent=check_failed')

      useCurrentUser().resolvedUserInfo = computed(() => null)
      openFeedbackDialog('agent-panel')
      expect(sentFields()).toContain('consent=signed_out')
    })

    it('reports a failed scope probe as a failed check, not as one still running', async () => {
      useAgentPanelStore().enabled = true
      useCurrentUser().resolvedUserInfo = computed(() => ({ id: 'user-264' }))
      const workspace = useTeamWorkspaceStore()
      Object.assign(workspace, { activeWorkspaceId: null })
      workspace.isSwitching = false
      vi.mocked(workspace.initialize).mockRejectedValueOnce(
        new Error('offline')
      )

      await expect(useAgentConsentStore().ensureScope()).rejects.toThrow(
        'offline'
      )
      openFeedbackDialog('agent-panel')

      expect(sentFields()).toContain('consent=check_failed')
    })

    it('reports no hold as an explicit value, not a missing field', () => {
      useAgentPanelStore().enabled = true

      openFeedbackDialog('agent-panel')

      expect(sentFields()).toContain('held=none')
    })

    it('reports a send that is still pending in the composer', () => {
      useAgentPanelStore().enabled = true
      Object.assign(useAgentComposerStore(), {
        submission: { phase: 'pending' }
      })

      openFeedbackDialog('agent-panel')

      expect(sentFields()).toContain('composer=pending')
    })

    it('keeps the thread id once a thread exists', () => {
      useAgentPanelStore().enabled = true
      useAgentConversationStore().setThreadId('thread-264')

      openFeedbackDialog('agent-panel')

      expect(sentFields()).toContain('session=thread-264')
    })

    it('sends none of the diagnostics on the general form', () => {
      useAgentPanelStore().enabled = false

      openFeedbackDialog('agent-panel')

      expect(sentFields().join(',')).not.toMatch(
        /client=|consent=|held=|composer=/
      )
    })
  })

  it('tracks the button click when Agent is enabled', () => {
    useAgentPanelStore().enabled = true

    openFeedbackDialog('agent-panel')

    const telemetry = useTelemetry()
    assert.exists(telemetry)
    expect(telemetry.trackUiButtonClicked).toHaveBeenCalledWith({
      button_id: 'feedback_button_clicked',
      element_group: 'agent-panel'
    })
  })
})
