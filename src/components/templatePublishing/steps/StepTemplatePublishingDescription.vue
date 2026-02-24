<template>
  <div class="flex h-full flex-row gap-4 p-6">
    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <label for="tpl-description-editor" class="text-sm text-muted-foreground">
        {{ t('templatePublishing.steps.description.editorLabel') }}
      </label>
      <textarea
        id="tpl-description-editor"
        v-model="ctx.template.value.description"
        class="min-h-0 flex-1 resize-none rounded-lg border border-border-default bg-secondary-background p-3 font-mono text-sm text-base-foreground focus:outline-none"
      />
    </div>

    <div class="flex min-w-0 flex-1 flex-col gap-1">
      <span class="text-sm text-muted-foreground">
        {{ t('templatePublishing.steps.description.previewLabel') }}
      </span>
      <div
        class="prose prose-invert min-h-0 flex-1 overflow-y-auto rounded-lg border border-border-default bg-secondary-background p-3 text-sm scrollbar-custom"
        v-html="renderedHtml"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import { renderMarkdownToHtml } from '@/utils/markdownRendererUtil'

import { PublishingStepperKey } from '../types'

const { t } = useI18n()
const ctx = inject(PublishingStepperKey)!

const renderedHtml = computed(() =>
  renderMarkdownToHtml(ctx.template.value.description ?? '')
)

watchDebounced(
  () => ctx.template.value,
  () => ctx.saveDraft(),
  { deep: true, debounce: 500 }
)
</script>
