<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { ref, watchEffect } from 'vue'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import TypeformEmbed from '@/platform/surveys/TypeformEmbed.vue'
import { getSurveyIdentityTags } from '@/platform/surveys/surveyIdentity'

const { dataTfWidget, active = true } = defineProps<{
  dataTfWidget: string
  active?: boolean
}>()

const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')

// Mobile opens the form externally, so identity rides in the URL fragment.
const formUrl = ref<string>()

watchEffect((onCleanup) => {
  const widgetId = dataTfWidget
  let cancelled = false
  onCleanup(() => {
    cancelled = true
  })
  void getSurveyIdentityTags().then((tags) => {
    if (cancelled) return
    const params = new URLSearchParams(tags)
    formUrl.value = `https://form.typeform.com/to/${widgetId}#${params.toString()}`
  })
})
</script>
<template>
  <Button
    v-if="isMobile"
    as="a"
    :href="formUrl"
    target="_blank"
    variant="inverted"
    class="flex h-10 items-center justify-center gap-2.5 px-3 py-2"
    v-bind="$attrs"
  >
    <i class="icon-[lucide--circle-help] size-4" />
  </Button>
  <Popover v-else>
    <template #button>
      <Button
        variant="inverted"
        class="flex h-10 items-center justify-center gap-2.5 px-3 py-2"
        v-bind="$attrs"
      >
        <i class="icon-[lucide--circle-help] size-4" />
      </Button>
    </template>
    <TypeformEmbed v-if="active" :typeform-id="dataTfWidget" auto-resize />
  </Popover>
</template>
