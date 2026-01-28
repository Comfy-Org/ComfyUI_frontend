<template>
  <div
    class="flex h-full flex-col scrollbar-custom"
    data-component-id="ModelInfoPanel"
  >
    <div
      v-if="model.previewUrl"
      class="relative w-full aspect-square bg-modal-panel-background border-t border-border-default"
    >
      <img
        v-if="!imageError"
        :src="model.previewUrl"
        :alt="model.displayName"
        loading="lazy"
        decoding="async"
        class="size-full object-cover"
        @error="imageError = true"
      />
      <div
        v-else
        class="flex size-full items-center justify-center bg-gradient-to-br from-smoke-400 via-smoke-800 to-charcoal-400"
      >
        <i
          :class="
            cn(getModelTypeIcon(model.type), 'size-16 text-muted-foreground')
          "
        />
      </div>
    </div>

    <div
      class="sticky top-0 z-20 px-4 py-3 bg-modal-panel-background border-t border-border-default"
    >
      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 inline-flex items-center justify-center gap-2 cursor-pointer whitespace-nowrap appearance-none border-none font-medium font-inter transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-primary-background text-primary-foreground hover:bg-primary-background-hover h-10 rounded-lg px-4 py-2 text-sm"
          @click="emit('use', model)"
        >
          <i class="icon-[lucide--plus]" />
          {{ $t('modelBrowser.use') }}
        </button>
      </div>
    </div>

    <div
      class="flex flex-col bg-modal-panel-background border-t border-border-default"
    >
      <div
        class="sticky top-0 z-10 flex items-center justify-between backdrop-blur-xl bg-inherit"
      >
        <button
          type="button"
          class="group min-h-12 bg-transparent border-0 outline-0 ring-0 w-full text-left flex items-center justify-between pl-4 pr-3 cursor-pointer"
          @click="basicInfoOpen = !basicInfoOpen"
        >
          <span class="text-sm font-semibold line-clamp-2 flex-1">
            <span class="text-xs uppercase font-inter select-none">{{
              $t('modelBrowser.basicInfo')
            }}</span>
          </span>
          <i
            :class="
              cn(
                'text-muted-foreground group-hover:text-base-foreground group-focus:text-base-foreground size-4 transition-all',
                basicInfoOpen
                  ? 'icon-[lucide--chevron-up]'
                  : 'icon-[lucide--chevron-down]'
              )
            "
          />
        </button>
      </div>

      <div v-if="basicInfoOpen" class="pb-4">
        <div class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground">
          <div class="flex items-center justify-between relative">
            <span class="select-none">{{
              $t('modelBrowser.displayName')
            }}</span>
          </div>
          <div class="group flex justify-between">
            <div
              class="editable-text break-all text-muted-foreground flex-auto"
            >
              <span>{{ model.displayName }}</span>
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground">
          <div class="flex items-center justify-between relative">
            <span class="select-none">{{ $t('modelBrowser.fileName') }}</span>
          </div>
          <span class="break-all text-muted-foreground">{{
            model.fileName
          }}</span>
        </div>

        <div class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground">
          <div class="flex items-center justify-between relative">
            <span class="select-none">{{ $t('modelBrowser.filePath') }}</span>
          </div>
          <span class="break-all text-muted-foreground font-mono text-xs">{{
            filePath
          }}</span>
        </div>

        <div
          v-if="model.size"
          class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground"
        >
          <div class="flex items-center justify-between relative">
            <span class="select-none">{{ $t('modelBrowser.fileSize') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <i class="icon-[lucide--hard-drive] size-4 text-muted-foreground" />
            <span class="text-muted-foreground">{{
              formatFileSize(model.size)
            }}</span>
          </div>
        </div>

        <div
          v-if="model.modified"
          class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground"
        >
          <div class="flex items-center justify-between relative">
            <span class="select-none">{{
              $t('modelBrowser.lastModified')
            }}</span>
          </div>
          <div class="flex items-center gap-2">
            <i class="icon-[lucide--clock] size-4 text-muted-foreground" />
            <span class="text-muted-foreground">{{
              formatModifiedDate(model.modified)
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex flex-col bg-modal-panel-background border-t border-border-default"
    >
      <div
        class="sticky top-0 z-10 flex items-center justify-between backdrop-blur-xl bg-inherit"
      >
        <button
          type="button"
          class="group min-h-12 bg-transparent border-0 outline-0 ring-0 w-full text-left flex items-center justify-between pl-4 pr-3 cursor-pointer"
          @click="taggingOpen = !taggingOpen"
        >
          <span class="text-sm font-semibold line-clamp-2 flex-1">
            <span class="text-xs uppercase font-inter select-none">{{
              $t('modelBrowser.modelTagging')
            }}</span>
          </span>
          <i
            :class="
              cn(
                'text-muted-foreground group-hover:text-base-foreground group-focus:text-base-foreground size-4 transition-all',
                taggingOpen
                  ? 'icon-[lucide--chevron-up]'
                  : 'icon-[lucide--chevron-down]'
              )
            "
          />
        </button>
      </div>

      <div v-if="taggingOpen" class="pb-4">
        <div class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground">
          <div class="flex items-center justify-between relative">
            <span class="select-none">{{ $t('modelBrowser.modelType') }}</span>
          </div>
          <div class="p-2 text-sm text-muted-foreground">{{ model.type }}</div>
        </div>

        <div
          v-if="model.tags && model.tags.length > 0"
          class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground"
        >
          <div class="flex items-center justify-between relative">
            <span class="select-none">{{
              $t('modelBrowser.additionalTags')
            }}</span>
          </div>
          <div class="flex flex-wrap gap-1">
            <span
              v-for="tag in model.tags"
              :key="tag"
              class="inline-flex px-2 py-0.5 rounded text-xs bg-base-surface-secondary text-foreground"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div
      class="flex flex-col bg-modal-panel-background border-t border-border-default"
    >
      <div
        class="sticky top-0 z-10 flex items-center justify-between backdrop-blur-xl bg-inherit"
      >
        <button
          type="button"
          class="group min-h-12 bg-transparent border-0 outline-0 ring-0 w-full text-left flex items-center justify-between pl-4 pr-3 cursor-pointer"
          @click="descriptionOpen = !descriptionOpen"
        >
          <span class="text-sm font-semibold line-clamp-2 flex-1">
            <span class="text-xs uppercase font-inter select-none">{{
              $t('modelBrowser.modelDescription')
            }}</span>
          </span>
          <i
            :class="
              cn(
                'text-muted-foreground group-hover:text-base-foreground group-focus:text-base-foreground size-4 transition-all',
                descriptionOpen
                  ? 'icon-[lucide--chevron-up]'
                  : 'icon-[lucide--chevron-down]'
              )
            "
          />
        </button>
      </div>

      <div v-if="descriptionOpen" class="pb-4">
        <div class="flex flex-col gap-2 px-4 py-2 text-sm text-base-foreground">
          <div class="flex items-center justify-between relative">
            <span class="select-none">{{
              $t('modelBrowser.description')
            }}</span>
          </div>
          <textarea
            disabled
            :placeholder="model.description || 'No description set'"
            rows="3"
            class="w-full resize-y rounded-lg border border-transparent bg-transparent px-3 py-2 text-sm text-component-node-foreground outline-none transition-colors focus:bg-component-node-widget-background cursor-not-allowed"
            :value="model.description"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

import type { EnrichedModel } from '@/platform/models/browser/types/modelBrowserTypes'
import {
  formatFileSize,
  formatModifiedDate
} from '@/platform/models/browser/utils/modelTransform'
import { getModelTypeIcon } from '@/platform/models/browser/utils/modelTypeIcons'
import { cn } from '@/utils/tailwindUtil'

const { model } = defineProps<{
  model: EnrichedModel
}>()

const emit = defineEmits<{
  use: [model: EnrichedModel]
}>()

const imageError = ref(false)
const basicInfoOpen = ref(true)
const taggingOpen = ref(true)
const descriptionOpen = ref(true)

const filePath = computed(() => {
  return `${model.directory}/${model.fileName}`
})
</script>
