<script setup lang="ts">
import { whenever } from '@vueuse/core'
import { useTemplateRef } from 'vue'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  dataTfWidget: string
}>()

const feedbackRef = useTemplateRef('feedbackRef')

whenever(feedbackRef, () => {
  const scriptEl = document.createElement('script')
  scriptEl.src = '//embed.typeform.com/next/embed.js'
  feedbackRef.value?.appendChild(scriptEl)
})
</script>
<template>
  <Popover>
    <template #button>
      <Button variant="inverted" class="rounded-full size-12">
        <i class="icon-[lucide--circle-question-mark] size-6" />
      </Button>
    </template>
    <div ref="feedbackRef" data-tf-auto-resize :data-tf-widget />
  </Popover>
</template>
