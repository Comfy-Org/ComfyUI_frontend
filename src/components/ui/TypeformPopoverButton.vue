<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints, whenever } from '@vueuse/core'
import { useTemplateRef } from 'vue'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'

defineProps<{
  dataTfWidget: string
}>()

const feedbackRef = useTemplateRef('feedbackRef')
const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')

whenever(feedbackRef, () => {
  const scriptEl = document.createElement('script')
  scriptEl.src = '//embed.typeform.com/next/embed.js'
  feedbackRef.value?.appendChild(scriptEl)
})
</script>
<template>
  <Button
    v-if="isMobile"
    as="a"
    :href="`https://form.typeform.com/to/${dataTfWidget}`"
    target="_blank"
    variant="inverted"
    class="rounded-full size-12"
    v-bind="$attrs"
  >
    <i class="icon-[lucide--circle-question-mark] size-6" />
  </Button>
  <Popover v-else>
    <template #button>
      <Button variant="inverted" class="rounded-full size-12" v-bind="$attrs">
        <i class="icon-[lucide--circle-question-mark] size-6" />
      </Button>
    </template>
    <div ref="feedbackRef" data-tf-auto-resize :data-tf-widget />
  </Popover>
</template>
