import { describe, expect, it, vi } from 'vitest'

import { useToast } from '@/components/ui/toast/toastStore'
import { useAgentAppLaunch } from '@/platform/workflow/deploy/composables/useAgentAppLaunch'
import { openAgentApp } from '@/platform/workflow/deploy/utils/agentApps'

vi.mock(import('@/platform/workflow/deploy/utils/agentApps'), () => ({
  openAgentApp: vi.fn()
}))

function clipboardThatAnswersLater() {
  let answer!: (granted: boolean) => void
  const decided = new Promise<boolean>((resolve) => {
    answer = resolve
  })
  vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async () => {
    if (!(await decided))
      throw new DOMException('Clipboard permission denied', 'NotAllowedError')
  })
  return answer
}

describe(useAgentAppLaunch, () => {
  it.for([
    {
      granted: true,
      toasts: [
        {
          kind: 'info',
          title:
            'Prompt copied. If the app asks you to sign in first, paste it after you sign in.'
        }
      ]
    },
    { granted: false, toasts: [] }
  ])(
    'opens the app within the click, before the clipboard answers, and says the prompt was copied only when it was (clipboard granted: $granted)',
    async ({ granted, toasts }) => {
      const answerClipboard = clipboardThatAnswersLater()

      const launching = useAgentAppLaunch().launchAgentApp('codex', 'Deploy')

      expect(openAgentApp).toHaveBeenCalledExactlyOnceWith('codex', 'Deploy')
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Deploy')

      answerClipboard(granted)
      await launching

      expect(
        useToast().toasts.map(({ kind, title }) => ({ kind, title }))
      ).toEqual(toasts)
    }
  )

  it('keeps one prompt-copied toast however many times an app is opened', async () => {
    vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    const { launchAgentApp } = useAgentAppLaunch()

    await launchAgentApp('claude', 'Deploy')
    await launchAgentApp('codex', 'Deploy')
    await launchAgentApp('claude', 'Deploy again')

    expect(useToast().toasts.map(({ title }) => title)).toEqual([
      'Prompt copied. If the app asks you to sign in first, paste it after you sign in.'
    ])
  })
})
