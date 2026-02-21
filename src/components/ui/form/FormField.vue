<script setup lang="ts">
import { Field } from 'vee-validate'
import { computed, provide } from 'vue'

import { FORM_FIELD_NAME_INJECTION_KEY } from './injectionKeys'

const props = defineProps<{
  name: string
}>()

provide(
  FORM_FIELD_NAME_INJECTION_KEY,
  computed(() => props.name)
)
</script>

<template>
  <Field v-slot="slotProps" :name="props.name">
    <slot v-bind="slotProps" />
  </Field>
</template>
