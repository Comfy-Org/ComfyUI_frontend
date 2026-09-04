<script setup lang="ts">
import { ArrowLeftRight, Check, Coins, LogOut, Settings } from '@lucide/vue'
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
import { computed, ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { WORKSPACES, useMockSession } from '../../../composables/useMockSession'
import { useSignInHref } from '../../../composables/useSignInHref'
import { externalLinks } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'
import BuyCreditsDialog from '../../workshop/BuyCreditsDialog.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { session, signOut, switchWorkspace } = useMockSession()
const signInHref = useSignInHref(locale)

const account = computed(() =>
  session.value.status === 'signedIn' ? session.value.account : undefined
)
const hasCredits = computed(() => (account.value?.credits ?? 0) > 0)
const formattedCredits = computed(() =>
  new Intl.NumberFormat(locale).format(account.value?.credits ?? 0)
)

function initialsOf(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

const workspaceInitials = computed(() =>
  initialsOf(account.value?.workspace ?? '')
)
const planLabel = computed(() =>
  t(account.value?.subscribed ? 'nav.planPro' : 'nav.planFree', locale)
)
const roleLabel = computed(() =>
  t(
    account.value?.role === 'member' ? 'nav.roleMember' : 'nav.roleOwner',
    locale
  )
)

const buyingCredits = ref(false)

const itemClass =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-sm text-primary-comfy-canvas outline-none hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4'
const avatarClass =
  'grid size-12 shrink-0 place-items-center text-base font-bold text-primary-warm-white'
</script>

<template>
  <Button
    v-if="!account"
    as="a"
    :href="signInHref"
    variant="outline"
    class="text-primary-warm-white hover:bg-primary-warm-white hover:text-primary-comfy-ink"
    data-testid="header-sign-in"
  >
    {{ t('nav.signIn', locale) }}
  </Button>

  <DropdownMenuRoot v-else>
    <DropdownMenuTrigger
      data-testid="header-account"
      :aria-label="t('nav.accountMenu', locale)"
      class="bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 flex h-10 cursor-pointer items-center gap-1.5 rounded-full border border-transparency-white-t20 p-1 outline-none focus-visible:ring-3"
    >
      <span
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
        class="border-primary-comfy-ink-light bg-site-dropdown z-50 w-96 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <DropdownMenuSub>
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
                {{ account.workspace }}
              </span>
              <span
                class="block truncate text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
              >
                {{ planLabel }} · {{ roleLabel }}
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
              :side-offset="8"
              class="border-primary-comfy-ink-light bg-site-dropdown z-50 w-72 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
              data-testid="account-workspaces"
            >
              <p
                class="px-3 pt-1 pb-2 text-[11px] font-bold tracking-wider text-primary-warm-gray uppercase"
              >
                {{ t('nav.workspaces', locale) }}
              </p>
              <DropdownMenuItem
                v-for="workspace in WORKSPACES"
                :key="workspace"
                :class="itemClass"
                :data-testid="`account-workspace-${workspace}`"
                @click="switchWorkspace(workspace)"
              >
                <span
                  class="grid size-9 shrink-0 place-items-center rounded-lg bg-transparency-white-t8 text-sm font-bold text-primary-warm-white"
                  aria-hidden="true"
                >
                  {{ initialsOf(workspace) }}
                </span>
                <span class="flex-1 truncate">{{ workspace }}</span>
                <Check
                  v-if="workspace === account.workspace"
                  class="text-primary-comfy-yellow size-4"
                  aria-hidden="true"
                />
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuPortal>
        </DropdownMenuSub>

        <DropdownMenuItem
          :class="itemClass"
          data-testid="account-plan"
          @click="buyingCredits = true"
        >
          <Coins class="size-5 text-primary-warm-gray" aria-hidden="true" />
          <span class="flex-1">{{ t('nav.creditsLabel', locale) }}</span>
          <span
            :class="
              cn(
                'text-base font-bold tabular-nums',
                hasCredits
                  ? 'text-primary-warm-white'
                  : 'text-primary-comfy-yellow'
              )
            "
          >
            {{ formattedCredits }}
          </span>
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
            {{ t('nav.workspaceSettings', locale) }}
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
            {{ account.email }}
          </span>
          <DropdownMenuItem as-child>
            <button
              type="button"
              :aria-label="t('nav.signOut', locale)"
              class="flex h-8 shrink-0 cursor-pointer items-center gap-2 rounded-lg px-2 text-sm text-primary-warm-gray transition-colors outline-none group-hover/footer:bg-transparency-white-t8 group-hover/footer:text-primary-warm-white focus-visible:bg-transparency-white-t8 focus-visible:text-primary-warm-white"
              data-testid="account-sign-out"
              @click="signOut"
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

  <BuyCreditsDialog v-model:open="buyingCredits" :locale />
</template>
