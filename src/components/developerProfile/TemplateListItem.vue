<template>
  <div
    class="flex items-center gap-4 rounded-lg bg-secondary-background p-3"
    data-testid="template-list-item"
  >
    <div
      class="size-12 shrink-0 overflow-hidden rounded bg-modal-panel-background"
    >
      <img
        v-if="template.thumbnail"
        :src="template.thumbnail"
        :alt="template.title"
        class="size-full object-cover"
      />
      <div v-else class="flex size-full items-center justify-center">
        <i class="icon-[lucide--image] size-5 text-muted-foreground" />
      </div>
    </div>

    <div class="min-w-0 flex-1">
      <h4 class="m-0 truncate text-sm font-medium">{{ template.title }}</h4>
      <p class="m-0 truncate text-xs text-muted-foreground">
        {{ template.shortDescription }}
      </p>
    </div>

    <div class="flex shrink-0 items-center gap-4 text-xs text-muted-foreground">
      <span
        class="flex items-center gap-1"
        :title="t('developerProfile.downloads')"
      >
        <i class="icon-[lucide--download] size-3.5" />
        {{ template.stats.downloads.toLocaleString() }}
      </span>
      <span
        class="flex items-center gap-1"
        :title="t('developerProfile.favorites')"
      >
        <i class="icon-[lucide--heart] size-3.5" />
        {{ template.stats.favorites.toLocaleString() }}
      </span>
      <StarRating :rating="template.stats.rating" size="sm" />
    </div>

    <div
      v-if="showRevenue && revenue"
      class="shrink-0 text-right text-xs"
      data-testid="revenue-column"
    >
      <div class="font-medium">{{ formatCurrency(revenue.totalRevenue) }}</div>
      <div class="text-muted-foreground">
        {{ formatCurrency(revenue.monthlyRevenue) }}/{{
          t('developerProfile.monthlyRevenue').toLowerCase()
        }}
      </div>
    </div>

    <Button
      v-if="isCurrentUser"
      variant="destructive-textonly"
      size="sm"
      data-testid="unpublish-button"
      @click="emit('unpublish', template.id)"
    >
      {{ t('developerProfile.unpublish') }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'
import type {
  MarketplaceTemplate,
  TemplateRevenue
} from '@/types/templateMarketplace'

import StarRating from './StarRating.vue'

const {
  template,
  revenue,
  showRevenue = false,
  isCurrentUser = false
} = defineProps<{
  /** The template to display. */
  template: MarketplaceTemplate
  /** Revenue data for this template, shown when showRevenue is true. */
  revenue?: TemplateRevenue
  /** Whether to display the revenue column. */
  showRevenue?: boolean
  /** Whether the profile being viewed belongs to the current user. */
  isCurrentUser?: boolean
}>()

const emit = defineEmits<{
  /** Emitted when the unpublish button is clicked. */
  unpublish: [templateId: string]
}>()

const { t } = useI18n()

/**
 * Formats a value in cents as a currency string.
 * @param cents - Amount in cents.
 */
function formatCurrency(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD'
  })
}
</script>
