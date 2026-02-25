<template>
  <BaseModalLayout :content-title="t('developerProfile.dialogTitle')" size="sm">
    <template #header>
      <input
        v-model="viewedUsername"
        type="text"
        :placeholder="t('developerProfile.lookupHandle')"
        class="h-8 w-48 rounded border border-border-default bg-secondary-background px-2 text-sm text-muted-foreground focus:outline-none"
        data-testid="handle-input"
      />
    </template>

    <template v-if="isCurrentUser" #header-right-area>
      <div class="mr-6">
        <Button size="lg" :disabled="isSaving" @click="saveProfile">
          {{
            isSaving ? t('developerProfile.saving') : t('developerProfile.save')
          }}
        </Button>
      </div>
    </template>

    <template #content>
      <div class="flex flex-col gap-6">
        <!-- Banner Image -->
        <div
          class="h-48 w-full overflow-hidden rounded-lg bg-secondary-background"
          data-testid="banner-section"
        >
          <img
            v-if="profile?.bannerUrl"
            :src="profile.bannerUrl"
            :alt="t('developerProfile.bannerPlaceholder')"
            class="size-full object-cover"
          />
          <div v-else class="flex size-full items-center justify-center">
            <i
              class="icon-[lucide--image] size-10 text-muted-foreground opacity-40"
            />
          </div>
        </div>

        <!-- Avatar + Username + Bio -->
        <div class="flex items-start gap-4" data-testid="identity-section">
          <div
            class="flex size-16 shrink-0 items-center justify-center rounded-full bg-modal-panel-background"
          >
            <i class="icon-[lucide--user] size-8 text-muted-foreground" />
          </div>
          <div class="flex min-w-0 flex-1 flex-col gap-2">
            <div class="flex items-center gap-2">
              <template v-if="isCurrentUser">
                <input
                  v-model="editableUsername"
                  type="text"
                  :placeholder="t('developerProfile.editUsername')"
                  class="h-8 rounded border border-border-default bg-secondary-background px-2 text-sm focus:outline-none"
                  data-testid="username-input"
                />
              </template>
              <template v-else>
                <span class="text-lg font-semibold" data-testid="username-text">
                  {{ profile?.displayName ?? viewedUsername }}
                </span>
              </template>
              <span
                v-if="profile?.isVerified"
                class="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400"
              >
                <i class="icon-[lucide--badge-check] size-3" />
                {{ t('developerProfile.verified') }}
              </span>
            </div>
            <template v-if="isCurrentUser">
              <textarea
                v-model="editableBio"
                :placeholder="t('developerProfile.editBio')"
                rows="2"
                class="resize-none rounded border border-border-default bg-secondary-background px-2 py-1 text-sm text-muted-foreground focus:outline-none"
                data-testid="bio-input"
              />
            </template>
            <template v-else>
              <p
                v-if="profile?.bio"
                class="m-0 text-sm text-muted-foreground"
                data-testid="bio-text"
              >
                {{ profile.bio }}
              </p>
            </template>
          </div>
        </div>

        <!-- Summary Stats -->
        <div class="grid grid-cols-5 gap-3" data-testid="summary-stats">
          <div
            v-for="stat in summaryStats"
            :key="stat.label"
            class="flex flex-col items-center rounded-lg bg-secondary-background p-3"
          >
            <span class="text-lg font-semibold">{{ stat.value }}</span>
            <span class="text-xs text-muted-foreground">{{ stat.label }}</span>
          </div>
        </div>

        <!-- Download History Chart -->
        <DownloadHistoryChart
          v-if="downloadHistory.length > 0"
          :entries="downloadHistory"
        />

        <!-- Quick Actions (current user only) -->
        <div
          v-if="isCurrentUser"
          class="rounded-lg border border-border-default p-4"
          data-testid="quick-actions"
        >
          <h3 class="m-0 mb-3 text-sm font-semibold">
            {{ t('developerProfile.quickActions') }}
          </h3>
          <div class="flex flex-wrap gap-2">
            <Button
              v-for="tpl in templates"
              :key="tpl.id"
              variant="destructive-textonly"
              size="sm"
              @click="handleUnpublish(tpl.id)"
            >
              {{ t('developerProfile.unpublish') }}: {{ tpl.title }}
            </Button>
          </div>
        </div>

        <!-- Reviews Section -->
        <div data-testid="reviews-section">
          <h3 class="m-0 mb-3 text-sm font-semibold">
            {{ t('developerProfile.reviews') }}
          </h3>
          <div
            v-if="reviews.length === 0"
            class="py-4 text-center text-sm text-muted-foreground"
          >
            {{ t('developerProfile.noReviews') }}
          </div>
          <div
            v-else
            class="flex max-h-80 flex-col gap-2 overflow-y-auto scrollbar-custom"
          >
            <ReviewCard
              v-for="review in reviews"
              :key="review.id"
              :review="review"
            />
          </div>
        </div>

        <!-- Published Templates Section -->
        <div data-testid="templates-section">
          <h3 class="m-0 mb-3 text-sm font-semibold">
            {{ t('developerProfile.publishedTemplates') }}
          </h3>
          <div
            v-if="templates.length === 0"
            class="py-4 text-center text-sm text-muted-foreground"
          >
            {{ t('developerProfile.noTemplates') }}
          </div>
          <div
            v-else
            class="flex max-h-96 flex-col gap-2 overflow-y-auto scrollbar-custom"
          >
            <TemplateListItem
              v-for="tpl in templates"
              :key="tpl.id"
              :template="tpl"
              :revenue="revenueByTemplateId[tpl.id]"
              :show-revenue="showRevenueColumn"
              :is-current-user="isCurrentUser"
              @unpublish="handleUnpublish"
            />
          </div>
        </div>
      </div>
    </template>
  </BaseModalLayout>
