<script setup lang="ts">
import { Check, ExternalLink, Lock } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { cn } from '@comfyorg/tailwind-utils'

import Button from '@/components/ui/button/Button.vue'
import { useMockSession } from '../../composables/useMockSession'
import { usdToCredits } from '../../config/credits'
import type { Locale } from '../../i18n/translations'
import { t } from '../../i18n/translations'
import { stripeCheckoutHref } from '../../lib/workshop/buy-credits'
import Dialog from '../ui/dialog/Dialog.vue'
import DialogContent from '../ui/dialog/DialogContent.vue'
import DialogDescription from '../ui/dialog/DialogDescription.vue'
import DialogTitle from '../ui/dialog/DialogTitle.vue'

const { locale = 'en' } = defineProps<{ locale?: Locale }>()
const open = defineModel<boolean>('open', { default: false })

const { addCredits } = useMockSession()

const PACKS = [10, 25, 50] as const
const usd = ref<number>(25)
const credits = computed(() => usdToCredits(usd.value))

// The real flow leaves for Stripe Checkout and comes back. The prototype plays
// that round trip out in place, so the whole journey can be reviewed without a
// payment account.
type Step = 'leaving' | 'checkout' | 'back'
const step = ref<Step>('leaving')

const returnPath = ref('/workshop/')
const href = computed(() => stripeCheckoutHref(returnPath.value, usd.value))

watch(open, (value) => {
  if (!value) return
  returnPath.value = location.pathname + location.search
  step.value = 'leaving'
})

function pay() {
  addCredits(credits.value)
  step.value = 'back'
}

const format = (value: number) => value.toLocaleString(locale)
const packClass = (selected: boolean) =>
  cn(
    'flex cursor-pointer flex-col gap-1 rounded-2xl px-4 py-3 text-left transition-colors',
    selected
      ? 'bg-primary-comfy-yellow text-primary-comfy-ink'
      : 'bg-transparency-white-t4 text-primary-comfy-canvas hover:bg-transparency-white-t8'
  )
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      :close-label="t('workshop.credits.close', locale)"
      class="sm:max-w-xl"
      data-testid="buy-credits-dialog"
    >
      <div v-if="step === 'leaving'" class="flex flex-col gap-6">
        <DialogTitle class="pr-16">
          {{ t('workshop.credits.title', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.credits.body', locale) }}
        </DialogDescription>

        <div class="grid grid-cols-3 gap-2" data-testid="buy-credits-packs">
          <button
            v-for="pack in PACKS"
            :key="pack"
            type="button"
            :aria-pressed="usd === pack"
            :class="packClass(usd === pack)"
            :data-testid="`buy-credits-pack-${pack}`"
            @click="usd = pack"
          >
            <span class="text-lg font-bold">${{ pack }}</span>
            <span class="text-xs tabular-nums opacity-70">
              {{ format(usdToCredits(pack)) }} {{ t('nav.credits', locale) }}
            </span>
          </button>
        </div>

        <p
          class="bg-transparency-white-t4 overflow-x-auto rounded-2xl px-4 py-3 font-mono text-xs whitespace-nowrap text-primary-warm-gray"
          data-testid="buy-credits-url"
        >
          {{ href }}
        </p>

        <div class="flex flex-wrap gap-3">
          <Button
            size="lg"
            class="px-5"
            data-testid="buy-credits-continue"
            @click="step = 'checkout'"
          >
            {{ t('workshop.credits.continue', locale) }}
            <template #append>
              <ExternalLink class="size-4" aria-hidden="true" />
            </template>
          </Button>
          <Button
            variant="outline"
            size="lg"
            class="px-5"
            data-testid="buy-credits-cancel"
            @click="open = false"
          >
            {{ t('workshop.credits.cancel', locale) }}
          </Button>
        </div>
      </div>

      <div v-else-if="step === 'checkout'" class="flex flex-col gap-6">
        <p
          class="inline-flex w-fit items-center gap-2 rounded-full bg-transparency-white-t8 px-3 py-1.5 text-xs text-primary-warm-gray"
        >
          <Lock class="size-3.5" aria-hidden="true" />
          platform.comfy.org
        </p>
        <DialogTitle class="pr-16">
          {{ t('workshop.credits.checkout', locale) }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.credits.checkoutNote', locale) }}
        </DialogDescription>

        <dl
          class="bg-transparency-white-t4 flex items-baseline justify-between rounded-2xl px-4 py-3 text-sm"
        >
          <dt class="text-primary-comfy-canvas">
            {{ format(credits) }} {{ t('nav.credits', locale) }}
          </dt>
          <dd class="text-lg font-bold text-primary-warm-white">${{ usd }}</dd>
        </dl>

        <div class="flex flex-wrap gap-3">
          <Button
            size="lg"
            class="px-5"
            data-testid="buy-credits-pay"
            @click="pay"
          >
            {{ t('workshop.credits.pay', locale).replace('{usd}', `$${usd}`) }}
          </Button>
          <Button
            variant="outline"
            size="lg"
            class="px-5"
            data-testid="buy-credits-back"
            @click="step = 'leaving'"
          >
            {{ t('workshop.credits.back', locale) }}
          </Button>
        </div>
      </div>

      <div v-else class="flex flex-col gap-6" data-testid="buy-credits-done">
        <span
          class="bg-primary-comfy-yellow grid size-12 place-items-center rounded-2xl text-primary-comfy-ink"
          aria-hidden="true"
        >
          <Check class="size-6" :stroke-width="3" />
        </span>
        <DialogTitle class="pr-16">
          {{
            t('workshop.credits.done', locale).replace('{n}', format(credits))
          }}
        </DialogTitle>
        <DialogDescription class="text-base text-primary-comfy-canvas/70">
          {{ t('workshop.credits.doneBody', locale) }}
        </DialogDescription>
        <Button
          size="lg"
          class="w-fit px-5"
          data-testid="buy-credits-resume"
          @click="open = false"
        >
          {{ t('workshop.credits.resume', locale) }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
