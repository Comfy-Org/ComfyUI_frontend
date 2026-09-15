<script setup lang="ts">
import { Coins, LogOut } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { initialsOf } from '../../lib/workshop/initials'
import type { WorkspaceWithRole } from '../../lib/workshop/workspaces'
import HeaderWorkspaceMenu from './HeaderWorkspaceMenu.vue'

const {
  session,
  workspaces,
  switching,
  workspaceSwitchError,
  formattedCredits,
  hasCredits,
  balanceError,
  canTopUp,
  accountLabel,
  accountName,
  accountPhotoUrl,
  accountIdentity,
  locale = 'en'
} = defineProps<{
  session: WorkshopSession
  workspaces: 'loading' | 'error' | readonly WorkspaceWithRole[]
  switching?: string
  workspaceSwitchError: boolean
  formattedCredits?: string
  hasCredits: boolean
  balanceError: boolean
  canTopUp: boolean
  accountLabel: string
  accountName: string
  accountPhotoUrl?: string | null
  accountIdentity?: string | null
  locale?: Locale
}>()

const emit = defineEmits<{
  retry: []
  switchWorkspace: [workspaceId: string]
  buyCredits: []
  signOut: []
}>()

const open = defineModel<boolean>('open', { required: true })
const workspacesOpen = defineModel<boolean>('workspacesOpen', {
  required: true
})

const accountInitials = computed(() => initialsOf(accountName))
const workspaceInitials = computed(() => initialsOf(session.workspace.name))

// The plan comes from the workspace list, which loads after the menu can be
// opened, so until it arrives the row says the reader's role instead.
const workspacePlan = computed(() => {
  const listed = Array.isArray(workspaces)
    ? workspaces.find((workspace) => workspace.id === session.workspace.id)
    : undefined
  if (listed?.subscription_tier)
    return listed.subscription_tier.split('_').join(' ')
  return t(
    session.role === 'member' ? 'nav.roleMember' : 'nav.roleOwner',
    locale
  )
})

const avatarFailed = ref(false)
watch(
  () => accountPhotoUrl,
  () => (avatarFailed.value = false)
)

const monogramClass =
  'grid shrink-0 place-items-center rounded-lg bg-transparency-white-t8 font-bold text-primary-warm-white'
const itemClass =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-primary-comfy-canvas outline-none hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4'
const surfaceClass =
  'border-primary-comfy-ink-light bg-site-dropdown z-50 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger
      data-testid="header-account"
      :aria-label="accountLabel"
      class="flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-transparency-white-t20 bg-transparency-white-t4 p-1 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    >
      <span
        :class="cn(monogramClass, 'size-8 text-xs')"
        data-testid="header-workspace-monogram"
        aria-hidden="true"
      >
        {{ workspaceInitials }}
      </span>

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

      <img
        v-if="accountPhotoUrl && !avatarFailed"
        :src="accountPhotoUrl"
        alt=""
        class="size-8 shrink-0 rounded-full object-cover"
        data-testid="header-account-avatar"
        referrerpolicy="no-referrer"
        @error="avatarFailed = true"
      />
      <span
        v-else
        class="grid size-8 shrink-0 place-items-center rounded-full bg-transparency-white-t8 text-xs font-bold text-primary-warm-white"
        aria-hidden="true"
      >
        {{ accountInitials }}
      </span>
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="10"
        :collision-padding="8"
        :class="
          cn(
            surfaceClass,
            'w-96 max-w-(--reka-dropdown-menu-content-available-width)'
          )
        "
        data-testid="header-account-menu"
      >
        <!-- The workspace the credits belong to sits above them, so the
          balance is never read as the reader's own. -->
        <div class="rounded-xl bg-transparency-white-t4 p-1">
          <div
            class="flex items-center gap-3 p-2"
            data-testid="account-workspace-current"
          >
            <span
              :class="cn(monogramClass, 'size-8 text-sm')"
              aria-hidden="true"
            >
              {{ workspaceInitials }}
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-sm font-medium text-primary-warm-white"
              >
                {{ session.workspace.name }}
              </span>
              <span
                class="block text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
              >
                {{ workspacePlan }}
              </span>
            </span>
            <HeaderWorkspaceMenu
              v-model:open="workspacesOpen"
              :session
              :workspaces
              :switching
              :locale
              @retry="emit('retry')"
              @switch-workspace="emit('switchWorkspace', $event)"
            />
          </div>

          <p
            v-if="workspaceSwitchError"
            class="px-3 pb-2 text-xs text-red-400"
            role="alert"
            data-testid="account-workspace-switch-error"
          >
            {{ t('nav.workspaceSwitchError', locale) }}
          </p>

          <p v-if="balanceError" class="px-3 pb-2 text-xs text-red-400">
            {{ t('auth.header.balanceError', locale) }}
          </p>

          <DropdownMenuItem
            v-if="canTopUp"
            :class="itemClass"
            data-testid="account-add-credits"
            @select="emit('buyCredits')"
          >
            <Coins class="size-5 text-primary-warm-gray" aria-hidden="true" />
            <span class="flex-1">
              {{ t('workshop.run.buyCredits', locale) }}
            </span>
          </DropdownMenuItem>
        </div>

        <div
          class="group/footer mt-1 flex items-center gap-3 rounded-xl px-3 py-2"
          data-testid="account-identity"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-primary-warm-white">
              {{ accountName }}
            </span>
            <span
              v-if="accountIdentity && accountIdentity !== accountName"
              class="block truncate text-xs text-primary-warm-gray"
              data-testid="account-email"
            >
              {{ accountIdentity }}
            </span>
          </span>
          <DropdownMenuItem as-child>
            <button
              type="button"
              :aria-label="t('nav.signOut', locale)"
              class="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-primary-warm-gray transition-colors outline-none group-hover/footer:bg-transparency-white-t8 group-hover/footer:text-primary-warm-white focus-visible:bg-transparency-white-t8 focus-visible:text-primary-warm-white"
              data-testid="account-sign-out"
              @click="emit('signOut')"
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
</template>
