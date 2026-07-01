<script setup lang="ts">
import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'

import Popover from '@/components/ui/Popover.vue'
import Button from '@/components/ui/button/Button.vue'
import TypeformEmbed from '@/platform/surveys/TypeformEmbed.vue'

const { active = true } = defineProps<{
  dataTfWidget: string
  active?: boolean
}>()

const isMobile = useBreakpoints(breakpointsTailwind).smaller('md')
</script>
<template>
  <Button
    v-if="isMobile"
    as="a"
    :href="`https://form.typeform.com/to/${dataTfWidget}`"
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
