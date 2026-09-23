<script setup lang="ts">
import { cn } from '@comfyorg/tailwind-utils'
import { ArrowLeftRight, Check } from '@lucide/vue'
import { useEventListener } from '@vueuse/core'
import {
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger
} from 'reka-ui'
import { ref, useTemplateRef, watch } from 'vue'

import type { WorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { workspaceInitialsOf } from '../../lib/workshop/initials'
import { submenuOffset } from '../../lib/workshop/submenu-offset'
import type { WorkspaceWithRole } from '../../lib/workshop/workspaces'

const {
  session,
  workspaces,
  switching,
  locale = 'en'
} = defineProps<{
  session: WorkshopSession
  workspaces: 'loading' | 'error' | readonly WorkspaceWithRole[]
  switching?: string
  locale?: Locale
}>()

const emit = defineEmits<{
  retry: []
  switchWorkspace: [workspaceId: string]
}>()

const open = defineModel<boolean>('open', { required: true })

function workspaceTier(workspace: WorkspaceWithRole): string {
  if (workspace.subscription_tier)
    return workspace.subscription_tier.split('_').join(' ')
  return t(
    workspace.role === 'member' ? 'nav.roleMember' : 'nav.roleOwner',
    locale
  )
}

const GAP = 12
const trigger = useTemplateRef<{ $el: HTMLElement }>('trigger')
const sideOffset = ref(GAP)

// The switcher is a button inside the menu, so a submenu placed beside it lands
// on top of the menu. It is offset to the menu's own left edge instead, and
// measured each time the list opens, since the menu has a maximum width the
// viewport constrains and its left edge moves when the window does.
function measure() {
  const el = trigger.value?.$el
  if (!el) return
  const panel = el.closest('[data-testid="header-account-menu"]')
  sideOffset.value = submenuOffset(
    el.getBoundingClientRect(),
    panel?.getBoundingClientRect(),
    GAP
  )
}

watch(open, (isOpen) => {
  if (isOpen) measure()
})
useEventListener(
  () => (open.value ? globalThis.window : undefined),
  'resize',
  measure
)

const itemClass =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-primary-comfy-canvas outline-none hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4'
const surfaceClass =
  'border-primary-comfy-ink-light bg-site-dropdown z-50 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0'
</script>

<template>
  <DropdownMenuSub v-model:open="open">
    <DropdownMenuSubTrigger
      ref="trigger"
      data-testid="account-workspace"
      :aria-label="t('nav.workspaces', locale)"
      class="grid size-8 shrink-0 cursor-pointer place-items-center rounded-lg text-primary-warm-gray outline-none hover:bg-transparency-white-t8 hover:text-primary-warm-white focus-visible:bg-transparency-white-t8 focus-visible:text-primary-warm-white"
    >
      <ArrowLeftRight class="size-4" aria-hidden="true" />
    </DropdownMenuSubTrigger>
    <DropdownMenuPortal>
      <DropdownMenuSubContent
        side="left"
        align="start"
        :side-offset="sideOffset"
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
            class="shrink-0 cursor-pointer font-bold text-primary-comfy-yellow"
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
              {{ workspaceInitialsOf(workspace.name) }}
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
              class="size-4 shrink-0 text-primary-comfy-yellow"
              aria-hidden="true"
            />
          </DropdownMenuItem>
        </template>
      </DropdownMenuSubContent>
    </DropdownMenuPortal>
  </DropdownMenuSub>
</template>
