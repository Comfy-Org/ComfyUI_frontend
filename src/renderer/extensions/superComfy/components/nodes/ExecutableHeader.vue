<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import { cn } from '@comfyorg/tailwind-utils'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { drillIntoApp } from '@/renderer/extensions/superComfy/drill/appDrillIn'
import type { ExecutableNode } from '@/renderer/extensions/superComfy/engine/documentSchema'
import type { RunPlan } from '@/renderer/extensions/superComfy/engine/types'
import { useSuperComfyGraphStore } from '@/renderer/extensions/superComfy/stores/superComfyGraphStore'

import ModelPicker from './ModelPicker.vue'
import NodeMenu from './NodeMenu.vue'
import RunButton from './RunButton.vue'
import type { StatusLine } from './nodeView'
import { useStatusText } from './useStatusText'

const { node, status, plan, running, disabled, emphasized } = defineProps<{
  node: ExecutableNode
  status: StatusLine | null
  plan: RunPlan
  running: boolean
  disabled: boolean
  emphasized: boolean
}>()

const emit = defineEmits<{ run: []; stop: [] }>()

const { t } = useI18n()
const store = useSuperComfyGraphStore()
const statusText = useStatusText()

function openApp() {
  if (node.kind === 'app') void drillIntoApp(node.workflowPath, node.id)
}

const menuItems = computed<MenuItem[]>(() => [
  ...(node.kind === 'app'
    ? [
        {
          label: t('superComfy.app.open'),
          icon: 'icon-[lucide--square-arrow-out-up-right]',
          command: openApp
        },
        {
          label: t('superComfy.app.reload'),
          icon: 'icon-[lucide--refresh-cw]',
          command: () => void store.refreshApp(node.id)
        }
      ]
    : []),
  {
    label: t('superComfy.node.delete'),
    icon: 'icon-[lucide--trash-2]',
    command: () => store.removeNodes([node.id])
  }
])
</script>

<template>
  <div class="flex min-w-0 items-center gap-1">
    <ModelPicker v-if="node.kind === 'generate'" :node />
    <div
      v-else
      class="flex min-w-0 items-center gap-1"
      @dblclick.stop="openApp"
    >
      <span class="truncate font-medium text-foreground">{{ node.title }}</span>
      <Button
        variant="muted-textonly"
        size="icon-sm"
        :aria-label="t('superComfy.app.open')"
        @click="openApp"
      >
        <i class="icon-[lucide--square-arrow-out-up-right] size-3" />
      </Button>
    </div>
  </div>
  <span
    :class="
      cn(
        'min-w-0 flex-1 truncate',
        status?.tone === 'destructive'
          ? 'text-destructive'
          : 'text-muted-foreground'
      )
    "
  >
    {{ statusText(status) }}
  </span>
  <div
    :class="
      cn(
        'flex shrink-0 items-center gap-1 transition-opacity',
        emphasized ? 'opacity-100' : 'opacity-0 group-hover/node:opacity-100'
      )
    "
  >
    <RunButton
      :plan
      :running
      :disabled
      @run="emit('run')"
      @stop="emit('stop')"
    />
    <NodeMenu :items="menuItems" />
  </div>
</template>
