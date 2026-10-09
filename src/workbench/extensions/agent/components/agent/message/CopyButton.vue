<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import TextTooltip from '@/components/ui/tooltip/TextTooltip.vue'

defineOptions({ inheritAttrs: false })

const { copied } = defineProps<{ copied: boolean }>()

const { t } = useI18n()
const label = computed(() => (copied ? t('agent.copied') : t('agent.copy')))
</script>

<template>
  <TextTooltip :text="label" :label disable-closing-trigger>
    <Button
      type="button"
      variant="muted-textonly"
      :aria-label="label"
      v-bind="$attrs"
    >
      <span
        :class="
          cn('size-3', copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]')
        "
      />
    </Button>
  </TextTooltip>
</template>
