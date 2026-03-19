<template>
  <div class="flex w-full flex-col pb-2">
    <!-- File header -->
    <div class="flex h-8 w-full items-center gap-2">
      <i
        aria-hidden="true"
        class="text-foreground icon-[lucide--file] size-4 shrink-0"
      />

      <p
        class="text-foreground min-w-0 flex-1 truncate text-sm font-medium"
        :title="item.name"
      >
        {{ item.name }}
        ({{ item.referencingNodes.length }})
      </p>

      <Button
        v-if="item.referencingNodes.length > 0"
        variant="textonly"
        size="icon-sm"
        :aria-label="t('rightSidePanel.missingMedia.locateNode')"
        class="mr-1 size-6 shrink-0 text-muted-foreground hover:text-base-foreground"
        @click="emit('locateNode', String(item.referencingNodes[0].nodeId))"
      >
        <i aria-hidden="true" class="icon-[lucide--locate] size-3" />
      </Button>
    </div>

    <!-- Referencing nodes (when multiple) -->
    <div
      v-if="item.referencingNodes.length > 1"
      class="flex flex-col gap-0.5 overflow-hidden pl-6"
    >
      <div
        v-for="ref in item.referencingNodes"
        :key="`${String(ref.nodeId)}::${ref.widgetName}`"
        class="flex h-7 items-center"
      >
        <span
          v-if="showNodeIdBadge"
          class="mr-1 shrink-0 rounded-md bg-secondary-background-selected px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground"
        >
          #{{ ref.nodeId }}
        </span>
        <p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          {{ getNodeDisplayLabel(ref.nodeId) }}
        </p>
        <Button
          variant="textonly"
          size="icon-sm"
          :aria-label="t('rightSidePanel.missingMedia.locateNode')"
          class="mr-1 size-6 shrink-0 text-muted-foreground hover:text-base-foreground"
          @click="emit('locateNode', String(ref.nodeId))"
        >
          <i aria-hidden="true" class="icon-[lucide--locate] size-3" />
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import type { MissingMediaViewModel } from '@/platform/missingMedia/types'
import type { NodeId } from '@/platform/workflow/validation/schemas/workflowSchema'
import { app } from '@/scripts/app'
import { getNodeByExecutionId } from '@/utils/graphTraversalUtil'
import { resolveNodeDisplayName } from '@/utils/nodeTitleUtil'
import { st } from '@/i18n'

defineProps<{
  item: MissingMediaViewModel
  showNodeIdBadge: boolean
}>()

const emit = defineEmits<{
  locateNode: [nodeId: string]
}>()

const { t } = useI18n()

function getNodeDisplayLabel(nodeId: NodeId): string {
  const graphNode = getNodeByExecutionId(app.rootGraph, String(nodeId))
  return resolveNodeDisplayName(graphNode, {
    emptyLabel: '',
    untitledLabel: '',
    st
  })
}
</script>
