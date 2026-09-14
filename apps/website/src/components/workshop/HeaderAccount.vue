<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import {
  refreshWorkshopCredits,
  useWorkshopCredits
} from '../../config/workshop-credits'
import { requestWorkshopBuyCredits } from '../../config/workshop-buy-credits'
import { leaveForSignIn } from '../../config/workshop-return'
import type { WorkspaceWithRole } from '../../lib/workshop/workspaces'
import { listWorkspaces } from '../../lib/workshop/workspaces'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAuthFlag } from '../../scripts/posthog'
import HeaderAccountMenu from './HeaderAccountMenu.vue'

const { locale = 'en' } = defineProps<{
  locale?: Locale
}>()

const enabled = useWorkshopAuthFlag()
const { user, session, sessionFailure, ensureFresh, remint, signOut } =
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

async function goToSignIn(event: MouseEvent): Promise<void> {
  await leaveForSignIn(event, signInDestination())
}

const menuOpen = ref(false)

// Mar's switcher from #16556, on real rails: the list is the account's own
// workspaces, the switch is a remint for the picked one, and the balance
// re-reads for the wallet that just came into scope.
const workspacesOpen = ref(false)
const workspaces = ref<'loading' | 'error' | readonly WorkspaceWithRole[]>(
  'loading'
)
const switching = ref<string | undefined>(undefined)
const workspaceSwitchError = ref(false)
const workspaceRefresh = ref(0)
let workspaceLoadGeneration = 0

type ActiveWorkshopSession = NonNullable<typeof session.value>

function sameSessionScope(
  candidate: typeof session.value,
  requested: ActiveWorkshopSession
): boolean {
  return (
    candidate?.uid === requested.uid &&
    candidate.workspace.id === requested.workspace.id
  )
}

function workspaceLoadIsOwned(
  generation: number,
  controller: AbortController,
  requested: ActiveWorkshopSession
): boolean {
  if (generation !== workspaceLoadGeneration) return false
  if (controller.signal.aborted) return false
  if (!workspacesOpen.value) return false
  return sameSessionScope(session.value, requested)
}

function workspaceLoadWasCancelled(
  generation: number,
  controller: AbortController
): boolean {
  return generation !== workspaceLoadGeneration || controller.signal.aborted
}

async function loadWorkspaceList(
  requested: ActiveWorkshopSession,
  generation: number,
  controller: AbortController
): Promise<void> {
  try {
    const fresh = await ensureFresh(undefined, {
      workspaceId: requested.workspace.id,
      signal: controller.signal,
      timeoutMs: 15_000
    })
    if (fresh?.status !== 'ok') throw new Error('Session refresh failed')
    if (!sameSessionScope(fresh.session, requested)) return
    const listed = await listWorkspaces(fresh.session.token, {
      signal: controller.signal
    })
    if (!workspaceLoadIsOwned(generation, controller, requested)) return
    workspaces.value = listed
  } catch {
    if (workspaceLoadWasCancelled(generation, controller)) return
    workspaces.value = 'error'
  }
}

watch(menuOpen, (open) => {
  if (!open) workspaceSwitchError.value = false
})

watch(
  [
    workspacesOpen,
    workspaceRefresh,
    () => session.value?.uid,
    () => session.value?.workspace.id
  ],
  async ([open], _, onCleanup) => {
    const generation = ++workspaceLoadGeneration
    if (!open) return
    const requested = session.value
    if (!requested) return
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    workspaces.value = 'loading'
    await loadWorkspaceList(requested, generation, controller)
  }
)

function retryWorkspaceList(): void {
  workspaceRefresh.value += 1
}

async function restorePreviousWorkspace(
  previous: ActiveWorkshopSession
): Promise<void> {
  workspaceSwitchError.value = true
  if (user.value?.uid !== previous.uid || session.value !== undefined) return
  try {
    await remint(undefined, {
      workspaceId: previous.workspace.id,
      preserveCredentialOnTransientFailure: true
    })
  } catch {
    // The visible error remains; a rejected recovery must not escape the menu.
  }
}

async function switchWorkspace(workspaceId: string) {
  if (switching.value) return
  const previous = session.value
  if (!previous) return
  const previousWorkspaceId = previous.workspace.id
  if (workspaceId === previousWorkspaceId) {
    menuOpen.value = false
    return
  }
  workspaceSwitchError.value = false
  switching.value = workspaceId
  try {
    const result = await remint(undefined, {
      workspaceId,
      preserveCredentialOnTransientFailure: true
    })
    if (result === undefined) {
      workspaceSwitchError.value = sameSessionScope(session.value, previous)
      return
    }
    if (result.status === 'ok') {
      await refreshWorkshopCredits({ force: true })
      menuOpen.value = false
    } else {
      await restorePreviousWorkspace(previous)
    }
  } catch {
    await restorePreviousWorkspace(previous)
  } finally {
    switching.value = undefined
  }
}

const hasCredits = computed(
  () => balance.value.status === 'ok' && balance.value.credits > 0
)
const formattedCredits = computed(() =>
  balance.value.status === 'ok'
    ? new Intl.NumberFormat(locale).format(balance.value.credits)
    : undefined
)
function formatCredits(credits: number): string {
  const key = credits === 1 ? 'auth.header.credit' : 'auth.header.credits'
  return `${credits.toLocaleString(locale)} ${t(key, locale)}`
}

// The chip shows the bare number; the label keeps the unit for a reader
// who cannot see which chip it is.
const accountLabel = computed(() => {
  const account = t('nav.accountMenu', locale)
  const current = balance.value
  return current.status === 'ok'
    ? `${account}, ${formatCredits(current.credits)}`
    : account
})

// Buying is owner-only server-side, so a member gets no purchase route here.
// See DES-1015.
const canTopUp = computed(() => session.value?.role !== 'member')

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

    <HeaderAccountMenu
      v-else
      v-model:open="menuOpen"
      v-model:workspaces-open="workspacesOpen"
      :session
      :workspaces
      :switching
      :workspace-switch-error="workspaceSwitchError"
      :formatted-credits="formattedCredits"
      :has-credits="hasCredits"
      :balance-error="balance.status === 'error'"
      :can-top-up="canTopUp"
      :account-label="accountLabel"
      :account-identity="user.email ?? user.displayName"
      :locale
      @retry="retryWorkspaceList"
      @switch-workspace="switchWorkspace"
      @buy-credits="requestWorkshopBuyCredits"
      @sign-out="signOutFromMenu"
    />
  </div>
</template>
