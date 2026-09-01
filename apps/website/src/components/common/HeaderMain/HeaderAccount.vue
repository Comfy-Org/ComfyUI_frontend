<script setup lang="ts">
import { ChevronDown } from '@lucide/vue'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from 'reka-ui'
import { computed } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useMockSession } from '../../../composables/useMockSession'
import { externalLinks } from '../../../config/routes'
import type { Locale } from '../../../i18n/translations'
import { t } from '../../../i18n/translations'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()

const { session, signIn, signOut, setCredits } = useMockSession()

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
  'hover:bg-transparency-white-t4 focus-visible:bg-transparency-white-t4 flex w-full cursor-pointer items-center justify-between gap-4 rounded-xl px-3 py-2 text-sm text-primary-warm-white outline-none'
</script>

<template>
  <Button
    v-if="!account"
    variant="outline"
    data-testid="header-sign-in"
    @click="signIn"
  >
    {{ t('nav.signIn', locale) }}
  </Button>

  <DropdownMenuRoot v-else>
    <DropdownMenuTrigger
      data-testid="header-account"
      :aria-label="t('nav.accountMenu', locale)"
      class="hover:bg-transparency-white-t4 focus-visible:ring-primary-comfy-yellow/50 flex h-10 cursor-pointer items-center gap-2 rounded-2xl border border-transparency-white-t20 py-1 pr-3 pl-1.5 outline-none focus-visible:ring-3"
    >
      <span
        class="bg-primary-comfy-plum grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold text-primary-warm-white"
        aria-hidden="true"
      >
        {{ initials }}
      </span>
      <span
        :class="
          cn(
            'text-sm font-bold whitespace-nowrap',
            hasCredits ? 'text-primary-warm-white' : 'text-primary-comfy-orange'
          )
        "
      >
        <template v-if="hasCredits">
          {{ formattedCredits }}
          <span class="hidden font-medium text-primary-warm-gray 2xl:inline">
            {{ t('nav.credits', locale) }}
          </span>
        </template>
        <template v-else>{{ t('nav.noCredits', locale) }}</template>
      </span>
      <ChevronDown class="size-4 text-primary-warm-gray" aria-hidden="true" />
    </DropdownMenuTrigger>

    <DropdownMenuPortal>
      <DropdownMenuContent
        align="end"
        :side-offset="8"
        class="bg-site-dropdown border-primary-comfy-ink-light z-50 w-72 rounded-2xl border p-2 shadow-lg data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
      >
        <DropdownMenuLabel class="px-3 py-2">
          <p class="text-sm font-bold text-primary-warm-white">
            {{ account.name }}
          </p>
          <p class="text-xs text-primary-warm-gray">{{ account.email }}</p>
        </DropdownMenuLabel>

        <div class="px-3 py-2 text-sm">
          <p class="text-xs text-primary-warm-gray uppercase">
            {{ t('nav.workspace', locale) }}
          </p>
          <p class="text-primary-warm-white">{{ account.workspace }}</p>
        </div>

        <div class="flex items-center justify-between gap-4 px-3 py-2 text-sm">
          <span
            :class="
              cn(
                'font-bold',
                hasCredits
                  ? 'text-primary-warm-white'
                  : 'text-primary-comfy-orange'
              )
            "
          >
            <template v-if="hasCredits">
              {{ formattedCredits }} {{ t('nav.credits', locale) }}
            </template>
            <template v-else>{{ t('nav.noCredits', locale) }}</template>
          </span>
          <Button
            as="a"
            :href="externalLinks.platform"
            target="_blank"
            rel="noopener noreferrer"
            :variant="hasCredits ? 'outline' : 'default'"
            size="sm"
          >
            {{ t('nav.buyCredits', locale) }}
          </Button>
        </div>

        <DropdownMenuSeparator class="my-2 h-px bg-transparency-white-t8" />

        <DropdownMenuLabel
          class="px-3 py-1 text-[10px] font-bold tracking-widest text-primary-warm-gray uppercase"
        >
          {{ t('nav.prototypeControls', locale) }}
        </DropdownMenuLabel>
        <DropdownMenuItem
          :class="itemClass"
          @select="setCredits(hasCredits ? 0 : 1250)"
        >
          {{
            hasCredits
              ? t('nav.simulateZeroBalance', locale)
              : t('nav.restoreBalance', locale)
          }}
        </DropdownMenuItem>
        <DropdownMenuItem :class="itemClass" @select="signOut">
          {{ t('nav.signOut', locale) }}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
