<script setup lang="ts">
import type { HTMLAttributes } from 'vue'
import { useI18n } from 'vue-i18n'

import Spinner from '@/components/ui/spinner/Spinner.vue'

import DotSpinner from './DotSpinner.vue'

defineOptions({ inheritAttrs: false })

const {
  label = false,
  variant = 'ring',
  class: customClass = ''
} = defineProps<{
  label?: boolean
  variant?: 'ring' | 'dots'
  class?: HTMLAttributes['class']
}>()

const { t } = useI18n()
</script>

<template>
  <span v-if="label" class="inline-flex items-center gap-2">
    <component
      :is="variant === 'ring' ? Spinner : DotSpinner"
      v-bind="$attrs"
      role="progressbar"
      :aria-label="t('g.loading')"
      :class="customClass"
    />
    <span aria-hidden="true">{{ t('g.loading') }}</span>
  </span>
  <component
    :is="variant === 'ring' ? Spinner : DotSpinner"
    v-else
    v-bind="$attrs"
    role="progressbar"
    :aria-label="t('g.loading')"
    :class="customClass"
  />
</template>
