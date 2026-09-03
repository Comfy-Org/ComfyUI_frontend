<script setup lang="ts">
import {
  Check,
  ChevronRight,
  Coins,
  CreditCard,
  LogOut,
  SlidersHorizontal
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
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { WORKSPACES, useMockSession } from '../../../composables/useMockSession'
import { useSignInHref } from '../../../composables/useSignInHref'
import { externalLinks } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

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
const initials = computed(() =>
  (account.value?.name ?? '')
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
)

const itemClass =
  'flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-primary-comfy-canvas outline-none hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4'
</script>

<template>
  <Button
    v-if="!account"
    as="a"
    :href="signInHref"
    variant="outline"
    size="sm"
    class="text-primary-warm-white hover:bg-primary-warm-white hover:text-primary-comfy-ink"
    data-testid="header-sign-in"
  >
    {{ t('nav.signIn', locale) }}
  </Button>

  <DropdownMenuRoot v-else>
    <div
      class="bg-transparency-white-t4 flex h-11 items-center gap-1.5 rounded-full border border-transparency-white-t20 p-1"
    >
      <a
        :href="externalLinks.platform"
        data-testid="header-credits"
        :title="t('nav.addCredits', locale)"
        :class="
          cn(
            'flex h-8 items-center gap-1.5 rounded-full px-3 text-sm font-bold whitespace-nowrap tabular-nums transition-colors',
            hasCredits
              ? 'bg-primary-comfy-yellow/10 text-primary-comfy-yellow hover:bg-primary-comfy-yellow/20'
              : 'bg-primary-comfy-red/10 text-primary-comfy-red hover:bg-primary-comfy-red/20'
          )
        "
      >
        <Coins class="size-4" aria-hidden="true" />
        {{ hasCredits ? formattedCredits : t('nav.noCredits', locale) }}
      </a>

      <DropdownMenuTrigger
        data-testid="header-account"
        :aria-label="t('nav.accountMenu', locale)"
        class="bg-primary-comfy-plum focus-visible:ring-primary-comfy-yellow/50 grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-xs font-bold text-primary-warm-white transition-opacity outline-none hover:opacity-90 focus-visible:ring-3"
      >
        {{ initials }}
      </DropdownMenuTrigger>
    </div>

    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="10"
        class="border-primary-comfy-ink-light bg-site-dropdown z-50 w-80 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <DropdownMenuSub>
          <DropdownMenuSubTrigger
            class="hover:bg-transparency-white-t4 data-[state=open]:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4 flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left outline-none"
            data-testid="account-workspace"
          >
            <span
              class="grid size-11 shrink-0 place-items-center rounded-xl bg-transparency-white-t8 text-lg font-bold text-primary-warm-white"
              aria-hidden="true"
            >
              {{ account.workspace[0] }}
            </span>
            <span
              class="flex-1 truncate text-base font-bold text-primary-warm-white"
            >
              {{ account.workspace }}
            </span>
            <ChevronRight
              class="size-5 text-primary-warm-gray"
              aria-hidden="true"
            />
          </DropdownMenuSubTrigger>
          <DropdownMenuPortal>
            <DropdownMenuSubContent
              :side-offset="12"
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
                  {{ workspace[0] }}
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

        <div
          class="flex items-center gap-3 p-3 text-sm"
          data-testid="account-credits"
        >
          <Coins class="text-primary-comfy-yellow size-5" aria-hidden="true" />
          <span class="flex-1 text-primary-warm-gray">
            {{ t('nav.creditsLabel', locale) }}
          </span>
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
        </div>

        <DropdownMenuSeparator class="my-1 h-px bg-transparency-white-t8" />

        <DropdownMenuItem as-child>
          <a
            :href="externalLinks.platform"
            target="_blank"
            rel="noopener noreferrer"
            :class="itemClass"
            data-testid="account-plan"
          >
            <CreditCard
              class="size-5 text-primary-warm-gray"
              aria-hidden="true"
            />
            <span class="flex-1">{{
              t('workshop.run.buyCredits', locale)
            }}</span>
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem as-child>
          <a
            :href="externalLinks.cloud"
            target="_blank"
            rel="noopener noreferrer"
            :class="itemClass"
          >
            <SlidersHorizontal
              class="size-5 text-primary-warm-gray"
              aria-hidden="true"
            />
            {{ t('nav.settings', locale) }}
          </a>
        </DropdownMenuItem>

        <DropdownMenuSeparator class="my-1 h-px bg-transparency-white-t8" />

        <div class="group/footer flex items-center gap-3 px-3 py-2">
          <span
            class="bg-primary-comfy-yellow/80 grid size-8 shrink-0 place-items-center rounded-full text-xs font-bold text-primary-comfy-ink"
            aria-hidden="true"
          >
            {{ initials }}
          </span>
          <span class="flex-1 truncate text-sm text-primary-warm-gray">
            {{ account.email }}
          </span>
          <DropdownMenuItem as-child>
            <button
              type="button"
              :aria-label="t('nav.signOut', locale)"
              class="flex h-9 shrink-0 cursor-pointer items-center gap-2 rounded-xl px-2 text-sm font-medium text-primary-warm-gray transition-colors outline-none group-hover/footer:bg-transparency-white-t8 group-hover/footer:px-3 group-hover/footer:text-primary-warm-white focus-visible:bg-transparency-white-t8 focus-visible:text-primary-warm-white"
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
</template>
