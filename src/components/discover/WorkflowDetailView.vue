<template>
  <div class="flex size-full flex-col">
    <!-- Header with back button -->
    <div
      class="flex shrink-0 items-center gap-4 border-b border-interface-stroke px-6 py-4"
    >
      <Button variant="secondary" size="md" @click="emit('back')">
        <i class="icon-[lucide--arrow-left]" />
        {{ $t('g.back') }}
      </Button>
      <h1 class="flex-1 truncate text-xl font-semibold text-base-foreground">
        {{ workflow.title }}
      </h1>
    </div>

    <!-- Two-column layout -->
    <div class="flex flex-1 overflow-hidden">
      <!-- Left column: Workflow info -->
      <div class="flex w-80 shrink-0 flex-col border-r border-interface-stroke">
        <div class="flex-1 space-y-5 overflow-y-auto p-4">
          <!-- Thumbnail -->
          <div
            class="aspect-video overflow-hidden rounded-lg bg-dialog-surface"
          >
            <LazyImage
              :src="workflow.thumbnail_url"
              :alt="workflow.title"
              class="size-full object-cover"
            />
          </div>

          <!-- Author -->
          <div class="flex items-center gap-3">
            <img
              :src="authorAvatar"
              :alt="authorName"
              class="size-8 rounded-full bg-secondary-background object-cover"
            />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-base-foreground">
                {{ authorName }}
              </div>
              <div class="truncate text-xs text-muted-foreground">
                {{ $t('discover.detail.officialWorkflow') }}
              </div>
            </div>
          </div>

          <!-- Stats -->
          <div class="flex items-center gap-4">
            <div
              v-if="workflow.run_count !== undefined"
              class="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <i class="icon-[lucide--play] size-3.5" />
              <span>{{ formatCount(workflow.run_count) }}</span>
            </div>
            <div
              v-if="workflow.view_count !== undefined"
              class="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <i class="icon-[lucide--eye] size-3.5" />
              <span>{{ formatCount(workflow.view_count) }}</span>
            </div>
            <div
              v-if="workflow.copy_count !== undefined"
              class="flex items-center gap-1 text-xs text-muted-foreground"
            >
              <i class="icon-[lucide--copy] size-3.5" />
              <span>{{ formatCount(workflow.copy_count) }}</span>
            </div>
          </div>

          <!-- Description -->
          <div class="space-y-1">
            <h3 class="text-xs font-medium text-muted-foreground">
              {{ $t('g.description') }}
            </h3>
            <p class="whitespace-pre-wrap text-sm text-base-foreground">
              {{ workflow.description }}
            </p>
          </div>

          <!-- Tags -->
          <div v-if="workflow.tags.length > 0" class="space-y-1">
            <h3 class="text-xs font-medium text-muted-foreground">
              {{ $t('discover.filters.tags') }}
            </h3>
            <div class="flex flex-wrap gap-1">
              <SquareChip
                v-for="tag in workflow.tags"
                :key="tag"
                :label="tag"
              />
            </div>
          </div>

          <!-- Models -->
          <div v-if="workflow.models.length > 0" class="space-y-1">
            <h3 class="text-xs font-medium text-muted-foreground">
              {{ $t('discover.filters.models') }}
            </h3>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="model in workflow.models"
                :key="model"
                class="rounded bg-secondary-background px-1.5 py-0.5 text-xs text-muted-foreground"
              >
                {{ model }}
              </span>
            </div>
          </div>

          <!-- Media type -->
          <div class="space-y-1">
            <h3 class="text-xs font-medium text-muted-foreground">
              {{ $t('discover.detail.mediaType') }}
            </h3>
            <div class="flex items-center gap-1.5">
              <i :class="['size-4', mediaTypeIcon]" />
              <span class="text-sm capitalize text-base-foreground">
                {{ workflow.media_type }}
              </span>
            </div>
          </div>

          <!-- Open source badge -->
          <div v-if="workflow.open_source" class="flex items-center gap-1.5">
            <i class="icon-[lucide--unlock] size-4 text-green-500" />
            <span class="text-xs text-green-500">
              {{ $t('discover.detail.openSource') }}
            </span>
          </div>

          <!-- Required custom nodes -->
          <div
            v-if="workflow.requires_custom_nodes.length > 0"
            class="space-y-1"
          >
            <h3 class="text-xs font-medium text-muted-foreground">
              {{ $t('discover.detail.requiredNodes') }}
            </h3>
            <div class="flex flex-wrap gap-1">
              <span
                v-for="node in workflow.requires_custom_nodes"
                :key="node"
                class="rounded bg-warning-background px-1.5 py-0.5 text-xs text-warning-foreground"
              >
                {{ node }}
              </span>
            </div>
          </div>
        </div>

        <!-- Action buttons -->
        <div
          class="flex shrink-0 flex-col gap-2 border-t border-interface-stroke p-4"
        >
          <Button
            variant="primary"
            size="md"
            class="w-full"
            @click="handleRunWorkflow"
          >
            <i class="icon-[lucide--play]" />
            {{ $t('discover.detail.runWorkflow') }}
          </Button>
          <Button
            variant="secondary"
            size="md"
            class="w-full"
            @click="handleMakeCopy"
          >
            <i class="icon-[lucide--copy]" />
            {{ $t('discover.detail.makeCopy') }}
          </Button>
        </div>
      </div>

      <!-- Right column: Workflow preview -->
      <div class="min-h-0 min-w-0 flex-1">
        <WorkflowPreviewCanvas :workflow-url="workflow.workflow_url" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import SquareChip from '@/components/chip/SquareChip.vue'
import LazyImage from '@/components/common/LazyImage.vue'
import WorkflowPreviewCanvas from '@/components/discover/WorkflowPreviewCanvas.vue'
import Button from '@/components/ui/button/Button.vue'
import type { AlgoliaWorkflowTemplate } from '@/types/discoverTypes'

const { t } = useI18n()

const { workflow } = defineProps<{
  workflow: AlgoliaWorkflowTemplate
}>()

const emit = defineEmits<{
  back: []
  runWorkflow: [workflow: AlgoliaWorkflowTemplate]
  makeCopy: [workflow: AlgoliaWorkflowTemplate]
}>()

const authorName = computed(
  () => workflow.author_name ?? t('discover.detail.author')
)

const authorAvatar = computed(
  () => workflow.author_avatar_url ?? '/assets/images/comfy-logo-single.svg'
)

const mediaTypeIcon = computed(() => {
  switch (workflow.media_type) {
    case 'image':
      return 'icon-[lucide--image]'
    case 'video':
      return 'icon-[lucide--video]'
    case 'audio':
      return 'icon-[lucide--volume-2]'
    case '3d':
      return 'icon-[lucide--box]'
    default:
      return 'icon-[lucide--file]'
  }
})

function formatCount(count: number): string {
  if (count >= 1_000_000) {
    return `${(count / 1_000_000).toFixed(1)}M`
  }
  if (count >= 1_000) {
    return `${(count / 1_000).toFixed(1)}K`
  }
  return count.toString()
}

function handleRunWorkflow() {
  emit('runWorkflow', workflow)
}

function handleMakeCopy() {
  emit('makeCopy', workflow)
}
</script>
