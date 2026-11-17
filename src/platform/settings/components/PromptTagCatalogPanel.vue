<template>
  <section class="flex flex-col gap-4">
    <h3 class="m-0 text-base">{{ $t('settingsCategories.PromptTags') }}</h3>
    <p class="m-0 text-sm text-muted-foreground">
      {{ $t('textEditor.importTagsHint') }}
    </p>
    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="secondary"
        icon="icon-[lucide--upload]"
        :loading="importState === 'loading'"
        @click="catalogInput?.click()"
      >
        {{ $t('textEditor.importTags') }}
      </Button>
      <input
        ref="catalogInput"
        type="file"
        accept=".csv,.txt,text/csv,text/plain"
        class="hidden"
        :aria-label="$t('textEditor.importTags')"
        @change="importTags"
      />
      <span role="status" class="text-sm text-muted-foreground">
        {{ $t('textEditor.tagsLoaded', catalog.tags.length) }}
      </span>
    </div>
    <p
      v-if="importState === 'error'"
      role="alert"
      class="m-0 text-sm text-destructive"
    >
      {{ $t('textEditor.importTagsError') }}
    </p>
  </section>
</template>

<script setup lang="ts">
import { onScopeDispose, ref, useTemplateRef } from 'vue'

import Button from '@comfyorg/design-system/button/Button'
import { usePromptTagCatalogStore } from '@/platform/settings/promptTagCatalogStore'

const catalogInput = useTemplateRef('catalogInput')
const catalog = usePromptTagCatalogStore()
const importState = ref<'idle' | 'loading' | 'error'>('idle')
let disposed = false
onScopeDispose(() => (disposed = true))

async function importTags(event: Event) {
  const input = event.target
  if (!(input instanceof HTMLInputElement)) return
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (file.size > 10 * 1024 * 1024) {
    importState.value = 'error'
    return
  }
  importState.value = 'loading'
  let text: string
  try {
    text = await file.text()
  } catch {
    if (disposed) return
    importState.value = 'error'
    return
  }
  if (disposed) return
  importState.value = catalog.importCatalog(text) ? 'idle' : 'error'
}
</script>
