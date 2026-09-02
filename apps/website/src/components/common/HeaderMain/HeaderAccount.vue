<script setup lang="ts">
import {
  ArrowLeftRight,
  Coins,
  CreditCard,
  Info,
  LogOut,
  SlidersHorizontal,
  Tag,
  Users
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
import { PRICING_URL } from '../../../config/model-pricing'
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

const links = [
  {
    icon: CreditCard,
    label: 'nav.planAndCredits',
    href: externalLinks.platform
  },
  { icon: Tag, label: 'nav.partnerNodesPricing', href: PRICING_URL },
  { icon: Users, label: 'nav.workspaceSettings', href: externalLinks.cloud },
  {
    icon: SlidersHorizontal,
    label: 'nav.accountSettings',
    href: externalLinks.cloud
  }
] as const

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

  <div v-else class="flex items-center gap-2">
    <a
      :href="externalLinks.platform"
      data-testid="header-credits"
      :title="t('nav.addCredits', locale)"
      :class="
        cn(
          'bg-transparency-white-t4 flex h-10 items-center gap-2 rounded-full border border-transparency-white-t20 px-3 text-sm font-bold whitespace-nowrap text-primary-warm-white transition-colors hover:bg-transparency-white-t8',
          !hasCredits && 'border-primary-comfy-red/60'
        )
      "
    >
      <Coins
        :class="
          cn(
            'size-4',
            hasCredits ? 'text-primary-warm-gray' : 'text-primary-comfy-red'
          )
        "
        aria-hidden="true"
      />
      <template v-if="hasCredits">
        <span class="tabular-nums">{{ formattedCredits }}</span>
        <span class="hidden font-medium text-primary-warm-gray 2xl:inline">
          {{ t('nav.credits', locale) }}
        </span>
      </template>
      <template v-else>{{ t('nav.noCredits', locale) }}</template>
    </a>

    <DropdownMenuRoot>
      <DropdownMenuTrigger
        data-testid="header-account"
        :aria-label="t('nav.accountMenu', locale)"
        class="bg-primary-comfy-plum focus-visible:ring-primary-comfy-yellow/50 grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-sm font-bold text-primary-warm-white transition-opacity outline-none hover:opacity-90 focus-visible:ring-3"
      >
        {{ initials }}
      </DropdownMenuTrigger>

      <DropdownMenuPortal>
        <DropdownMenuContent
          align="end"
          :side-offset="10"
          class="border-primary-comfy-ink-light bg-site-dropdown z-50 w-80 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
        >
          <div class="flex items-center gap-3 p-3">
            <span
              class="bg-primary-comfy-yellow grid size-11 shrink-0 place-items-center rounded-xl text-lg font-bold text-primary-comfy-ink"
              aria-hidden="true"
            >
              {{ account.workspace[0] }}
            </span>
            <span
              class="flex-1 truncate text-base font-bold text-primary-warm-white"
            >
              {{ account.workspace }}
            </span>
            <button
              type="button"
              :aria-label="t('nav.switchWorkspace', locale)"
              :title="t('nav.switchWorkspace', locale)"
              class="cursor-pointer rounded-lg p-1.5 text-primary-warm-gray hover:text-primary-warm-white"
            >
              <ArrowLeftRight class="size-5" aria-hidden="true" />
            </button>
          </div>

          <div
            class="flex items-center gap-3 px-3 py-2 text-sm"
            data-testid="account-credits"
          >
            <Coins
              class="text-primary-comfy-yellow size-5"
              aria-hidden="true"
            />
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
          <div class="px-3 pt-1 pb-2">
            <DropdownMenuItem as-child>
              <Button
                v-if="account.subscribed"
                as="a"
                :href="externalLinks.platform"
                variant="outline"
                size="sm"
                class="w-full"
                data-testid="account-add-credits"
              >
                {{ t('nav.addCredits', locale) }}
              </Button>
              <Button
                v-else
                as="a"
                :href="routes.pricing"
                variant="outline"
                size="sm"
                class="w-full"
                data-testid="account-upgrade"
              >
                {{ t('nav.upgradeToAddCredits', locale) }}
              </Button>
            </DropdownMenuItem>
          </div>

          <DropdownMenuSeparator class="my-2 h-px bg-transparency-white-t8" />

          <template v-for="(link, index) in links" :key="link.label">
            <DropdownMenuSeparator
              v-if="index === 2"
              class="my-2 h-px bg-transparency-white-t8"
            />
            <DropdownMenuItem as-child>
              <a
                :href="link.href"
                target="_blank"
                rel="noopener noreferrer"
                :class="itemClass"
              >
                <component
                  :is="link.icon"
                  class="size-5 text-primary-warm-gray"
                  aria-hidden="true"
                />
                {{ t(link.label, locale) }}
              </a>
            </DropdownMenuItem>
          </template>

          <DropdownMenuSeparator class="my-2 h-px bg-transparency-white-t8" />

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
  </div>
</template>
