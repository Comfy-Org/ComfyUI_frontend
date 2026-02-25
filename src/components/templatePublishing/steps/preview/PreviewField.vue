<!--
  A labeled field within a preview section. Shows a label on the left
  and either the value text or a default slot on the right.
-->
<template>
  <div class="flex flex-col gap-0.5">
    <span class="text-xs font-medium text-muted-foreground">{{ label }}</span>
    <div class="text-sm">
      <slot>
        <span v-if="value">{{ value }}</span>
        <span v-else class="text-muted-foreground">
          {{ t('templatePublishing.steps.preview.notProvided') }}
        </span>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  label: string
  value?: string
}>()

const { t } = useI18n()
</script>
