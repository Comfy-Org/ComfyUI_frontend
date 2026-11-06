import { watchEffect } from 'vue'

import { useErrorHandling } from '@/composables/useErrorHandling'
import { useAgentComposerStore } from '@/workbench/extensions/agent/stores/agent/agentComposerStore'
import { useDeploymentAgentStore } from '@/workbench/extensions/agent/stores/agent/deploymentAgentStore'

interface DeploymentSubmissionOptions {
  targetId: () => string | undefined
  visible: () => boolean
  ready: () => boolean
  submit: (text: string) => Promise<void>
}

export function useDeploymentAgentSubmission(
  options: DeploymentSubmissionOptions
) {
  const deployment = useDeploymentAgentStore()
  const composer = useAgentComposerStore()
  const { toastErrorHandler } = useErrorHandling()

  watchEffect(
    () => {
      const request = deployment.pending
      if (!request) return
      if (
        !options.visible() ||
        options.targetId() !== request.targetId ||
        composer.draft !== request.text ||
        composer.attachments.length > 0 ||
        composer.prompt.references.length > 0
      ) {
        deployment.consume(request)
        return
      }
      if (options.ready() && deployment.consume(request))
        void options.submit(request.text).catch(toastErrorHandler)
    },
    { flush: 'post' }
  )
}
