<template>
  <div
    aria-live="polite"
    class="bg-foreground/5 relative mt-1 overflow-hidden rounded-lg border border-interface-stroke p-2"
  >
    <!-- Progress bar fill -->
    <div
      v-if="isDownloadActive"
      class="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-200 ease-linear"
      :style="{ width: (downloadStatus?.progress ?? 0) * 100 + '%' }"
    />

    <div class="relative z-10 flex items-center gap-2">
      <div class="flex size-8 shrink-0 items-center justify-center">
        <i
          v-if="categoryMismatch"
          aria-hidden="true"
          class="mt-0.5 icon-[lucide--triangle-alert] size-5 text-warning-background"
        />
        <i
          v-else-if="downloadStatus?.status === 'failed'"
          aria-hidden="true"
          class="icon-[lucide--circle-alert] size-5 text-destructive-background"
        />
        <i
          v-else-if="downloadStatus?.status === 'cancelled'"
          aria-hidden="true"
          class="icon-[lucide--circle-x] size-5 text-destructive-background"
        />
        <i
          v-else-if="downloadStatus?.status === 'completed'"
          aria-hidden="true"
          class="icon-[lucide--check-circle] size-5 text-success-background"
        />
        <i
          v-else-if="downloadStatus?.status === 'paused'"
          aria-hidden="true"
          class="icon-[lucide--pause-circle] size-5 text-muted-foreground"
        />
        <i
          v-else-if="isDownloadActive"
          aria-hidden="true"
          class="icon-[lucide--loader-circle] size-5 animate-spin text-muted-foreground"
        />
        <i
          v-else
          aria-hidden="true"
          class="icon-[lucide--file-check] size-5 text-muted-foreground"
        />
      </div>

      <div class="flex min-w-0 flex-1 flex-col justify-center">
        <span class="text-foreground truncate text-xs/tight font-medium">
          {{ modelName }}
        </span>
        <span class="mt-0.5 text-xs/tight text-muted-foreground">
          <template v-if="categoryMismatch">
            {{
              t('rightSidePanel.missingModels.alreadyExistsInCategory', {
                category: categoryMismatch
              })
            }}
          </template>
          <template v-else-if="isDownloadActive">
            {{ t('rightSidePanel.missingModels.importing') }}
            {{ Math.round((downloadStatus?.progress ?? 0) * 100) }}%
          </template>
          <template v-else-if="downloadStatus?.status === 'completed'">
            {{ t('rightSidePanel.missingModels.imported') }}
          </template>
          <template v-else-if="downloadStatus?.status === 'paused'">
            {{ t('electronFileDownload.paused') }}
            {{ Math.round((downloadStatus?.progress ?? 0) * 100) }}%
          </template>
          <template v-else-if="downloadStatus?.status === 'cancelled'">
            {{ t('electronFileDownload.cancelled') }}
          </template>
          <template v-else-if="downloadStatus?.status === 'failed'">
            {{
              downloadStatus?.error ||
              t('rightSidePanel.missingModels.importFailed')
            }}
          </template>
          <template v-else>
            {{ t('rightSidePanel.missingModels.usingFromLibrary') }}
          </template>
        </span>
      </div>

      <Button
        variant="textonly"
        size="icon-sm"
        :aria-label="t('rightSidePanel.missingModels.cancelSelection')"
        class="relative z-10 size-6 shrink-0 text-muted-foreground hover:text-base-foreground"
        @click="emit('cancel')"
      >
        <i aria-hidden="true" class="icon-[lucide--circle-x] size-4" />
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import Button from '@/components/ui/button/Button.vue'
import type { MissingModelDownloadStatus } from '@/platform/missingModel/types'

const {
  modelName,
  isDownloadActive,
  downloadStatus = null,
  categoryMismatch = null
} = defineProps<{
  modelName: string
  isDownloadActive: boolean
  downloadStatus?: MissingModelDownloadStatus | null
  categoryMismatch?: string | null
}>()

const emit = defineEmits<{
  cancel: []
}>()

const { t } = useI18n()
</script>
