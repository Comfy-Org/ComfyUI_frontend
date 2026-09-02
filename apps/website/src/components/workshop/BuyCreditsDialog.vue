<script setup lang="ts">
import { Coins, X } from '@lucide/vue'
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle
} from 'reka-ui'
import { ref } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import { useMockSession } from '../../composables/useMockSession'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'

const open = defineModel<boolean>('open', { default: false })
const { needed = 0, locale = 'en' } = defineProps<{
  needed?: number
  locale?: Locale
}>()
const emit = defineEmits<{ purchased: [credits: number] }>()

const PACKS = [
  { credits: 500, usd: 5 },
  { credits: 2000, usd: 20 },
  { credits: 5000, usd: 50 }
] as const

const { addCredits } = useMockSession()
const selected = ref<number>(PACKS[1].credits)
const paying = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

// A two-second "checkout" stands in for the real Stripe round trip; the
// form behind the dialog keeps its inputs the whole time.
function checkout() {
  paying.value = true
  timer = setTimeout(() => {
    addCredits(selected.value)
    paying.value = false
    open.value = false
    emit('purchased', selected.value)
  }, 2000)
}

function close() {
  clearTimeout(timer)
  paying.value = false
  open.value = false
}
</script>

<template>
  <DialogRoot :open @update:open="(value) => (value ? (open = true) : close())">
    <DialogPortal>
      <DialogOverlay class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      <DialogContent
        data-testid="buy-credits-dialog"
        class="bg-site-dropdown fixed top-1/2 left-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-1/2 rounded-3xl border border-transparency-white-t8 p-6 text-primary-warm-white shadow-2xl outline-none"
      >
        <div class="flex items-start justify-between gap-4">
          <div>
            <DialogTitle class="text-xl font-bold">
              {{ t('workshop.buy.title', locale) }}
            </DialogTitle>
            <DialogDescription class="mt-1 text-sm text-primary-warm-gray">
              {{
                needed
                  ? t('workshop.buy.needed', locale).replace(
                      '{n}',
                      String(needed)
                    )
                  : t('workshop.buy.body', locale)
              }}
            </DialogDescription>
          </div>
          <DialogClose
            class="text-primary-warm-gray hover:text-primary-warm-white"
            :aria-label="t('workshop.buy.close', locale)"
          >
            <X class="size-5" aria-hidden="true" />
          </DialogClose>
        </div>

        <ul class="mt-5 flex flex-col gap-2" role="radiogroup">
          <li v-for="pack in PACKS" :key="pack.credits">
            <button
              type="button"
              role="radio"
              :aria-checked="selected === pack.credits"
              :data-testid="`credit-pack-${pack.credits}`"
              :class="
                cn(
                  'flex w-full cursor-pointer items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors',
                  selected === pack.credits
                    ? 'border-primary-comfy-yellow bg-primary-comfy-yellow/10'
                    : 'border-transparency-white-t8 hover:border-transparency-white-t20'
                )
              "
              @click="selected = pack.credits"
            >
              <span class="flex items-center gap-2 font-semibold">
                <Coins
                  class="text-primary-comfy-yellow size-4"
                  aria-hidden="true"
                />
                {{ pack.credits.toLocaleString('en-US') }}
                {{ t('nav.credits', locale) }}
              </span>
              <span class="text-sm text-primary-warm-gray"
                >${{ pack.usd }}</span
              >
            </button>
          </li>
        </ul>

        <button
          type="button"
          data-testid="buy-credits-confirm"
          :disabled="paying"
          class="bg-primary-comfy-yellow mt-5 inline-flex h-12 w-full cursor-pointer items-center justify-center rounded-full text-sm font-bold tracking-wider text-primary-comfy-ink uppercase transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-70"
          @click="checkout"
        >
          {{
            paying
              ? t('workshop.buy.paying', locale)
              : t('workshop.buy.checkout', locale)
          }}
        </button>
        <p class="mt-3 text-center text-xs text-primary-warm-gray">
          {{ t('workshop.buy.note', locale) }}
        </p>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
