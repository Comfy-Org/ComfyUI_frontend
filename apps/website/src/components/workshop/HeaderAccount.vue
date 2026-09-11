<script setup lang="ts">
import {
  ArrowLeftRight,
  Check,
  Coins,
  ExternalLink,
  LogOut,
  Settings
} from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import {
  refreshWorkshopCredits,
  useWorkshopCredits
} from '../../config/workshop-credits'
import { externalLinks } from '../../config/routes'
import { platformTopUpHref } from '../../lib/workshop/buy-credits'
import type { WorkspaceWithRole } from '../../lib/workshop/workspaces'
import { listWorkspaces } from '../../lib/workshop/workspaces'
import { runBeforeSignInLeave } from '../../config/workshop-return'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { useWorkshopAuthFlag } from '../../scripts/posthog'

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

function goToSignIn(event: MouseEvent): void {
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
    return
  event.preventDefault()
  runBeforeSignInLeave()
  window.location.assign(signInDestination())
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

watch(workspacesOpen, async (open) => {
  if (!open || !session.value) return
  workspaces.value = 'loading'
  try {
    workspaces.value = await listWorkspaces(session.value.token)
  } catch {
    workspaces.value = 'error'
  }
})

async function switchWorkspace(workspaceId: string) {
  if (switching.value) return
  if (workspaceId === session.value?.workspace.id) {
    menuOpen.value = false
    return
  }
  switching.value = workspaceId
  try {
    const result = await remint(undefined, { workspaceId })
    if (result?.status === 'ok') {
      await refreshWorkshopCredits({ force: true })
      menuOpen.value = false
    } else {
      workspaces.value = 'error'
    }
  } finally {
    switching.value = undefined
  }
}

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const workspaceInitials = computed(() =>
  initialsOf(session.value?.workspace.name ?? '')
)
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

const roleLabel = computed(() =>
  t(
    session.value?.role === 'member' ? 'nav.roleMember' : 'nav.roleOwner',
    locale
  )
)
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

const itemClass =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-primary-comfy-canvas outline-none hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4'
const avatarClass =
  'grid size-12 shrink-0 place-items-center text-base font-bold text-primary-warm-white'
const surfaceClass =
  'border-primary-comfy-ink-light bg-site-dropdown z-50 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'
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

    <DropdownMenuRoot v-else v-model:open="menuOpen">
      <DropdownMenuTrigger
        data-testid="header-account"
        :aria-label="accountLabel"
        class="bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-transparency-white-t20 p-1 outline-none focus-visible:ring-3"
      >
        <span
          v-if="formattedCredits !== undefined"
          data-testid="header-credits"
          :class="
            cn(
              'flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold whitespace-nowrap tabular-nums',
              hasCredits
                ? 'bg-primary-comfy-yellow/10 text-primary-comfy-yellow'
                : 'bg-primary-comfy-red/10 text-primary-comfy-red'
            )
          "
        >
          <Coins class="size-4" aria-hidden="true" />
          {{ formattedCredits }}
        </span>

        <span
          class="grid size-8 shrink-0 place-items-center rounded-full bg-transparency-white-t8 text-xs font-bold text-primary-warm-white"
          aria-hidden="true"
        >
          {{ workspaceInitials }}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          :side-offset="10"
          :class="cn(surfaceClass, 'w-96')"
        >
          <DropdownMenuSub v-model:open="workspacesOpen">
            <DropdownMenuSubTrigger
              data-testid="account-workspace"
              class="hover:bg-transparency-white-t4 data-[state=open]:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4 flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left outline-none"
            >
              <span
                :class="cn(avatarClass, 'rounded-xl bg-transparency-white-t8')"
                aria-hidden="true"
              >
                {{ workspaceInitials }}
              </span>
              <span class="min-w-0 flex-1">
                <span
                  class="block truncate text-base font-bold text-primary-warm-white"
                >
                  {{ session.workspace.name }}
                </span>
                <span
                  class="block truncate text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
                >
                  {{ roleLabel }}
                </span>
              </span>
              <span
                class="grid size-8 shrink-0 place-items-center rounded-lg text-primary-warm-gray"
                aria-hidden="true"
              >
                <ArrowLeftRight class="size-4" />
              </span>
            </DropdownMenuSubTrigger>
            <DropdownMenuPortal>
              <DropdownMenuSubContent
                side="left"
                align="start"
                :side-offset="12"
                :class="cn(surfaceClass, 'w-72')"
                data-testid="account-workspaces"
              >
                <p
                  class="px-3 pt-1 pb-2 text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
                >
                  {{ t('nav.workspaces', locale) }}
                </p>
                <p
                  v-if="workspaces === 'loading'"
                  class="px-3 py-2 text-xs text-primary-comfy-canvas/55"
                >
                  {{ t('nav.workspacesLoading', locale) }}
                </p>
                <p
                  v-else-if="workspaces === 'error'"
                  class="px-3 py-2 text-xs text-red-400"
                >
                  {{ t('nav.workspacesError', locale) }}
                </p>
                <template v-else>
                  <DropdownMenuItem
                    v-for="workspace in workspaces"
                    :key="workspace.id"
                    :class="itemClass"
                    :disabled="switching !== undefined"
                    :data-testid="`account-workspace-${workspace.id}`"
                    @select.prevent="switchWorkspace(workspace.id)"
                  >
                    <span
                      class="grid size-9 shrink-0 place-items-center rounded-lg bg-transparency-white-t8 text-sm font-bold text-primary-warm-white"
                      aria-hidden="true"
                    >
                      {{ initialsOf(workspace.name) }}
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate">{{ workspace.name }}</span>
                      <span
                        class="block text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
                      >
                        {{
                          (workspace.subscription_tier ?? workspace.role)
                            .split('_')
                            .join(' ')
                        }}
                      </span>
                    </span>
                    <Check
                      v-if="workspace.id === session.workspace.id"
                      class="text-primary-comfy-yellow size-4 shrink-0"
                      aria-hidden="true"
                    />
                  </DropdownMenuItem>
                </template>
              </DropdownMenuSubContent>
            </DropdownMenuPortal>
          </DropdownMenuSub>

          <p
            v-if="balance.status === 'error'"
            class="px-3 pb-2 text-xs text-red-400"
          >
            {{ t('auth.header.balanceError', locale) }}
          </p>

          <DropdownMenuItem v-if="canTopUp" as-child>
            <a
              :href="platformTopUpHref(session.workspace.id)"
              target="_blank"
              rel="noopener noreferrer"
              :class="itemClass"
              data-testid="account-add-credits"
            >
              <Coins class="size-5 text-primary-warm-gray" aria-hidden="true" />
              <span class="flex flex-1 items-center gap-3">
                {{ t('workshop.run.buyCredits', locale) }}
                <ExternalLink
                  class="size-5 text-primary-warm-gray"
                  aria-hidden="true"
                />
              </span>
            </a>
          </DropdownMenuItem>

          <DropdownMenuItem as-child>
            <a
              :href="externalLinks.cloud"
              target="_blank"
              rel="noopener noreferrer"
              :class="itemClass"
              data-testid="account-workspace-settings"
            >
              <Settings
                class="size-5 text-primary-warm-gray"
                aria-hidden="true"
              />
              <span class="flex flex-1 items-center gap-3">
                {{ t('nav.workspaceSettings', locale) }}
                <ExternalLink
                  class="size-5 text-primary-warm-gray"
                  aria-hidden="true"
                />
              </span>
            </a>
          </DropdownMenuItem>

          <DropdownMenuSeparator
            class="-mx-2 mt-2 h-px bg-transparency-white-t8"
          />

          <div class="group/footer flex items-center gap-3 px-3 pt-3">
            <span
              class="min-w-0 flex-1 truncate text-sm text-primary-warm-gray"
              data-testid="account-email"
            >
              {{ user?.email ?? user?.displayName }}
            </span>
            <DropdownMenuItem as-child>
              <button
                type="button"
                :aria-label="t('nav.signOut', locale)"
                class="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-primary-warm-gray transition-colors outline-none group-hover/footer:bg-transparency-white-t8 group-hover/footer:text-primary-warm-white focus-visible:bg-transparency-white-t8 focus-visible:text-primary-warm-white"
                data-testid="account-sign-out"
                @click="signOutFromMenu"
              >
                <span class="hidden group-hover/footer:inline">
                  {{ t('nav.signOut', locale) }}
                </span>
                <LogOut class="size-5" aria-hidden="true" />
              </button>
            </DropdownMenuItem>
          </div>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>
