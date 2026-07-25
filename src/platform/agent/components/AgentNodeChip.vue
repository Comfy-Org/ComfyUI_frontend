<script setup lang="ts">
import Attachment from '@/components/ui/attachment/Attachment.vue'
import AttachmentContent from '@/components/ui/attachment/AttachmentContent.vue'
import AttachmentMedia from '@/components/ui/attachment/AttachmentMedia.vue'
import AttachmentTitle from '@/components/ui/attachment/AttachmentTitle.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
import { useFocusNode } from '@/composables/canvas/useFocusNode'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

const { node, showId = false } = defineProps<{
  node: LGraphNode
  showId?: boolean
}>()

const { focusNodeInstance } = useFocusNode()
</script>

<template>
  <Tooltip :delay-duration="500">
    <TooltipTrigger>
      <Attachment
        size="xs"
        role="button"
        tabindex="0"
        class="cursor-pointer hover:bg-tertiary-background-hover"
        :aria-label="$t('agent.nodeSelection.chipFocus')"
        @click="focusNodeInstance(node)"
        @keydown.enter="focusNodeInstance(node)"
        @keydown.space.prevent="focusNodeInstance(node)"
      >
        <AttachmentMedia>
          <i class="icon-[comfy--node] size-3.5" />
        </AttachmentMedia>
        <AttachmentContent class="flex items-center gap-1">
          <AttachmentTitle>{{ node.title }}</AttachmentTitle>
          <span v-if="showId" class="shrink-0 font-mono text-muted-foreground">
            #{{ node.id }}
          </span>
        </AttachmentContent>
        <slot />
      </Attachment>
    </TooltipTrigger>
    <TooltipContent side="top">
      {{ $t('agent.nodeSelection.chipFocus') }}
    </TooltipContent>
  </Tooltip>
</template>
