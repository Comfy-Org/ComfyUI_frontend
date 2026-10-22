<script setup lang="ts">
import { UserRound } from '@lucide/vue'
import { cn } from '@comfyorg/tailwind-utils'
import type { ProfileChoice } from '@/lib/cms/profile-client'
const { profile, truncateName = false } = defineProps<{
  profile: ProfileChoice
  truncateName?: boolean
}>()
</script>
<template>
  <img
    v-if="profile.avatar_url"
    :src="profile.avatar_url"
    alt=""
    referrerpolicy="no-referrer"
    class="size-8 shrink-0 rounded-full object-cover"
  />
  <UserRound v-else class="size-8 shrink-0" aria-hidden="true" />
  <span class="min-w-0">
    <span :class="cn('block text-admin-fg', truncateName && 'truncate')">{{
      profile.label
    }}</span>
    <span class="block truncate text-xs">{{ profile.username }}</span>
  </span>
</template>
