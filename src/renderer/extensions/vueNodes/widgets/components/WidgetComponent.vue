<script setup lang="ts">
import { computed } from 'vue'

import { resolveWidgetFromHostNode } from '@/renderer/extensions/vueNodes/widgets/utils/resolvePromotedWidget'
import { isComponentWidget } from '@/scripts/domWidget'
import type { ComponentWidget } from '@/scripts/domWidget'
import { app } from '@/scripts/app'
import type { SimplifiedWidget, WidgetValue } from '@/types/simplifiedWidget'
import { getNodeByLocatorId } from '@/utils/graphTraversalUtil'

const props = defineProps<{
  widget: SimplifiedWidget<WidgetValue>
  nodeId: string
}>()

const modelValue = defineModel<WidgetValue>()

const componentWidget = computed<ComponentWidget<object | string> | undefined>(
  () => {
    const locatorId = props.widget.nodeLocatorId ?? props.nodeId
    const hostNode = app.rootGraph
      ? (getNodeByLocatorId(app.rootGraph, locatorId) ?? undefined)
      : undefined
    const resolved = resolveWidgetFromHostNode(hostNode, props.widget.name)
    if (resolved && isComponentWidget(resolved.widget)) return resolved.widget
    return undefined
  }
)
</script>

<template>
  <component
    :is="componentWidget.component"
    v-if="componentWidget"
    v-model="modelValue"
    :widget="componentWidget"
    v-bind="componentWidget.props"
  />
</template>
