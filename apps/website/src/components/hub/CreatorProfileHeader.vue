<script setup lang="ts">
import {
  workshopEyebrowClass,
  workshopHeadingClass
} from '@/components/workshop/workshopHeadingClasses'
import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import type { HubCreator } from '@/lib/hub/creators'
import CreatorAvatar from './CreatorAvatar.vue'

const { creator, locale = 'en' } = defineProps<{
  creator: HubCreator
  locale?: Locale
}>()
const { t } = translationsFor(locale)

const hostname = (link: string) => new URL(link).hostname.replace(/^www\./, '')
</script>

<template>
  <header class="mt-6 flex flex-col gap-6 sm:flex-row sm:items-start">
    <CreatorAvatar
      :name="creator.displayName"
      :avatar-url="creator.avatarUrl"
      loading="eager"
      class="size-24 shrink-0 text-4xl"
    />
    <div class="min-w-0">
      <p :class="workshopEyebrowClass">
        {{ t('workshop.hub.creators.eyebrow') }}
      </p>
      <h1 :class="workshopHeadingClass">{{ creator.displayName }}</h1>
      <p class="mt-2 text-content-secondary">@{{ creator.username }}</p>
      <p
        v-if="creator.description"
        class="mt-4 max-w-3xl text-sm whitespace-pre-line text-content-secondary"
      >
        {{ creator.description }}
      </p>
      <ul
        v-if="creator.websiteUrls.length > 0"
        class="mt-4 flex flex-wrap gap-x-6 gap-y-2"
      >
        <li v-for="link in creator.websiteUrls" :key="link">
          <a
            :href="link"
            target="_blank"
            rel="noopener noreferrer nofollow ugc"
            class="text-sm text-brand hover:underline"
          >
            {{ hostname(link) }} ↗
          </a>
        </li>
      </ul>
    </div>
  </header>
</template>
