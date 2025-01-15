<template>
  <Tag :icon :severity :value />
</template>

<script setup lang="ts">
import { PrimeIcons, type PrimeIconsOptions } from '@primevue/core/api'
import Tag, { TagProps } from 'primevue/tag'
import { ref, watch } from 'vue'

import { t } from '@/i18n'

// Properties
const props = defineProps<{
  error: boolean
  refreshing?: boolean
}>()

// Bindings
const icon = ref<string>(null)
const severity = ref<TagProps['severity']>(null)
const value = ref<PrimeIconsOptions[keyof PrimeIconsOptions]>(null)

const updateBindings = () => {
  if (props.refreshing) {
    icon.value = PrimeIcons.QUESTION
    severity.value = 'info'
    value.value = t('maintenance.refreshing')
  } else if (props.error) {
    icon.value = PrimeIcons.TIMES
    severity.value = 'danger'
    value.value = t('g.error')
  } else {
    icon.value = PrimeIcons.CHECK
    severity.value = 'success'
    value.value = t('maintenance.OK')
  }
}

watch(props, updateBindings, { deep: true })
</script>
