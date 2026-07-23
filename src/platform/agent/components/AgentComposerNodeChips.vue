<script setup lang="ts">
import Attachment from '@/components/ui/attachment/Attachment.vue'
import AttachmentAction from '@/components/ui/attachment/AttachmentAction.vue'
import AttachmentActions from '@/components/ui/attachment/AttachmentActions.vue'
import AttachmentContent from '@/components/ui/attachment/AttachmentContent.vue'
import AttachmentMedia from '@/components/ui/attachment/AttachmentMedia.vue'
import AttachmentTitle from '@/components/ui/attachment/AttachmentTitle.vue'
import Tooltip from '@/components/ui/tooltip/Tooltip.vue'
import TooltipContent from '@/components/ui/tooltip/TooltipContent.vue'
import TooltipTrigger from '@/components/ui/tooltip/TooltipTrigger.vue'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'

const { nodes } = defineProps<{
  nodes: LGraphNode[]
}>()

const emit = defineEmits<{
  remove: [node: LGraphNode]
}>()
</script>

<template>
  <div v-if="nodes.length" class="flex flex-wrap gap-1.5 px-4 pt-3">
    <Attachment v-for="node in nodes" :key="node.id" size="xs">
      <AttachmentMedia>
        <i class="icon-[comfy--node] size-3.5" />
      </AttachmentMedia>
      <AttachmentContent>
        <AttachmentTitle>{{ node.title }}</AttachmentTitle>
      </AttachmentContent>
      <AttachmentActions>
        <Tooltip :delay-duration="500">
          <TooltipTrigger>
            <AttachmentAction
              :aria-label="$t('g.remove')"
              @click="emit('remove', node)"
            >
              <i class="icon-[lucide--x]" />
            </AttachmentAction>
          </TooltipTrigger>
          <TooltipContent side="top">{{ $t('g.remove') }}</TooltipContent>
        </Tooltip>
      </AttachmentActions>
    </Attachment>
  </div>
</template>
