<script setup lang="ts">
import {
  ChevronDown,
  Coins,
  CreditCard,
  Info,
  LogOut,
  SlidersHorizontal
} from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useMockSession } from '../../../composables/useMockSession'
import { useSignInHref } from '../../../composables/useSignInHref'
import { externalLinks, getRoutes } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { session, signOut } = useMockSession()
const routes = getRoutes(locale)
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
        class="bg-primary-comfy-plum focus-visible:ring-primary-comfy-yellow/50 relative grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-xs font-bold text-primary-warm-white transition-opacity outline-none hover:opacity-90 focus-visible:ring-3"
      >
        {{ initials }}
        <span
          class="bg-primary-comfy-yellow absolute -right-1 -bottom-1 grid size-4 place-items-center rounded-full text-[9px] leading-none font-bold text-primary-comfy-ink ring-2 ring-primary-comfy-ink"
          aria-hidden="true"
        >
          {{ account.workspace[0] }}
        </span>
      </DropdownMenuTrigger>
    </div>

    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="10"
        class="border-primary-comfy-ink-light bg-site-dropdown z-50 w-80 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <button
          type="button"
          :aria-label="t('nav.switchWorkspace', locale)"
          :title="t('nav.switchWorkspace', locale)"
          class="hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4 flex w-full cursor-pointer items-center gap-3 rounded-xl p-2 text-left outline-none"
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
          <ChevronDown
            class="size-5 text-primary-warm-gray"
            aria-hidden="true"
          />
        </button>

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
          <Info
            class="size-4 text-primary-warm-gray"
            :aria-label="t('nav.creditsInfo', locale)"
            :title="t('nav.creditsInfo', locale)"
          />
        </div>

        <DropdownMenuSeparator class="my-1 h-px bg-transparency-white-t8" />

        <DropdownMenuItem as-child>
          <a
            :href="account.subscribed ? externalLinks.platform : routes.pricing"
            :target="account.subscribed ? '_blank' : undefined"
            :rel="account.subscribed ? 'noopener noreferrer' : undefined"
            :class="itemClass"
            data-testid="account-plan"
          >
            <CreditCard
              class="size-5 text-primary-warm-gray"
              aria-hidden="true"
            />
            <span class="flex-1">{{ t('nav.planAndCredits', locale) }}</span>
            <span
              v-if="account.subscribed"
              class="rounded-full bg-transparency-white-t8 px-2.5 py-1 text-[11px] font-bold tracking-wider text-primary-warm-white uppercase"
              data-testid="account-plan-pro"
            >
              {{ t('nav.planPro', locale) }}
            </span>
            <span
              v-else
              class="bg-primary-comfy-yellow rounded-full px-2.5 py-1 text-[11px] font-bold tracking-wider text-primary-comfy-ink uppercase"
              data-testid="account-upgrade"
            >
              {{ t('nav.upgrade', locale) }}
            </span>
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

        <div class="flex items-center gap-3 px-3 py-2">
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
              :title="t('nav.signOut', locale)"
              class="cursor-pointer rounded-lg p-1.5 text-primary-warm-gray outline-none hover:text-primary-warm-white focus-visible:text-primary-warm-white"
              data-testid="account-sign-out"
              @click="signOut"
            >
              <LogOut class="size-5" aria-hidden="true" />
            </button>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
