<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { Coins, LogOut } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed, ref, watch } from 'vue'

import type { WorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { initialsOf, workspaceInitialsOf } from '../../lib/workshop/initials'
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
const workspaceInitials = computed(() =>
  workspaceInitialsOf(session.workspace.name)
)

// The plan would cost a workspace list the menu does not otherwise need, and
// would arrive late enough to swap under the name. The standing the session
// already carries says enough here, and the plan is one click away in the
// switcher, where the list is loaded anyway.
const workspaceRole = computed(() =>
  t(session.role === 'member' ? 'nav.roleMember' : 'nav.roleOwner', locale)
)

const avatarFailed = ref(false)
watch(
  () => accountPhotoUrl,
  () => (avatarFailed.value = false)
)

const monogramClass =
  'grid size-8 shrink-0 place-items-center rounded-md bg-transparency-white-t8 text-sm font-bold text-primary-warm-white'
const surfaceClass =
  'border-primary-comfy-ink-light bg-page z-50 w-[300px] overflow-hidden rounded-xl border shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
    <DropdownMenuTrigger
      data-testid="header-account"
      :aria-label="accountLabel"
      class="flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-transparency-white-t20 bg-transparency-white-t4 p-1 outline-none focus-visible:ring-3 focus-visible:ring-primary-comfy-yellow/50"
    >
      <span
        v-if="formattedCredits !== undefined"
        data-testid="header-credits"
        :class="
          cn(
            'flex h-8 items-center gap-1.5 px-2 text-sm font-bold whitespace-nowrap tabular-nums',
            hasCredits ? 'text-primary-warm-white' : 'text-primary-comfy-red'
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
            'max-w-(--reka-dropdown-menu-content-available-width)'
          )
        "
        data-testid="header-account-menu"
      >
        <!-- The workspace the credits belong to sits above them, so the
          balance is never read as the reader's own. -->
        <div class="bg-site-dropdown pb-3">
          <div
            class="flex items-center gap-3 p-4"
            data-testid="account-workspace-current"
          >
            <!-- The mark is the workspace's own colour here, where it stands
              for the workspace; in the header it is one of three things in a
              pill and stays quiet. -->
            <span
              :class="cn(monogramClass, 'bg-workspace-mark')"
              aria-hidden="true"
            >
              {{ workspaceInitials }}
            </span>
            <span class="flex min-w-0 flex-1 flex-col gap-1">
              <span
                class="truncate text-sm font-medium text-primary-warm-white"
              >
                {{ session.workspace.name }}
              </span>
              <span
                class="text-[0.625rem] font-medium text-primary-warm-gray uppercase"
              >
                {{ workspaceRole }}
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
            class="px-4 pb-3 text-xs text-red-400"
            role="alert"
            data-testid="account-workspace-switch-error"
          >
            {{ t('nav.workspaceSwitchError', locale) }}
          </p>

          <p v-if="balanceError" class="px-4 pb-3 text-xs text-red-400">
            {{ t('auth.header.balanceError', locale) }}
          </p>

          <DropdownMenuItem
            v-if="canTopUp"
            class="flex h-10 w-full cursor-pointer items-center gap-2 px-4 text-sm text-primary-warm-white outline-none hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4"
            data-testid="account-add-credits"
            @select="emit('buyCredits')"
          >
            <Coins class="size-4 text-primary-warm-gray" aria-hidden="true" />
            <span class="flex-1 text-left">
              {{ t('workshop.run.buyCredits', locale) }}
            </span>
          </DropdownMenuItem>
        </div>

        <div
          class="group/footer flex items-center gap-3 bg-transparency-white-t4 px-4 py-2"
          data-testid="account-identity"
        >
          <span
            class="min-w-0 flex-1 truncate text-sm text-primary-warm-gray"
            data-testid="account-email"
          >
            {{ accountIdentity ?? accountName }}
          </span>
          <DropdownMenuItem as-child>
            <button
              type="button"
              :aria-label="t('nav.signOut', locale)"
              class="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-md px-2 text-sm text-primary-warm-gray transition-colors outline-none hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:bg-transparency-white-t8 focus-visible:text-primary-warm-white"
              data-testid="account-sign-out"
              @click="emit('signOut')"
            >
              <span
                class="hidden group-focus-within/footer:inline group-hover/footer:inline"
              >
                {{ t('nav.signOut', locale) }}
              </span>
              <LogOut class="size-4" aria-hidden="true" />
            </button>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
