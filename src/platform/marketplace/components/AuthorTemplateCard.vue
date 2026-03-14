<template>
  <div
    class="flex flex-col justify-between gap-3 rounded-lg border border-muted p-3"
  >
    <div class="flex items-center gap-2">
      <div class="column flex shrink-0 gap-1">
        <div class="flex size-12 overflow-hidden rounded-md bg-dialog-surface">
          <img
            v-if="template.thumbnail && !thumbErrors[template.id]"
            :src="template.thumbnail"
            :alt="template.title"
            loading="lazy"
            class="size-full object-cover"
            @error="$emit('thumbError', template.id)"
          />
          <div
            v-if="!template.thumbnail || thumbErrors[template.id]"
            class="flex size-full items-center justify-center"
          >
            <i class="icon-[lucide--image] size-6 text-muted" />
          </div>
        </div>
        <div class="flex size-12 overflow-hidden rounded-md bg-dialog-surface">
          <img
            v-if="template.workflowPreview && !previewErrors[template.id]"
            :src="template.workflowPreview"
            :alt="`${template.title} workflow`"
            loading="lazy"
            class="size-full object-cover"
            @error="$emit('previewError', template.id)"
          />
          <div
            v-if="!template.workflowPreview || previewErrors[template.id]"
            class="flex size-full items-center justify-center"
          >
            <i
              class="icon-[lucide--git-branch] size-4 text-muted"
              aria-hidden
            />
          </div>
        </div>
      </div>
      <div class="min-w-0 flex-1">
        <div class="font-medium">{{ template.title }}</div>
        <div class="text-sm text-muted">
          {{ template.shortDescription }}
        </div>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <span v-if="showDownloadStats" class="text-sm text-muted">
        {{ template.stats.downloads }}
        {{ $t('marketplace.stats.downloads').toLowerCase() }}
      </span>
      <div class="ml-auto flex items-center gap-2">
        <button
          v-if="isPublishable"
          :data-testid="`btn-publish-template-${template.id}`"
          :disabled="isPublishing"
          class="focus-visible:ring-ring text-secondary-foreground relative inline-flex h-8 cursor-pointer touch-manipulation appearance-none items-center justify-center gap-2 rounded-lg border-none bg-secondary-background p-2 px-3 font-inter text-xs font-medium whitespace-nowrap transition-colors hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([width]):not([height])]:size-4"
          @click="$emit('publish', template)"
        >
          {{
            isPublishing
              ? $t('marketplace.publishing')
              : $t('marketplace.publish')
          }}
        </button>
        <button
          v-if="isUnpublishable"
          :data-testid="`btn-unpublish-template-${template.id}`"
          :disabled="isUnpublishing"
          class="focus-visible:ring-ring text-secondary-foreground relative inline-flex h-8 cursor-pointer touch-manipulation appearance-none items-center justify-center gap-2 rounded-lg border-none bg-secondary-background p-2 px-3 font-inter text-xs font-medium whitespace-nowrap transition-colors hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([width]):not([height])]:size-4"
          @click="$emit('unpublish', template)"
        >
          {{
            isUnpublishing
              ? $t('marketplace.unpublishing')
              : $t('marketplace.unpublish')
          }}
        </button>
        <button
          v-if="isEditable"
          :data-testid="`btn-edit-template-${template.id}`"
          class="focus-visible:ring-ring text-secondary-foreground relative inline-flex h-8 cursor-pointer touch-manipulation appearance-none items-center justify-center gap-2 rounded-lg border-none bg-secondary-background p-2 px-3 font-inter text-xs font-medium whitespace-nowrap transition-colors hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([width]):not([height])]:size-4"
          @click="$emit('edit', template)"
        >
          {{ $t('marketplace.edit') }}
        </button>
        <button
          v-if="!isEditable"
          :data-testid="`btn-view-template-${template.id}`"
          class="focus-visible:ring-ring text-secondary-foreground relative inline-flex h-8 cursor-pointer touch-manipulation appearance-none items-center justify-center gap-2 rounded-lg border-none bg-secondary-background p-2 px-3 font-inter text-xs font-medium whitespace-nowrap transition-colors hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([width]):not([height])]:size-4"
          @click="$emit('view', template)"
        >
          {{ $t('marketplace.view') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  MarketplaceTemplate,
  TemplateStatus
} from '@/platform/marketplace/apiTypes'

const EDITABLE_STATUSES: TemplateStatus[] = [
  'draft',
  'pending_review',
  'rejected'
]

const props = defineProps<{
  template: MarketplaceTemplate
  status: TemplateStatus
  thumbErrors: Record<string, boolean>
  previewErrors: Record<string, boolean>
  isPublishingTemplate: string | null
  isUnpublishingTemplate: string | null
}>()

defineEmits<{
  (e: 'edit', template: MarketplaceTemplate): void
  (e: 'view', template: MarketplaceTemplate): void
  (e: 'publish', template: MarketplaceTemplate): void
  (e: 'unpublish', template: MarketplaceTemplate): void
  (e: 'thumbError', templateId: string): void
  (e: 'previewError', templateId: string): void
}>()

const LIVE_STATUSES: TemplateStatus[] = ['published', 'unpublished']

const isEditable = EDITABLE_STATUSES.includes(props.status)
const isPublishable =
  props.status === 'approved' || props.status === 'unpublished'
const isUnpublishable = props.status === 'published'
const showDownloadStats = LIVE_STATUSES.includes(props.status)
const isPublishing = props.isPublishingTemplate === props.template.id
const isUnpublishing = props.isUnpublishingTemplate === props.template.id
</script>
