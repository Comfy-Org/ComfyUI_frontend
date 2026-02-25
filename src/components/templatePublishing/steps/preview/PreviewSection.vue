<!--
  A collapsible section in the preview step, showing a heading with an
  "Edit" button that navigates back to the originating step.
-->
<template>
  <section class="flex flex-col gap-3">
    <div
      class="flex items-center justify-between border-b border-border-default pb-1"
    >
      <h3 class="text-sm font-semibold text-muted">{{ label }}</h3>
      <button
        type="button"
        class="flex items-center gap-1 text-xs text-muted-foreground hover:text-base-foreground"
        @click="emit('edit')"
      >
        <i class="icon-[lucide--pencil] h-3 w-3" />
        {{ t('templatePublishing.steps.preview.editStep') }}
      </button>
    </div>
    <div class="flex flex-col gap-3 pl-1">
      <slot />
    </div>
  </section>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{
  label: string
}>()

const emit = defineEmits<{
  edit: []
}>()

const { t } = useI18n()
</script>
