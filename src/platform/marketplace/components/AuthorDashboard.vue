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

          <div class="grid grid-cols-3 gap-6">
            <div class="flex flex-col gap-4">
              <h4 class="mb-2 text-sm font-semibold">
                {{ $t('marketplace.myDrafts') }}
              </h4>
              <div class="flex flex-col gap-2">
                <template v-if="draftStatusGroup.templates.length > 0">
                  <h5 class="mb-1 text-xs font-semibold text-muted">
                    {{ $t('marketplace.status.draft') }}
                    ({{ draftStatusGroup.templates.length }})
                  </h5>
                  <AuthorTemplateCard
                    v-for="template in draftStatusGroup.templates"
                    :key="template.id"
                    :template="template"
                    :status="draftStatusGroup.status"
                    :thumb-errors="thumbErrors"
                    :preview-errors="previewErrors"
                    :is-publishing-template="isPublishingTemplate"
                    :is-unpublishing-template="isUnpublishingTemplate"
                    @edit="handleEditTemplate"
                    @view="handleViewTemplate"
                    @publish="handlePublishTemplate"
                    @unpublish="handleUnpublishTemplate"
                    @thumb-error="(id) => (thumbErrors[id] = true)"
                    @preview-error="(id) => (previewErrors[id] = true)"
                  />
                </template>
                <p v-else class="text-sm text-muted">
                  {{ $t('marketplace.noDrafts') }}
                </p>
              </div>
            </div>
            <div class="flex flex-col gap-4">
              <h4 class="mb-2 text-sm font-semibold">
                {{ $t('marketplace.submissionsInReview') }}
              </h4>
              <div class="flex flex-col gap-2">
                <template
                  v-for="statusGroup in reviewStatusGroups"
                  :key="statusGroup.status"
                >
                  <template v-if="statusGroup.templates.length > 0">
                    <h5 class="mb-1 text-xs font-semibold text-muted">
                      {{ $t(`marketplace.status.${statusGroup.status}`) }}
                      ({{ statusGroup.templates.length }})
                    </h5>
                    <AuthorTemplateCard
                      v-for="template in statusGroup.templates"
                      :key="template.id"
                      :template="template"
                      :status="statusGroup.status"
                      :thumb-errors="thumbErrors"
                      :preview-errors="previewErrors"
                      :is-publishing-template="isPublishingTemplate"
                      :is-unpublishing-template="isUnpublishingTemplate"
                      @edit="handleEditTemplate"
                      @view="handleViewTemplate"
                      @publish="handlePublishTemplate"
                      @unpublish="handleUnpublishTemplate"
                      @thumb-error="(id) => (thumbErrors[id] = true)"
                      @preview-error="(id) => (previewErrors[id] = true)"
                    />
                  </template>
                </template>
                <p v-if="!hasReviewTemplates" class="text-sm text-muted">
                  {{ $t('marketplace.noSubmissionsInReview') }}
                </p>
              </div>
            </div>
            <div class="flex flex-col gap-4">
              <h4 class="mb-2 text-sm font-semibold">
                {{ $t('marketplace.submissionsLive') }}
              </h4>
              <div class="flex flex-col gap-2">
                <template
                  v-for="statusGroup in liveStatusGroups"
                  :key="statusGroup.status"
                >
                  <template v-if="statusGroup.templates.length > 0">
                    <h5 class="mb-1 text-xs font-semibold text-muted">
                      {{ $t(`marketplace.status.${statusGroup.status}`) }}
                      ({{ statusGroup.templates.length }})
                    </h5>
                    <AuthorTemplateCard
                      v-for="template in statusGroup.templates"
                      :key="template.id"
                      :template="template"
                      :status="statusGroup.status"
                      :thumb-errors="thumbErrors"
                      :preview-errors="previewErrors"
                      :is-publishing-template="isPublishingTemplate"
                      :is-unpublishing-template="isUnpublishingTemplate"
                      @edit="handleEditTemplate"
                      @view="handleViewTemplate"
                      @publish="handlePublishTemplate"
                      @unpublish="handleUnpublishTemplate"
                      @thumb-error="(id) => (thumbErrors[id] = true)"
                      @preview-error="(id) => (previewErrors[id] = true)"
                    />
                  </template>
                </template>
                <p v-if="!hasLiveTemplates" class="text-sm text-muted">
                  {{ $t('marketplace.noSubmissionsLive') }}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, provide, ref } from 'vue'

import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import AuthorTemplateCard from '@/platform/marketplace/components/AuthorTemplateCard.vue'
import type {
  MarketplaceTemplate,
  TemplateStatus
} from '@/platform/marketplace/apiTypes'
import { useAuthorDashboard } from '@/platform/marketplace/composables/useAuthorDashboard'
import { usePublishDialog } from '@/platform/marketplace/composables/usePublishDialog'
import { OnCloseKey } from '@/types/widgetTypes'

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

function handleEditTemplate(template: MarketplaceTemplate) {
  showPublishDialog({
    initialTemplate: template,
    onClose: () => void loadTemplates()
  })
}

function handleViewTemplate(template: MarketplaceTemplate) {
  showPublishDialog({
    initialTemplate: template,
    readOnly: true
  })
}

function handlePublishTemplate(template: MarketplaceTemplate) {
  void publishTemplate(template.id)
}

function handleUnpublishTemplate(template: MarketplaceTemplate) {
  void unpublishTemplate(template.id)
}

const draftStatusGroup = computed(() => ({
  status: 'draft' as TemplateStatus,
  templates: templatesByStatus.value.draft
}))

const REVIEW_STATUSES: TemplateStatus[] = [
  'pending_review',
  'approved',
  'rejected'
]
const LIVE_STATUSES: TemplateStatus[] = ['published', 'unpublished']

const reviewStatusGroups = computed(() =>
  REVIEW_STATUSES.map((status) => ({
    status,
    templates: templatesByStatus.value[status]
  }))
)
const liveStatusGroups = computed(() =>
  LIVE_STATUSES.map((status) => ({
    status,
    templates: templatesByStatus.value[status]
  }))
)

const hasReviewTemplates = computed(() =>
  reviewStatusGroups.value.some((g) => g.templates.length > 0)
)
const hasLiveTemplates = computed(() =>
  liveStatusGroups.value.some((g) => g.templates.length > 0)
)

onMounted(() => {
  void loadTemplates()
  void loadStats('week')
})
</script>
