<script setup lang="ts">
import { onClickOutside } from '@vueuse/core'
import { computed, onMounted, ref, useTemplateRef } from 'vue'

import { useWorkshopCredits } from '../../config/workshop-credits'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAuthFlag } from '../../scripts/posthog'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const enabled = useWorkshopAuthFlag()
const { user, session, ensureFresh, signOut } = useWorkshopSession()
const { balance } = useWorkshopCredits()

const signInHref = ref('/login/')
onMounted(() => {
  signInHref.value = `/login/?returnTo=${encodeURIComponent(
    window.location.pathname + window.location.search
  )}`
})

const menuOpen = ref(false)
const menuRoot = useTemplateRef('menuRoot')
onClickOutside(menuRoot, () => {
  menuOpen.value = false
})

const initial = computed(() => {
  const name = user.value?.displayName ?? user.value?.email ?? ''
  return name.slice(0, 1).toUpperCase()
})

async function signOutFromMenu() {
  menuOpen.value = false
  await signOut()
}
</script>

<template>
  <div v-if="enabled" class="shrink-0">
    <a
      v-if="!user"
      :href="signInHref"
      class="hover:border-primary-comfy-yellow/60 flex h-10 items-center rounded-2xl border border-primary-comfy-canvas/25 px-4 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase transition-colors"
    >
      {{ t('auth.header.signIn', locale) }}
    </a>

    <button
      v-else-if="!session"
      type="button"
      class="flex h-10 items-center gap-2 rounded-2xl border border-red-500/40 px-4 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase transition-colors hover:border-red-500/70"
      @click="ensureFresh"
    >
      {{ t('auth.header.sessionRetry', locale) }}
    </button>

    <div v-else ref="menuRoot" class="relative">
      <button
        type="button"
        class="hover:border-primary-comfy-yellow/60 flex h-10 items-center gap-2.5 rounded-2xl border border-primary-comfy-canvas/25 pr-3 pl-1.5 transition-colors"
        :aria-label="t('auth.header.account', locale)"
        :aria-expanded="menuOpen"
        aria-haspopup="menu"
        @click="menuOpen = !menuOpen"
      >
        <img
          v-if="user?.photoURL"
          :src="user.photoURL"
          alt=""
          referrerpolicy="no-referrer"
          class="size-7 rounded-full"
        />
        <span
          v-else
          aria-hidden="true"
          class="bg-primary-comfy-yellow flex size-7 items-center justify-center rounded-full text-xs font-bold text-primary-comfy-ink"
        >
          {{ initial }}
        </span>
        <span
          v-if="balance.status === 'ok'"
          class="text-xs font-bold text-primary-comfy-canvas tabular-nums"
        >
          {{ balance.credits.toLocaleString() }}
          {{ t('auth.header.credits', locale) }}
        </span>
      </button>

      <div
        v-if="menuOpen"
        role="menu"
        class="absolute right-0 z-50 mt-2 w-56 rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-ink p-2 shadow-lg"
      >
        <p class="px-3 py-2 text-xs break-all text-primary-comfy-canvas/55">
          {{ user?.email ?? user?.displayName }}
        </p>
        <p class="px-3 pb-2 text-xs text-primary-comfy-canvas/55">
          {{ session.workspace.name }}
        </p>
        <p
          v-if="balance.status === 'error'"
          class="px-3 pb-2 text-xs text-red-400"
        >
          {{ t('auth.header.balanceError', locale) }}
        </p>
        <button
          type="button"
          role="menuitem"
          class="w-full rounded-xl px-3 py-2 text-left text-sm text-primary-comfy-canvas transition-colors hover:bg-primary-comfy-canvas/10"
          @click="signOutFromMenu"
        >
          {{ t('auth.signIn.signOut', locale) }}
        </button>
      </div>
    </div>
  </div>
</template>
