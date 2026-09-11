<script setup lang="ts">
import { ExternalLink, Minus, Plus } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import {
  MAX_TOP_UP_USD,
  MIN_TOP_UP_USD,
  TOP_UP_PACKS,
  clampTopUp,
  usdToCredits
} from '../../config/credits'
import { watchForTopUp } from '../../config/workshop-credits'
import { useWorkshopSession } from '../../config/workshop-session-state'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import {
  TopUpCheckoutError,
  createTopUpCheckout,
  platformTopUpHref
} from '../../lib/workshop/buy-credits'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const open = defineModel<boolean>('open', { default: false })

const { session } = useWorkshopSession()
const usd = ref(25)
const credits = computed(() => usdToCredits(usd.value))
const state = ref<'amount' | 'pending' | 'failed'>('amount')

watch(open, (value) => {
  if (value) return
  usd.value = 25
  state.value = 'amount'
})

function setAmount(next: number) {
  usd.value = clampTopUp(next)
}

// The tab opens empty inside the click, before the awaited create - a window
// opened after the await would meet the popup blocker. A 404 is the dark
// rollout saying the flag has not reached this caller; the tab then carries
// the platform rail instead of an error.
async function continueToCheckout() {
  if (state.value === 'pending' || !session.value) return
  const forWorkspace = session.value
  state.value = 'pending'
  const tab = window.open('about:blank', '_blank')
  try {
    const url = await createTopUpCheckout(forWorkspace.token, usd.value * 100)
    state.value = 'amount'
    open.value = false
    watchForTopUp()
    if (tab) tab.location.assign(url)
    else window.location.assign(url)
  } catch (error) {
    if (error instanceof TopUpCheckoutError && error.status === 404) {
      state.value = 'amount'
      open.value = false
      const fallback = platformTopUpHref(forWorkspace.workspace.id)
      watchForTopUp()
      if (tab) tab.location.assign(fallback)
      else window.location.assign(fallback)
      return
    }
    tab?.close()
    state.value = 'failed'
  }
}

const format = (value: number) => value.toLocaleString(locale)
const packClass = (selected: boolean) =>
  cn(
    'flex cursor-pointer flex-col gap-1 rounded-2xl px-4 py-3 text-left transition-colors',
    selected
      ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
      : 'bg-transparency-white-t4 text-primary-comfy-canvas hover:bg-transparency-white-t8'
  )
const stepperClass =
  'grid size-7 cursor-pointer place-items-center rounded-full bg-transparency-white-t8 text-primary-comfy-canvas transition-colors hover:bg-transparency-white-t20 disabled:opacity-40'
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.credits.close', locale)"
      class="flex flex-col gap-6 sm:max-w-xl"
      data-testid="buy-credits-dialog"
    >
      <DialogTitle class="pr-16">
        {{ t('workshop.credits.title', locale) }}
      </DialogTitle>
      <DialogDescription class="text-base text-primary-comfy-canvas/70">
        {{ t('workshop.credits.body', locale) }}
      </DialogDescription>

      <div
        class="grid grid-cols-2 gap-2 sm:grid-cols-4"
        data-testid="buy-credits-packs"
      >
        <button
          v-for="pack in TOP_UP_PACKS"
          :key="pack"
          type="button"
          :aria-pressed="usd === pack"
          :class="packClass(usd === pack)"
          :data-testid="`buy-credits-pack-${pack}`"
          @click="setAmount(pack)"
        >
          <span class="text-lg font-bold">${{ pack }}</span>
          <span class="text-xs tabular-nums opacity-70">
            {{ format(usdToCredits(pack)) }}
          </span>
        </button>
      </div>

      <div
        class="bg-transparency-white-t4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
        data-testid="buy-credits-custom"
      >
        <span class="text-sm text-primary-warm-gray">
          {{ t('workshop.credits.custom', locale) }}
        </span>
        <span class="flex items-center gap-3">
          <button
            type="button"
            :class="stepperClass"
            :disabled="usd <= MIN_TOP_UP_USD"
            :aria-label="t('workshop.credits.less', locale)"
            data-testid="buy-credits-less"
            @click="setAmount(usd - 5)"
          >
            <Minus class="size-3.5" aria-hidden="true" />
          </button>
          <span
            class="w-28 text-right text-sm text-primary-comfy-canvas tabular-nums"
          >
            ${{ format(usd) }} · {{ format(credits) }}
          </span>
          <button
            type="button"
            :class="stepperClass"
            :disabled="usd >= MAX_TOP_UP_USD"
            :aria-label="t('workshop.credits.more', locale)"
            data-testid="buy-credits-more"
            @click="setAmount(usd + 5)"
          >
            <Plus class="size-3.5" aria-hidden="true" />
          </button>
        </span>
      </div>

      <p
        v-if="state === 'failed'"
        role="status"
        class="text-sm text-red-400"
        data-testid="checkout-error"
      >
        {{ t('workshop.error.checkoutFailed', locale) }}
      </p>

      <div class="mt-2 flex flex-wrap items-center justify-end gap-3">
        <Button
          variant="outline"
          size="lg"
          class="px-5"
          :disabled="state === 'pending'"
          data-testid="buy-credits-cancel"
          @click="open = false"
        >
          {{ t('workshop.credits.cancel', locale) }}
        </Button>
        <Button
          size="lg"
          class="px-5"
          :disabled="state === 'pending'"
          data-testid="buy-credits-continue"
          @click="continueToCheckout"
        >
          {{ t('workshop.credits.continue', locale) }}
          <template #append>
            <ExternalLink class="size-4" aria-hidden="true" />
          </template>
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
