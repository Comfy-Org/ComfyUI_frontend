<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'

const {
  files,
  selected,
  downloadName = true,
  locale = 'en'
} = defineProps<{
  files: readonly { readonly name: string; readonly href: string }[]
  selected?: string
  downloadName?: string | boolean
  locale?: Locale
}>()
const emit = defineEmits<{ select: [href: string]; download: [] }>()
const { t } = translationsFor(locale)

function onChange(event: Event) {
  if (event.target instanceof HTMLSelectElement)
    emit('select', event.target.value)
}
</script>

<template>
  <div class="flex flex-col gap-3" data-testid="workflow-versions">
    <label class="grid gap-2 text-sm text-primary-warm-gray">
      {{ t('cccWorkflow.version') }}
      <select
        :value="selected"
        class="min-h-11 rounded-xl border border-transparency-white-t20 bg-primary-comfy-ink px-3 text-primary-comfy-canvas"
        @change="onChange"
      >
        <option v-for="file in files" :key="file.href" :value="file.href">
          {{ file.name }}
        </option>
      </select>
    </label>
    <Button
      as="a"
      :href="selected"
      :download="downloadName === true ? '' : downloadName"
      variant="outline"
      class="h-auto min-h-11 max-w-full whitespace-normal"
      @click="emit('download')"
      >{{ t('workshop.workflow.download') }}</Button
    >
  </div>
</template>
