import { LOCAL_DEPLOYMENT_AGENT_COMMAND } from '@/platform/openOnCloud/localDeploymentAgentCommand'
import { closeRunOnCloudDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import type { ComfyExtension } from '@/types/comfy'

export const localDeploymentAgentExtension: ComfyExtension = {
  name: 'Comfy.LocalDeploymentAgent',
  commands: [
    {
      id: LOCAL_DEPLOYMENT_AGENT_COMMAND,
      function: async (metadata) => {
        if (typeof metadata?.brief !== 'string') return
        const { useLocalDeploymentAgent } =
          await import('@/workbench/extensions/agent/composables/agent/useLocalDeploymentAgent')
        if (await useLocalDeploymentAgent().open(metadata.brief))
          closeRunOnCloudDialog()
      }
    }
  ]
}
