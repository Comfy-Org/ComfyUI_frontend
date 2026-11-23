import { onScopeDispose, watchEffect } from 'vue'

import { useWidgetValueStore } from '@/stores/widgetValueStore'
import { createUuidv4 } from '@/utils/uuid'
import { toNodeId } from '@comfyorg/graph-model/nodeId'
import { widgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetId } from '@comfyorg/graph-model/widgetId'
import type { WidgetStateInit } from '@comfyorg/graph-model/widgetState'
import type { WidgetValue } from '@comfyorg/graph-model/widgetValue'
import type { IWidgetOptions } from '@comfyorg/graph-model/widgets'

/** Registers a story's widget under a graph of its own until the story unmounts. */
export function useStoryWidget<
  TValue extends WidgetValue,
  TOptions extends IWidgetOptions
>(
  init: () => WidgetStateInit<TValue, string, TOptions> & { name: string }
): WidgetId {
  const graphId = createUuidv4()
  const id = widgetId(graphId, toNodeId(1), init().name)
  const store = useWidgetValueStore()
  watchEffect(() => store.registerWidget(id, init()))
  onScopeDispose(() => store.clearGraph(graphId))
  return id
}
