<script setup lang="ts">
import { Coins, ExternalLink, LogOut, Settings } from '@lucide/vue'
import { onClickOutside } from '@vueuse/core'
import { computed, ref, useTemplateRef } from 'vue'

import { useWorkshopCredits } from '../../config/workshop-credits'
import { externalLinks } from '../../config/routes'
import { platformTopUpHref } from '../../lib/workshop/buy-credits'
import { runBeforeSignInLeave } from '../../config/workshop-return'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAuthFlag } from '../../scripts/posthog'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const enabled = useWorkshopAuthFlag()
const { user, session, sessionFailure, ensureFresh, signOut } =
  useWorkshopSession()
const { balance } = useWorkshopCredits()

/**
 * The return destination is only known in the browser, and hydration does
 * not repair a server-rendered href, so the link renders as `/login/` and
 * gains its destination on pointer-down or focus, before any click or
 * keypress follows it. Modified clicks then keep their native
 * open-in-new-tab behaviour with the destination intact.
 */
const signInHref = ref('/login/')

function signInDestination(): string {
  return `/login/?returnTo=${encodeURIComponent(
    window.location.pathname + window.location.search
  )}`
}

function prepareSignInHref(): void {
  signInHref.value = signInDestination()
}

function goToSignIn(event: MouseEvent): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
    return
  event.preventDefault()
  runBeforeSignInLeave()
  window.location.assign(signInDestination())
}

const menuOpen = ref(false)
const menuRoot = useTemplateRef('menuRoot')
onClickOutside(menuRoot, () => {
  menuOpen.value = false
})

const initial = computed(() => {
  const name = user.value?.displayName ?? user.value?.email ?? ''
  return name.slice(0, 1).toUpperCase()
})

// The button carries the avatar and, when known, the balance; an aria-label
// would replace all of that with one word, so it names the account AND folds
// the balance in when there is one, matching what the chip shows.
const accountLabel = computed(() => {
  const account = t('auth.header.account', locale)
  const current = balance.value
  return current.status === 'ok'
    ? `${account}, ${formatCredits(current.credits)}`
    : account
})

function formatCredits(credits: number): string {
  const key = credits === 1 ? 'auth.header.credit' : 'auth.header.credits'
  return `${credits.toLocaleString(locale)} ${t(key, locale)}`
}

const sessionRetryPending = ref(false)
async function retrySession(): Promise<void> {
  if (sessionRetryPending.value) return
  sessionRetryPending.value = true
  try {
    await ensureFresh()
  } finally {
    sessionRetryPending.value = false
  }
}

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
      @pointerdown="prepareSignInHref"
      @focus="prepareSignInHref"
      @click="goToSignIn"
    >
      {{ t('auth.header.signIn', locale) }}
    </a>

    <button
      v-else-if="!session && sessionFailure"
      type="button"
      :aria-busy="sessionRetryPending"
      :disabled="sessionRetryPending"
      class="flex h-10 items-center gap-2 rounded-2xl border border-red-500/40 px-4 text-xs font-bold tracking-wider text-primary-comfy-canvas uppercase transition-colors hover:border-red-500/70"
      @click="retrySession"
    >
      {{
        t(
          sessionRetryPending
            ? 'auth.header.sessionRetrying'
            : 'auth.header.sessionRetry',
          locale
        )
      }}
    </button>

    <span
      v-else-if="!session"
      role="status"
      aria-busy="true"
      class="flex h-10 items-center rounded-2xl border border-primary-comfy-canvas/25 px-4 text-xs font-bold tracking-wider text-primary-comfy-canvas/70 uppercase"
    >
      {{ t('auth.header.signingIn', locale) }}
    </span>

    <div v-else ref="menuRoot" class="relative">
      <button
        type="button"
        class="hover:border-primary-comfy-yellow/60 flex h-10 items-center gap-2.5 rounded-2xl border border-primary-comfy-canvas/25 pr-3 pl-1.5 transition-colors"
        :aria-label="accountLabel"
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
          {{ formatCredits(balance.credits) }}
        </span>
      </button>

      <div
        v-if="menuOpen"
        role="menu"
        class="absolute right-0 z-50 mt-2 w-72 rounded-2xl border border-primary-comfy-canvas/15 bg-primary-comfy-ink p-2 shadow-lg"
      >
        <!-- The DES-1015 menu: workspace leads, actions follow, the person
             signs off in the footer. Plan and role wait on session data. -->
        <div class="flex items-center gap-3 px-3 py-2">
          <img
            v-if="user?.photoURL"
            :src="user.photoURL"
            alt=""
            referrerpolicy="no-referrer"
            class="size-9 rounded-xl"
          />
          <span
            v-else
            aria-hidden="true"
            class="bg-primary-comfy-yellow grid size-9 shrink-0 place-items-center rounded-xl text-sm font-bold text-primary-comfy-ink"
          >
            {{ initial }}
          </span>
          <span class="min-w-0">
            <span
              class="block truncate text-sm font-bold text-primary-warm-white"
              data-testid="account-workspace"
            >
              {{ session.workspace.name }}
            </span>
          </span>
        </div>
        <p
          v-if="balance.status === 'error'"
          class="px-3 pb-2 text-xs text-red-400"
        >
          {{ t('auth.header.balanceError', locale) }}
        </p>
        <div class="m-1 h-px bg-transparency-white-t8" aria-hidden="true" />
        <a
          :href="platformTopUpHref(session.workspace.id)"
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          data-testid="account-add-credits"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-primary-comfy-canvas transition-colors hover:bg-primary-comfy-canvas/10"
          @click="menuOpen = false"
        >
          <Coins class="size-5 text-primary-warm-gray" aria-hidden="true" />
          <span class="flex flex-1 items-center gap-3">
            {{ t('workshop.run.buyCredits', locale) }}
            <ExternalLink
              class="size-5 text-primary-warm-gray"
              aria-hidden="true"
            />
          </span>
          <span
            v-if="balance.status === 'ok'"
            class="text-sm font-bold text-primary-warm-white tabular-nums"
          >
            {{ formatCredits(balance.credits) }}
          </span>
        </a>
        <a
          :href="externalLinks.cloud"
          target="_blank"
          rel="noopener noreferrer"
          role="menuitem"
          data-testid="account-workspace-settings"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-primary-comfy-canvas transition-colors hover:bg-primary-comfy-canvas/10"
          @click="menuOpen = false"
        >
          <Settings class="size-5 text-primary-warm-gray" aria-hidden="true" />
          {{ t('nav.workspaceSettings', locale) }}
        </a>
        <div class="m-1 h-px bg-transparency-white-t8" aria-hidden="true" />
        <div role="none" class="flex items-center gap-3 px-3 py-1">
          <span
            class="min-w-0 flex-1 truncate text-xs text-primary-comfy-canvas/55"
          >
            {{ user?.email ?? user?.displayName }}
          </span>
          <button
            type="button"
            role="menuitem"
            :aria-label="t('auth.signIn.signOut', locale)"
            data-testid="account-sign-out"
            class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-primary-warm-gray transition-colors hover:bg-primary-comfy-canvas/10 hover:text-primary-warm-white"
            @click="signOutFromMenu"
          >
            <LogOut class="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
