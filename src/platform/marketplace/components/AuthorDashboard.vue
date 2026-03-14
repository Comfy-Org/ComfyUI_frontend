<template>
  <BaseModalLayout class="size-full max-h-full max-w-full min-w-0">
    <template #header>
      <h2>{{ $t('marketplace.authorDashboard') }}</h2>
    </template>

    <template #content>
      <div v-if="isLoading" class="flex items-center justify-center py-12">
        <i class="icon-[lucide--loader-2] animate-spin text-muted" />
      </div>

      <div
        v-else-if="error"
        class="flex flex-col items-center gap-2 py-12 text-center"
      >
        <i class="text-danger icon-[lucide--alert-circle] size-6" />
        <p class="text-sm text-muted">{{ error }}</p>
      </div>

      <div v-else class="flex flex-col gap-6">
        <div v-if="stats" class="grid grid-cols-4 gap-4">
          <div class="border-border rounded-lg border p-4 text-center">
            <div class="text-2xl font-bold">{{ stats.totalDownloads }}</div>
            <div class="text-sm text-muted">
              {{ $t('marketplace.stats.downloads') }}
            </div>
          </div>
          <div class="border-border rounded-lg border p-4 text-center">
            <div class="text-2xl font-bold">{{ stats.totalFavorites }}</div>
            <div class="text-sm text-muted">
              {{ $t('marketplace.stats.favorites') }}
            </div>
          </div>
          <div class="border-border rounded-lg border p-4 text-center">
            <div class="text-2xl font-bold">
              {{ stats.averageRating.toFixed(1) }}
            </div>
            <div class="text-sm text-muted">
              {{ $t('marketplace.stats.rating') }}
            </div>
          </div>
          <div class="border-border rounded-lg border p-4 text-center">
            <div class="text-2xl font-bold">
              {{ stats.trend > 0 ? '+' : '' }}{{ stats.trend }}%
            </div>
            <div class="text-sm text-muted">
              {{ $t('marketplace.stats.trend') }}
            </div>
          </div>
        </div>

        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <h3 class="m-0 text-base font-semibold">
              {{ $t('marketplace.myTemplates') }}
            </h3>
            <button
              :aria-label="$t('marketplace.refresh')"
              :disabled="isLoading"
              class="focus-visible:ring-ring text-secondary-foreground relative ml-auto inline-flex h-8 cursor-pointer touch-manipulation appearance-none items-center justify-center gap-2 rounded-lg border-none bg-secondary-background p-2 px-3 font-inter text-xs font-medium whitespace-nowrap transition-colors hover:bg-secondary-background-hover focus-visible:ring-1 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([width]):not([height])]:size-4"
              data-testid="btn-refresh-templates"
              @click="handleRefresh"
            >
              <i
                :class="[
                  'icon-[lucide--refresh-cw] size-4',
                  isLoading && 'animate-spin'
                ]"
              />
              <span class="p-button-label" data-pc-section="label">{{
                $t('marketplace.refresh')
              }}</span>
            </button>
          </div>
          <div v-for="statusGroup in statusGroups" :key="statusGroup.status">
            <template v-if="statusGroup.templates.length > 0">
              <h3 class="mb-2 text-sm font-semibold">
                {{ $t(`marketplace.status.${statusGroup.status}`) }}
                <span class="ml-1 text-muted">
                  ({{ statusGroup.templates.length }})
                </span>
              </h3>
              <div class="flex flex-col gap-2">
                <div
                  v-for="template in statusGroup.templates"
                  :key="template.id"
                  class="border-border flex items-center justify-between gap-3 rounded-lg border p-3"
                >
                  <div class="flex shrink-0 gap-1">
                    <div
                      class="flex size-12 overflow-hidden rounded-md bg-dialog-surface"
                    >
                      <img
                        v-if="template.thumbnail && !thumbErrors[template.id]"
                        :src="template.thumbnail"
                        :alt="template.title"
                        loading="lazy"
                        class="size-full object-cover"
                        @error="thumbErrors[template.id] = true"
                      />
                      <div
                        v-if="!template.thumbnail || thumbErrors[template.id]"
                        class="flex size-full items-center justify-center"
                      >
                        <i class="icon-[lucide--image] size-6 text-muted" />
                      </div>
                    </div>
                    <div
                      class="flex size-12 overflow-hidden rounded-md bg-dialog-surface"
                    >
                      <img
                        v-if="
                          template.workflowPreview &&
                          !previewErrors[template.id]
                        "
                        :src="template.workflowPreview"
                        :alt="`${template.title} workflow`"
                        loading="lazy"
                        class="size-full object-cover"
                        @error="previewErrors[template.id] = true"
                      />
                      <div
                        v-if="
                          !template.workflowPreview ||
                          previewErrors[template.id]
                        "
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
                  <div class="flex items-center gap-2">
                    <button
                      v-if="isPublishable(statusGroup.status)"
                      :data-testid="`btn-publish-template-${template.id}`"
                      :disabled="isPublishingTemplate === template.id"
                      class="rounded-sm px-2 py-1 text-sm font-medium text-highlight hover:text-highlight/80 disabled:opacity-50"
                      @click="handlePublishTemplate(template)"
                    >
                      {{
                        isPublishingTemplate === template.id
                          ? $t('marketplace.publishing')
                          : $t('marketplace.publish')
                      }}
                    </button>
                    <button
                      v-if="isUnpublishable(statusGroup.status)"
                      :data-testid="`btn-unpublish-template-${template.id}`"
                      :disabled="isUnpublishingTemplate === template.id"
                      class="rounded-sm px-2 py-1 text-sm font-medium text-muted hover:text-muted/80 disabled:opacity-50"
                      @click="handleUnpublishTemplate(template)"
                    >
                      {{
                        isUnpublishingTemplate === template.id
                          ? $t('marketplace.unpublishing')
                          : $t('marketplace.unpublish')
                      }}
                    </button>
                    <button
                      v-if="isEditable(statusGroup.status)"
                      :data-testid="`btn-edit-template-${template.id}`"
                      class="rounded-sm px-2 py-1 text-sm font-medium text-highlight hover:text-highlight/80"
                      @click="handleEditTemplate(template)"
                    >
                      {{ $t('marketplace.edit') }}
                    </button>
                    <span class="text-sm text-muted">
                      {{ template.stats.downloads }}
                      {{ $t('marketplace.stats.downloads').toLowerCase() }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import type {
  MarketplaceTemplate,
  TemplateStatus
} from '@/platform/marketplace/apiTypes'
import { TEMPLATE_STATUSES } from '@/platform/marketplace/apiTypes'
import { useAuthorDashboard } from '@/platform/marketplace/composables/useAuthorDashboard'
import { usePublishDialog } from '@/platform/marketplace/composables/usePublishDialog'
import { OnCloseKey } from '@/types/widgetTypes'

const EDITABLE_STATUSES: TemplateStatus[] = [
  'draft',
  'pending_review',
  'rejected'
]

const props = defineProps<{
  onClose?: () => void
}>()

provide(OnCloseKey, props.onClose ?? (() => {}))

const {
  stats,
  isLoading,
  isPublishingTemplate,
  isUnpublishingTemplate,
  error,
  templatesByStatus,
  selectedPeriod,
  loadTemplates,
  loadStats,
  publishTemplate,
  unpublishTemplate
} = useAuthorDashboard()

function handleRefresh() {
  void loadTemplates()
  void loadStats(selectedPeriod.value)
}

const { show: showPublishDialog } = usePublishDialog()

const thumbErrors = ref<Record<string, boolean>>({})
const previewErrors = ref<Record<string, boolean>>({})

function isEditable(status: TemplateStatus): boolean {
  return EDITABLE_STATUSES.includes(status)
}

function isPublishable(status: TemplateStatus): boolean {
  return status === 'approved' || status === 'unpublished'
}

function isUnpublishable(status: TemplateStatus): boolean {
  return status === 'published'
}

function handleEditTemplate(template: MarketplaceTemplate) {
  showPublishDialog({
    initialTemplate: template,
    onClose: () => void loadTemplates()
  })
}

function handlePublishTemplate(template: MarketplaceTemplate) {
  void publishTemplate(template.id)
}

function handleUnpublishTemplate(template: MarketplaceTemplate) {
  void unpublishTemplate(template.id)
}

const statusGroups = computed(() =>
  TEMPLATE_STATUSES.map((status) => ({
    status,
    templates: templatesByStatus.value[status]
  }))
)

onMounted(() => {
  void loadTemplates()
  void loadStats('week')
})
</script>
