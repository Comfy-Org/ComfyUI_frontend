<template>
  <div
    class="flex h-8 items-center rounded-lg border border-transparent bg-secondary-background px-3 transition-colors focus-within:border-interface-stroke"
  >
    <label :for="`url-input-${modelKey}`" class="sr-only">
      {{ t('rightSidePanel.missingModels.urlPlaceholder') }}
    </label>
    <input
      :id="`url-input-${modelKey}`"
      type="text"
      :value="urlInputs[modelKey] ?? ''"
      :placeholder="t('rightSidePanel.missingModels.urlPlaceholder')"
      class="text-foreground w-full border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground"
      @input="
        handleUrlInput(modelKey, ($event.target as HTMLInputElement).value)
      "
    />
    <Button
      v-if="urlInputs[modelKey]"
      variant="textonly"
      size="icon-sm"
      :aria-label="t('rightSidePanel.missingModels.clearUrl')"
      class="ml-1 shrink-0"
      @click.stop="handleUrlInput(modelKey, '')"
    >
      <i aria-hidden="true" class="icon-[lucide--x] size-3.5" />
    </Button>
  </div>

  <TransitionCollapse>
    <div v-if="urlMetadata[modelKey]" class="flex flex-col gap-2">
      <div class="flex items-center gap-2 px-0.5 pt-2.5">
        <span class="text-foreground min-w-0 truncate text-xs font-bold">
          {{ urlMetadata[modelKey]?.filename }}
        </span>
        <span
          v-if="(urlMetadata[modelKey]?.content_length ?? 0) > 0"
          class="shrink-0 rounded-sm bg-secondary-background-selected px-1.5 py-0.5 text-xs font-medium text-muted-foreground"
        >
          {{ formatSize(urlMetadata[modelKey]?.content_length ?? 0) }}
        </span>
      </div>

      <div v-if="typeMismatch" class="flex items-start gap-1.5 px-0.5">
        <i
          aria-hidden="true"
          class="mt-0.5 icon-[lucide--triangle-alert] size-3 shrink-0 text-warning-background"
        />
        <span class="text-xs/tight text-warning-background">
          {{
            t('rightSidePanel.missingModels.typeMismatch', {
              detectedType: typeMismatch
            })
          }}
        </span>
      </div>

      <div class="pt-0.5">
        <Button
          variant="primary"
          class="h-9 w-full justify-center gap-2 text-sm font-semibold"
          :loading="urlImporting[modelKey]"
          @click="handleImportClick"
        >
          <i aria-hidden="true" class="icon-[lucide--download] size-4" />
          {{
            typeMismatch
              ? t('rightSidePanel.missingModels.importAnyway')
              : t('rightSidePanel.missingModels.import')
          }}
        </Button>
      </div>
    </div>
  </TransitionCollapse>

  <TransitionCollapse>
    <div
      v-if="urlFetching[modelKey]"
      aria-live="polite"
      class="flex items-center justify-center py-2"
    >
      <i
        aria-hidden="true"
        class="icon-[lucide--loader-circle] size-4 animate-spin text-muted-foreground"
      />
      <span class="sr-only">{{ t('g.loading') }}</span>
    </div>
  </TransitionCollapse>

  <TransitionCollapse>
    <div v-if="urlErrors[modelKey]" class="px-0.5" role="alert">
      <span class="text-xs text-destructive-background-hover">
        {{ urlErrors[modelKey] }}
      </span>
    </div>
  </TransitionCollapse>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import { formatSize } from '@/utils/formatUtil'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useMissingModelInteractions } from '@/platform/missingModel/composables/useMissingModelInteractions'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'

const { modelKey, directory, typeMismatch } = defineProps<{
  modelKey: string
  directory: string | null
  typeMismatch: string | null
}>()

const { t } = useI18n()
const { flags } = useFeatureFlags()
const canImportModels = computed(() => flags.privateModelsEnabled)
const { showUploadDialog } = useModelUpload()

const store = useMissingModelStore()
const { urlInputs, urlMetadata, urlFetching, urlErrors, urlImporting } =
  storeToRefs(store)

const { handleUrlInput, handleImport } = useMissingModelInteractions()

function handleImportClick() {
  if (canImportModels.value) {
    handleImport(modelKey, directory)
  } else {
    showUploadDialog()
  }
}
</script>
