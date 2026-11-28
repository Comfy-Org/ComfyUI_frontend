import { writeClipboardText } from '@/base/common/clipboard'
import { useToast } from '@/components/ui/toast/toastStore'
import { t } from '@/i18n'
import { openAgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import type { AgentApp } from '@/platform/workflow/deploy/utils/agentApps'
import { createToastId } from '@/types/toastId'

const PROMPT_COPIED_TOAST_ID = createToastId()

/** Opens the app from the click that called it, and leaves the prompt on the clipboard in case the app drops it. */
export function useAgentAppLaunch() {
  const toast = useToast()

  async function launchAgentApp(app: AgentApp, prompt: string): Promise<void> {
    const copying = writeClipboardText(prompt)
    openAgentApp(app, prompt)
    if (await copying)
      toast.info(t('openOnCloud.agentMenu.promptCopiedForSignIn'), {
        id: PROMPT_COPIED_TOAST_ID
      })
  }

  return { launchAgentApp }
}