</template>

<script setup lang="ts">
import { computed, provide, ref } from 'vue'
import { watchDebounced } from '@vueuse/core'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import BaseModalLayout from '@/components/widget/layout/BaseModalLayout.vue'
import {
  fetchDeveloperProfile,
  fetchDeveloperReviews,
  fetchDownloadHistory,
  fetchPublishedTemplates,
  fetchTemplateRevenue,
  getCurrentUsername,
  saveDeveloperProfile,
  unpublishTemplate
} from '@/services/developerProfileService'
import type {
  DeveloperProfile,
  DownloadHistoryEntry,
  MarketplaceTemplate,
  TemplateReview,
  TemplateRevenue
} from '@/types/templateMarketplace'
import { OnCloseKey } from '@/types/widgetTypes'

import DownloadHistoryChart from './DownloadHistoryChart.vue'
import ReviewCard from './ReviewCard.vue'
import TemplateListItem from './TemplateListItem.vue'

const { onClose, username } = defineProps<{
  onClose: () => void
  username?: string
}>()

const { t } = useI18n()

provide(OnCloseKey, onClose)

const viewedUsername = ref(username ?? getCurrentUsername())
const isCurrentUser = computed(
  () => viewedUsername.value === getCurrentUsername()
)

const profile = ref<DeveloperProfile | null>(null)
const reviews = ref<TemplateReview[]>([])
const templates = ref<MarketplaceTemplate[]>([])
const revenue = ref<TemplateRevenue[]>([])
const downloadHistory = ref<DownloadHistoryEntry[]>([])
const isSaving = ref(false)

const editableUsername = ref('')
const editableBio = ref('')

const revenueByTemplateId = computed(() => {
  const map: Record<string, TemplateRevenue> = {}
  for (const entry of revenue.value) {
    map[entry.templateId] = entry
  }
  return map
})

const showRevenueColumn = computed(
  () => isCurrentUser.value && (profile.value?.monetizationEnabled ?? false)
)

const summaryStats = computed(() => [
  {
    label: t('developerProfile.dependencies'),
    value: (profile.value?.dependencies ?? 371).toLocaleString()
  },
  {
    label: t('developerProfile.totalDownloads'),
    value: (profile.value?.totalDownloads ?? 0).toLocaleString()
  },
  {
    label: t('developerProfile.totalFavorites'),
    value: (profile.value?.totalFavorites ?? 0).toLocaleString()
  },
  {
    label: t('developerProfile.averageRating'),
    value: (profile.value?.averageRating ?? 0).toFixed(1)
  },
  {
    label: t('developerProfile.templateCount'),
    value: String(profile.value?.templateCount ?? 0)
  }
])

watchDebounced(viewedUsername, () => void loadData(), { debounce: 500 })

async function loadData() {
  const handle = viewedUsername.value
  const [profileData, reviewsData, templatesData, historyData] =
    await Promise.all([
      fetchDeveloperProfile(handle),
      fetchDeveloperReviews(handle),
      fetchPublishedTemplates(handle),
      fetchDownloadHistory(handle)
    ])
  profile.value = profileData
  reviews.value = reviewsData
  templates.value = templatesData
  downloadHistory.value = historyData
  editableUsername.value = profileData.displayName
  editableBio.value = profileData.bio ?? ''

  if (isCurrentUser.value && profileData.monetizationEnabled) {
    revenue.value = await fetchTemplateRevenue(handle)
  } else {
    revenue.value = []
  }
}

async function saveProfile() {
  isSaving.value = true
  try {
    profile.value = await saveDeveloperProfile({
      ...profile.value,
      displayName: editableUsername.value,
      bio: editableBio.value
    })
  } finally {
    isSaving.value = false
  }
}

async function handleUnpublish(templateId: string) {
  await unpublishTemplate(templateId)
  templates.value = templates.value.filter((t) => t.id !== templateId)
}

void loadData()
</script>
