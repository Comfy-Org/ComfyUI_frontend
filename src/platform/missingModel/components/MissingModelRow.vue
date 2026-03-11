<template>
  <div class="flex w-full flex-col pb-3">
    <!-- Model header -->
    <div class="flex h-8 w-full items-center gap-2">
      <i class="text-foreground icon-[lucide--file-check] size-4 shrink-0" />

      <div class="flex min-w-0 flex-1 items-center">
        <p
          class="text-foreground min-w-0 truncate text-sm font-medium"
          :title="model.name"
        >
          {{ model.name }} ({{ model.referencingNodes.length }})
        </p>

        <Button
          variant="textonly"
          size="icon-sm"
          class="size-8 shrink-0 hover:bg-transparent"
          :aria-label="t('rightSidePanel.missingModels.copyModelName')"
          :title="t('rightSidePanel.missingModels.copyModelName')"
          @click="copyToClipboard(model.name)"
        >
          <i class="icon-[lucide--copy] size-3.5 text-muted-foreground" />
        </Button>
      </div>

      <!-- Check button -->
      <Button
        variant="textonly"
        size="icon-sm"
        :aria-label="t('rightSidePanel.missingModels.confirmSelection')"
        :disabled="!checkReady"
        :class="
          cn(
            'size-8 shrink-0 rounded-lg transition-colors',
            checkReady ? 'bg-primary/10 hover:bg-primary/15' : 'opacity-20'
          )
        "
        @click="
          confirmLibrarySelect(
            modelKey,
            model.name,
            model.referencingNodes,
            directory
          )
        "
      >
        <i
          class="icon-[lucide--check] size-4"
          :class="checkReady ? 'text-primary' : 'text-foreground'"
        />
      </Button>

      <!-- Expand/Collapse chevron (show referencing nodes) -->
      <Button
        v-if="model.referencingNodes.length > 0"
        variant="textonly"
        size="icon-sm"
        :aria-label="
          expanded
            ? t('rightSidePanel.missingModels.collapseNodes')
            : t('rightSidePanel.missingModels.expandNodes')
        "
        :class="
          cn(
            'size-8 shrink-0 transition-transform duration-200 hover:bg-transparent',
            expanded && 'rotate-180'
          )
        "
        @click="toggleModelExpand(modelKey)"
      >
        <i
          class="icon-[lucide--chevron-down] size-4 text-muted-foreground group-hover:text-base-foreground"
        />
      </Button>
    </div>

    <!-- Referencing nodes -->
    <TransitionCollapse>
      <div
        v-if="expanded"
        class="mb-1 flex flex-col gap-0.5 overflow-hidden pl-6"
      >
        <div
          v-for="ref in model.referencingNodes"
          :key="`${String(ref.nodeId)}::${ref.widgetName}`"
          class="flex h-7 items-center"
        >
          <span
            v-if="showNodeIdBadge"
            class="mr-1 shrink-0 rounded-md bg-secondary-background-selected px-2 py-0.5 font-mono text-xs font-bold text-muted-foreground"
          >
            #{{ ref.nodeId }}
          </span>
          <p class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {{ getNodeDisplayLabel(ref.nodeId, model.representative.nodeType) }}
          </p>
          <Button
            variant="textonly"
            size="icon-sm"
            :aria-label="t('rightSidePanel.missingModels.locateNode')"
            class="mr-1 size-6 shrink-0 text-muted-foreground hover:text-base-foreground"
            @click="emit('locateModel', String(ref.nodeId))"
          >
            <i class="icon-[lucide--locate] size-3" />
          </Button>
        </div>
      </div>
    </TransitionCollapse>

    <!-- Status card: Using from Library / Importing with Progress -->
    <TransitionCollapse>
      <div
        v-if="selectedLibraryModel[modelKey]"
        class="bg-foreground/5 relative mt-1 overflow-hidden rounded-lg border border-interface-stroke p-2"
      >
        <!-- Progress bar fill -->
        <div
          v-if="isDownloadActive"
          class="absolute inset-y-0 left-0 bg-primary/10 transition-all duration-200 ease-linear"
          :style="{
            width: (downloadStatus?.progress ?? 0) * 100 + '%'
          }"
        />

        <div class="relative z-10 flex items-center gap-2">
          <div class="flex size-8 shrink-0 items-center justify-center">
            <i
              v-if="importCategoryMismatch[modelKey]"
              class="mt-0.5 icon-[lucide--triangle-alert] size-5 text-warning-background"
            />
            <i
              v-else-if="downloadStatus?.status === 'failed'"
              class="icon-[lucide--circle-alert] size-5 text-destructive-background"
            />
            <i
              v-else-if="downloadStatus?.status === 'completed'"
              class="icon-[lucide--check-circle] size-5 text-success-background"
            />
            <i
              v-else-if="isDownloadActive"
              class="icon-[lucide--loader-circle] size-5 animate-spin text-muted-foreground"
            />
            <i
              v-else
              class="icon-[lucide--file-check] size-5 text-muted-foreground"
            />
          </div>
          <div class="flex min-w-0 flex-1 flex-col justify-center">
            <span class="text-foreground truncate text-xs/tight font-medium">
              {{ selectedLibraryModel[modelKey] }}
            </span>
            <span class="mt-0.5 text-xs/tight text-muted-foreground">
              <template v-if="importCategoryMismatch[modelKey]">
                {{
                  t('rightSidePanel.missingModels.alreadyExistsInCategory', {
                    category: importCategoryMismatch[modelKey]
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
            @click="cancelLibrarySelect(modelKey)"
          >
            <i class="icon-[lucide--circle-x] size-4" />
          </Button>
        </div>
      </div>
    </TransitionCollapse>

    <!-- Input area -->
    <TransitionCollapse>
      <div
        v-if="!selectedLibraryModel[modelKey]"
        class="mt-1 flex flex-col gap-2"
      >
        <template v-if="isAssetSupported">
          <!-- URL paste input -->
          <div
            :class="
              cn(
                'flex h-8 items-center rounded-lg border border-transparent bg-secondary-background px-3 transition-colors focus-within:border-interface-stroke',
                !canImportModels && 'cursor-pointer'
              )
            "
            @click="!canImportModels && showUploadDialog()"
          >
            <label :for="`url-input-${modelKey}`" class="sr-only">
              {{ t('rightSidePanel.missingModels.urlPlaceholder') }}
            </label>
            <input
              :id="`url-input-${modelKey}`"
              type="text"
              :value="urlInputs[modelKey] ?? ''"
              :readonly="!canImportModels"
              :placeholder="t('rightSidePanel.missingModels.urlPlaceholder')"
              :class="
                cn(
                  'text-foreground w-full border-none bg-transparent text-xs outline-none placeholder:text-muted-foreground',
                  !canImportModels && 'pointer-events-none opacity-60'
                )
              "
              @input="
                handleUrlInput(
                  modelKey,
                  ($event.target as HTMLInputElement).value
                )
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
              <i class="icon-[lucide--x] size-3.5" />
            </Button>
          </div>

          <!-- Metadata reveal area (shown after URL is validated) -->
          <TransitionCollapse>
            <div v-if="urlMetadata[modelKey]" class="flex flex-col gap-2">
              <div class="flex items-center gap-2 px-0.5 pt-0.5">
                <span
                  class="text-foreground min-w-0 truncate text-xs font-bold"
                >
                  {{ urlMetadata[modelKey]?.filename }}
                </span>
                <span
                  v-if="(urlMetadata[modelKey]?.content_length ?? 0) > 0"
                  class="shrink-0 rounded-sm bg-secondary-background-selected px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
                >
                  {{ formatSize(urlMetadata[modelKey]?.content_length ?? 0) }}
                </span>
              </div>

              <!-- Type mismatch warning -->
              <div v-if="typeMismatch" class="flex items-start gap-1.5 px-0.5">
                <i
                  class="mt-0.5 icon-[lucide--triangle-alert] size-3 shrink-0 text-warning-background"
                />
                <span class="text-[11px] leading-tight text-warning-background">
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
                  :disabled="urlImporting[modelKey]"
                  @click="handleImport(modelKey, directory)"
                >
                  <i
                    :class="
                      urlImporting[modelKey]
                        ? 'icon-[lucide--loader-circle] size-4 animate-spin'
                        : 'icon-[lucide--download] size-4'
                    "
                  />
                  {{
                    typeMismatch
                      ? t('rightSidePanel.missingModels.importAnyway')
                      : t('rightSidePanel.missingModels.import')
                  }}
                </Button>
              </div>
            </div>
          </TransitionCollapse>

          <!-- Fetching metadata spinner -->
          <TransitionCollapse>
            <div
              v-if="urlFetching[modelKey]"
              class="flex items-center justify-center py-2"
            >
              <i
                class="icon-[lucide--loader-circle] size-4 animate-spin text-muted-foreground"
              />
            </div>
          </TransitionCollapse>

          <!-- URL error message -->
          <TransitionCollapse>
            <div v-if="urlErrors[modelKey]" class="px-0.5">
              <span class="text-xs text-destructive-background-hover">
                {{ urlErrors[modelKey] }}
              </span>
            </div>
          </TransitionCollapse>
        </template>

        <TransitionCollapse>
          <div v-if="!urlInputs[modelKey]" class="flex flex-col gap-2">
            <!-- OR divider -->
            <div
              v-if="model.representative.isAssetSupported"
              class="flex items-center justify-center py-0.5"
            >
              <span class="text-[10px] font-bold text-muted-foreground">
                {{ t('rightSidePanel.missingModels.or') }}
              </span>
            </div>

            <!-- Use from Library -->
            <SelectPlus
              :model-value="getComboValue(model.representative)"
              :options="comboOptions"
              option-label="name"
              option-value="value"
              :disabled="comboOptions.length === 0"
              :filter="comboOptions.length > 4"
              auto-filter-focus
              :placeholder="t('rightSidePanel.missingModels.useFromLibrary')"
              class="h-8 w-full rounded-lg border border-transparent bg-secondary-background text-xs transition-colors hover:border-interface-stroke"
              size="small"
              :pt="{
                option: 'text-xs',
                dropdown: 'w-8',
                label: 'min-w-[4ch] truncate text-xs',
                overlay: 'w-fit min-w-full'
              }"
              @update:model-value="handleComboSelect(modelKey, $event)"
            >
              <template #dropdownicon>
                <i
                  class="icon-[lucide--chevron-down] size-3.5 text-muted-foreground"
                />
              </template>
            </SelectPlus>
          </div>
        </TransitionCollapse>
      </div>
    </TransitionCollapse>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { cn } from '@/utils/tailwindUtil'
import Button from '@/components/ui/button/Button.vue'
import TransitionCollapse from '@/components/rightSidePanel/layout/TransitionCollapse.vue'
import SelectPlus from '@/components/primevueOverride/SelectPlus.vue'
import { useFeatureFlags } from '@/composables/useFeatureFlags'
import { useModelUpload } from '@/platform/assets/composables/useModelUpload'
import type { MissingModelViewModel } from '@/platform/missingModel/types'
import { formatSize } from '@/utils/formatUtil'

import {
  useMissingModelInteractions,
  getModelStateKey
} from '@/platform/missingModel/composables/useMissingModelInteractions'
import { useMissingModelStore } from '@/platform/missingModel/missingModelStore'
import { useCopyToClipboard } from '@/composables/useCopyToClipboard'

const { model, directory, showNodeIdBadge, isAssetSupported } = defineProps<{
  model: MissingModelViewModel
  directory: string | null
  showNodeIdBadge: boolean
  isAssetSupported: boolean
}>()

const emit = defineEmits<{
  locateModel: [nodeId: string]
}>()

const { flags } = useFeatureFlags()
const canImportModels = computed(() => flags.privateModelsEnabled)
const { showUploadDialog } = useModelUpload()

const { t } = useI18n()
const { copyToClipboard } = useCopyToClipboard()

/** Unique key isolating state by support type + directory + model name. */
const modelKey = computed(() =>
  getModelStateKey(model.name, directory, isAssetSupported)
)

const downloadStatus = computed(() => getDownloadStatus(modelKey.value))
const comboOptions = computed(() => getComboOptions(model.representative))
const checkReady = computed(() => isCheckReady(modelKey.value))
const expanded = computed(() => isModelExpanded(modelKey.value))
const typeMismatch = computed(() => getTypeMismatch(modelKey.value, directory))
const isDownloadActive = computed(
  () =>
    downloadStatus.value?.status === 'running' ||
    downloadStatus.value?.status === 'created'
)

const store = useMissingModelStore()
const {
  selectedLibraryModel,
  importCategoryMismatch,
  urlInputs,
  urlMetadata,
  urlFetching,
  urlErrors,
  urlImporting
} = storeToRefs(store)

const {
  toggleModelExpand,
  isModelExpanded,
  getNodeDisplayLabel,
  getComboValue,
  getComboOptions,
  handleComboSelect,
  isCheckReady,
  cancelLibrarySelect,
  confirmLibrarySelect,
  handleUrlInput,
  getTypeMismatch,
  getDownloadStatus,
  handleImport
} = useMissingModelInteractions()
</script>
