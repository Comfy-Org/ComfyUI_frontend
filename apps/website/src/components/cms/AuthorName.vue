<script setup lang="ts">
import { UserRound } from '@lucide/vue'
import { ref, watch } from 'vue'

import type { Locale } from '@/i18n/translations'
import { translationsFor } from '@/i18n/translations'
import { resolveAuthorProfile } from '@/lib/cms/author-profiles'
import type { ProfileChoice } from '@/lib/cms/profile-client'

/**
 * A canonical account ID shown as its public profile: display name and
 * avatar. Never the ID itself — an account without a public profile reads
 * as unavailable.
 */
const { uid, locale = 'en' } = defineProps<{ uid: string; locale?: Locale }>()
const { t } = translationsFor(locale)

const profile = ref<ProfileChoice>()
const settled = ref(false)
watch(
  () => uid,
  async (account, _, cleanup) => {
    let current = true
    cleanup(() => (current = false))
    profile.value = undefined
    settled.value = false
    const found = await resolveAuthorProfile(account)
    if (!current) return
    profile.value = found
    settled.value = true
  },
  { immediate: true }
)
</script>

<template>
  <span class="flex min-w-0 items-center gap-1.5" data-testid="author-name">
    <img
      v-if="profile?.avatar_url"
      :src="profile.avatar_url"
      alt=""
      class="size-5 shrink-0 rounded-full object-cover"
      referrerpolicy="no-referrer"
      data-testid="author-avatar"
    />
    <UserRound
      v-else
      class="size-4 shrink-0 text-admin-muted"
      aria-hidden="true"
    />
    <span v-if="profile" class="truncate">{{ profile.label }}</span>
    <span v-else-if="settled" class="truncate text-admin-muted">{{
      t('cccWorkflow.authorUnavailable')
    }}</span>
    <span v-else class="sr-only">{{ t('cmsAdmin.draft.authorLoading') }}</span>
  </span>
</template>
