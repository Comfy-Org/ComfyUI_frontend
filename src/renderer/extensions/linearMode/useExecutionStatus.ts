import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { getExecutionStatusMessage } from '@/renderer/extensions/linearMode/getExecutionStatusMessage'
import { app } from '@/scripts/app'
import { useExecutionStore } from '@/stores/executionStore'
import { useNodeDefStore } from '@/stores/nodeDefStore'
import {
  executionIdToNodeLocatorId,
  getNodeByLocatorId
} from '@/utils/graphTraversalUtil'

function resolveStatus(
  t: (key: string) => string,
  nodeDefStore: ReturnType<typeof useNodeDefStore>,
  executionId: string | number
): string | null {
  const locatorId = executionIdToNodeLocatorId(app.rootGraph, executionId)
  if (!locatorId) return null

  const node = getNodeByLocatorId(app.rootGraph, locatorId)
  const nodeType = node?.type
  if (!nodeType) return null

  const nodeDef = nodeDefStore.nodeDefsByName[nodeType] ?? null
  return getExecutionStatusMessage(t, nodeType, nodeDef, node.properties)
}

export function useExecutionStatus() {
  const { t } = useI18n()
  const executionStore = useExecutionStore()
  const nodeDefStore = useNodeDefStore()

  const executionStatusMessage = computed<string | null>(() => {
    const executionId = executionStore.executingNodeId
    if (!executionId) return null
    return resolveStatus(t, nodeDefStore, executionId) || t('execution.running')
  })

  return { executionStatusMessage }
}
