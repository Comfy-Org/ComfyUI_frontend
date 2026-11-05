import { closeRunOnCloudDialog } from '@/platform/openOnCloud/openRunOnCloudDialog'
import { useAgentHandoff } from '@/platform/workflow/deploy/composables/useAgentHandoff'
import type { ComfyExtension } from '@/types/comfy'

export const localDeploymentAgentExtension: ComfyExtension = {
  name: 'Comfy.LocalDeploymentAgent',
  commands: [
    {
      id: 'Comfy.Agent.DeployWorkflow',
      function: async (metadata) => {
        const brief =
          typeof metadata?.brief === 'string'
            ? metadata.brief
            : useAgentHandoff().buildBrief()
        const { useLocalDeploymentAgent } =
          await import('@/workbench/extensions/agent/composables/agent/useLocalDeploymentAgent')
        if (await useLocalDeploymentAgent().open(brief)) closeRunOnCloudDialog()
      }
    }
  ]
}
