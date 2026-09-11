import { render, screen } from '@testing-library/vue'
import userEvent from '@testing-library/user-event'
import { fromPartial } from '@total-typescript/shoehorn'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'

import GlobalDialog from '@/components/dialog/GlobalDialog.vue'
import { useCurrentUser } from '@/composables/auth/useCurrentUser'
import enMessages from '@/locales/en/main.json'
import { useSettingStore } from '@/platform/settings/settingStore'
import { useDialogStore } from '@/stores/dialogStore'
import { toTurnId } from '@/workbench/extensions/agent/schemas/agentApiSchema'
import { useAgentConversationStore } from '@/workbench/extensions/agent/stores/agent/agentConversationStore'
import { useAgentPanelStore } from '@/workbench/extensions/agent/stores/agent/agentPanelStore'

import WorkflowTabs from './WorkflowTabs.vue'

vi.mock(import('@/composables/auth/useCurrentUser'))
vi.mock(import('firebase/auth'))
vi.mock(import('vuefire'), () => ({ useFirebaseAuth: vi.fn() }))

vi.mock(import('@/i18n'), () => ({ t: (key: string) => key }))
vi.mock(import('@/platform/telemetry'), () => ({ useTelemetry: () => null }))
vi.mock(import('@/platform/distribution/types'), () => ({
  isCloud: true,
  isDesktop: false,
  isNightly: false
}))

const userEmail: { value: string | undefined } = { value: undefined }

function renderFeedback() {
  const global = {
    plugins: [
      createI18n({
        legacy: false,
        locale: 'en',
        messages: { en: enMessages }
      })
    ],
    directives: { tooltip: {} },
    stubs: { CurrentUserButton: true, LoginButton: true }
  }
  render(GlobalDialog, { global })
  render(WorkflowTabs, { global })
  return userEvent.setup()
}

describe('Agent feedback in the existing dialog', () => {
  beforeEach(() => {
    userEmail.value = undefined
    vi.mocked(useCurrentUser).mockReturnValue(
      fromPartial({ userEmail, isLoggedIn: { value: false } })
    )
    useSettingStore().settingValues['Comfy.UI.TabBarLayout'] = 'Default'
    useAgentPanelStore().enabled = true
    vi.stubGlobal('tf', { load: vi.fn() })
    vi.stubGlobal('__COMFYUI_FRONTEND_VERSION__', '1.55.4')
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('MacIntel')
  })

  it('opens the approved form with only bounded context and no preselected intent', async () => {
    userEmail.value = 'alpha@example.com'
    const conversation = useAgentConversationStore()
    conversation.setThreadId('thread-264')
    conversation.latestWorkflowId = 'private-workflow'
    conversation.recordUser(toTurnId('turn-private'), 'private prompt', [
      { name: 'private-log.txt' }
    ])

    const user = renderFeedback()
    await user.click(screen.getByRole('button', { name: 'Feedback' }))

    expect(await screen.findByRole('dialog')).toBeVisible()
    const embed = screen.getByTestId('typeform-embed')
    expect(embed).toHaveAttribute('data-tf-widget', 'MZ6cjWIB')
    expect(embed).toHaveAttribute(
      'data-tf-hidden',
      'email=alpha@example.com,source=topbar,version=1.55.4,os=MacIntel,session=thread-264'
    )
    expect(embed).toHaveAttribute('data-tf-redirect-target', '_self')
    expect(useDialogStore().dialogStack).toHaveLength(1)
  })

  it('omits missing optional context rather than sending placeholders', async () => {
    vi.spyOn(window.navigator, 'platform', 'get').mockReturnValue('')
    const user = renderFeedback()
    await user.click(screen.getByRole('button', { name: 'Feedback' }))

    expect(await screen.findByTestId('typeform-embed')).toHaveAttribute(
      'data-tf-hidden',
      'source=topbar,version=1.55.4'
    )
  })

  it('escapes delimiters so an email cannot introduce an extra hidden field', async () => {
    userEmail.value = 'alpha,graph=private@example.com'
    const user = renderFeedback()
    await user.click(screen.getByRole('button', { name: 'Feedback' }))

    expect(await screen.findByTestId('typeform-embed')).toHaveAttribute(
      'data-tf-hidden',
      'email=alpha\\,graph=private@example.com,source=topbar,version=1.55.4,os=MacIntel'
    )
  })

  it('keeps the general form for users without Agent access', async () => {
    useAgentPanelStore().enabled = false
    useAgentConversationStore().setThreadId('must-not-leak')
    const user = renderFeedback()
    await user.click(screen.getByRole('button', { name: 'Feedback' }))

    const embed = await screen.findByTestId('typeform-embed')
    expect(embed).toHaveAttribute('data-tf-widget', 'q7azbWPi')
    expect(embed).toHaveAttribute(
      'data-tf-hidden',
      'distribution=ccloud,source=topbar'
    )
  })
})
