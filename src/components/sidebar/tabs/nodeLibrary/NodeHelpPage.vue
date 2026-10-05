<template>
  <div class="flex h-full flex-col overflow-auto">
    <div class="flex items-center border-b border-interface-stroke px-3 py-2">
      <Button
        :tooltip="$t('g.back')"
        tooltip-side="bottom"
        variant="muted-textonly"
        size="icon"
        :aria-label="$t('g.back')"
        @click="$emit('close')"
      >
        <i class="icon-[lucide--arrow-left] size-4" />
      </Button>
      <span class="ml-2 flex-1 truncate font-semibold">
        {{ node.display_name }}
      </span>
      <SidebarTabCloseButton />
    </div>
    <div class="grow p-4">
      <NodeHelpContent :node />
    </div>
  </div>
</template>

<script setup lang="ts">
import NodeHelpContent from '@/components/node/NodeHelpContent.vue'
import SidebarTabCloseButton from '@/components/sidebar/tabs/SidebarTabCloseButton.vue'
import Button from '@/components/ui/button/Button.vue'
import type { ComfyNodeDefImpl } from '@/stores/nodeDefStore'

const { node } = defineProps<{ node: ComfyNodeDefImpl }>()

defineEmits<{
  (e: 'close'): void
}>()
</script>
