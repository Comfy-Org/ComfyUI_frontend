<script setup lang="ts">
import { computed } from 'vue'
import { cn } from '@comfyorg/tailwind-utils'
import Button from '@/components/ui/button/Button.vue'
const { label, visible, nodeReferenceDisabledReason } = defineProps<{
  label: string
  visible: boolean
  nodeReferenceDisabledReason?: string
}>()
const emit = defineEmits<{ selectNodes: [event: Event] }>()
const placeholderHint = computed(() => {
  const [text = '', mentionNodes = ''] = label.split('\n')
  return { text, mentionNodes }
})
</script>
<template>
  <div
    :aria-hidden="!visible || undefined"
    :inert="!visible"
    :class="
      cn(
        'pointer-events-none z-10 col-start-1 row-start-1 self-start p-3 font-inter text-[14px]/5 font-normal text-muted-foreground',
        !visible && 'invisible'
      )
    "
  >
    <span>{{ placeholderHint.text }} </span>
    <Button
      v-if="placeholderHint.mentionNodes"
      :tooltip="nodeReferenceDisabledReason ?? ''"
      type="button"
      variant="link"
      size="unset"
      :aria-disabled="!!nodeReferenceDisabledReason || undefined"
      :aria-description="nodeReferenceDisabledReason"
      class="pointer-events-auto h-5 shrink-0 gap-1 px-1 align-top text-sm/5 aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
      @click="emit('selectNodes', $event)"
    >
      <span class="icon-[lucide--mouse-pointer-click] size-3.5 shrink-0" />
      <span class="underline decoration-dashed underline-offset-2">{{
        placeholderHint.mentionNodes
      }}</span>
    </Button>
  </div>
</template>
