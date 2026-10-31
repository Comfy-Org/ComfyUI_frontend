import { inject } from 'vue'
import type { InjectionKey, Ref } from 'vue'

import { assert } from '@comfyorg/shared-frontend-utils/assert'
import type { LGraphNode } from '@comfyorg/litegraph/litegraph'
import type { components } from '@/types/comfyRegistryTypes'

type NodePack = components['schemas']['Node']

export interface WorkflowErrorManager {
  useMissingNodes(): {
    missingNodePacks: Readonly<Ref<NodePack[]>>
    missingCoreNodes: Readonly<Ref<Record<string, Pick<LGraphNode, 'type'>[]>>>
    isLoading: Readonly<Ref<boolean>>
  }
  useManagerState(): {
    shouldShowManagerButtons: Readonly<Ref<boolean>>
    shouldShowInstallButton: Readonly<Ref<boolean>>
  }
  usePackInstall(getNodePacks: () => NodePack[]): {
    isInstalling: Readonly<Ref<boolean>>
    installAllPacks(): Promise<void>
  }
  useApplyChanges(): {
    isRestarting: Readonly<Ref<boolean>>
    applyChanges(): Promise<void>
  }
  isPackInstalled(packId: string): boolean
  openManager(options: {
    initialTab: 'missing' | 'all'
    initialPackId: string
  }): Promise<void>
}

export const WorkflowErrorManagerKey: InjectionKey<WorkflowErrorManager> =
  Symbol('workflowErrorManager')

export function useWorkflowErrorManager(): WorkflowErrorManager {
  const manager = inject(WorkflowErrorManagerKey)
  assert(manager, 'Workflow error manager not provided')
  return manager
}
