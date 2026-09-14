<script setup lang="ts">
import { ArrowLeftRight, Check, Coins, LogOut } from '@lucide/vue'
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
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import type { WorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import type { WorkspaceWithRole } from '../../lib/workshop/workspaces'

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

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

function workspaceTier(workspace: WorkspaceWithRole): string {
  if (workspace.subscription_tier)
    return workspace.subscription_tier.split('_').join(' ')
  return t(
    workspace.role === 'member' ? 'nav.roleMember' : 'nav.roleOwner',
    locale
  )
}

const workspaceInitials = computed(() => initialsOf(session.workspace.name))
const roleLabel = computed(() =>
  t(session.role === 'member' ? 'nav.roleMember' : 'nav.roleOwner', locale)
)

const itemClass =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-primary-comfy-canvas outline-none hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4'
const avatarClass =
  'grid size-12 shrink-0 place-items-center text-base font-bold text-primary-warm-white'
const surfaceClass =
  'border-primary-comfy-ink-light bg-site-dropdown z-50 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'
</script>

<template>
  <DropdownMenuRoot v-model:open="open">
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
        :collision-padding="8"
        :class="
          cn(
            surfaceClass,
            'w-96 max-w-(--reka-dropdown-menu-content-available-width)'
          )
        "
        data-testid="header-account-menu"
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
              <DropdownMenuItem
                v-else-if="workspaces === 'error'"
                :class="cn(itemClass, 'justify-between text-xs text-red-400')"
                data-testid="account-workspaces-retry"
                @select.prevent="emit('retry')"
              >
                <span>{{ t('nav.workspacesError', locale) }}</span>
                <span
                  class="text-primary-comfy-yellow shrink-0 cursor-pointer font-bold"
                >
                  {{ t('workshop.error.retry', locale) }}
                </span>
              </DropdownMenuItem>
              <p
                v-else-if="workspaces.length === 0"
                class="px-3 py-2 text-xs text-primary-comfy-canvas/55"
                data-testid="account-workspaces-empty"
              >
                {{ t('nav.workspacesEmpty', locale) }}
              </p>
              <template v-else>
                <DropdownMenuItem
                  v-for="workspace in workspaces"
                  :key="workspace.id"
                  :class="itemClass"
                  :disabled="switching !== undefined"
                  :data-testid="`account-workspace-${workspace.id}`"
                  @select.prevent="emit('switchWorkspace', workspace.id)"
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
                      {{ workspaceTier(workspace) }}
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
          v-if="workspaceSwitchError"
          class="px-3 py-2 text-xs text-red-400"
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
          <span class="flex-1">{{ t('workshop.run.buyCredits', locale) }}</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator
          class="-mx-2 mt-2 h-px bg-transparency-white-t8"
        />

        <div class="group/footer flex items-center gap-3 px-3 pt-3">
          <span
            class="min-w-0 flex-1 truncate text-sm text-primary-warm-gray"
            data-testid="account-email"
          >
            {{ accountIdentity }}
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
