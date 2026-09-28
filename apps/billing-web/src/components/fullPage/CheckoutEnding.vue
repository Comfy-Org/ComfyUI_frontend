<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { cn } from '@comfyorg/tailwind-utils'

import type { EndingKind, EndingScreen } from '@/checkout/endingScreen'
import { supportLinkWithCode } from '@/checkout/payVerdict'

export interface EndingPlan {
  readonly name: string
  readonly price: string
  readonly period: string
}

type Tone = 'done' | 'waiting'

/**
 * How each ending reads. The done family closes back to the product; the
 * waiting family ends on support, since closing changes nothing about money
 * still moving.
 */
const ENDINGS: Readonly<
  Record<
    EndingKind,
    {
      readonly tone: Tone
      readonly primary?: 'close'
      readonly support: boolean
    }
  >
> = {
  success: { tone: 'done', primary: 'close', support: false },
  completed: { tone: 'done', primary: 'close', support: false },
  already_completed: { tone: 'done', primary: 'close', support: false },
  in_progress: { tone: 'waiting', support: true },
  received: { tone: 'waiting', support: true },
  unconfirmed: { tone: 'waiting', support: true }
}

const ICON: Readonly<Record<Tone, string>> = {
  done: 'icon-[lucide--circle-check-big] text-success-background',
  waiting: 'icon-[lucide--clock] text-warning-background'
}

const { screen, workspace, plan } = defineProps<{
  screen: EndingScreen
  workspace: string
  plan?: EndingPlan
}>()

const emit = defineEmits<{ close: [] }>()

const { t } = useI18n()
const { copy, copied } = useClipboard({ legacy: true })

const ending = computed(() => ENDINGS[screen.kind])
const copyKey = computed(() => `checkout.fullPage.ending.${screen.kind}`)
const code = computed(() => ('code' in screen ? screen.code : undefined))
const supportLink = computed(() => supportLinkWithCode(code.value))
const primary = computed(() => ending.value.primary)

function act() {
  if (primary.value === 'close') emit('close')
}
</script>

<template>
  <main
    class="dark-theme fixed inset-0 flex items-center justify-center overflow-auto bg-base-background p-6 font-inter"
  >
    <section
      class="flex w-full max-w-96 flex-col items-center gap-8 text-center"
      data-testid="checkout-ending"
    >
      <div class="flex flex-col items-center gap-3">
        <i :class="cn(ICON[ending.tone], 'size-10')" aria-hidden="true" />
        <h1 class="m-0 text-2xl font-semibold text-base-foreground">
          {{ t(`${copyKey}.title`) }}
        </h1>
        <p class="m-0 text-sm/5 text-muted-foreground">
          {{ t(`${copyKey}.body`, { workspace }) }}
        </p>
      </div>

      <div
        v-if="screen.kind === 'success' && plan"
        class="flex w-full flex-col gap-2 rounded-lg bg-secondary-background p-6 text-left"
        data-testid="checkout-ending-plan"
      >
        <p class="m-0 text-sm font-semibold text-base-foreground">
          {{ plan.name }}
        </p>
        <p class="m-0 text-base-foreground tabular-nums">
          <span class="text-3xl font-semibold">{{ plan.price }}</span>
          {{ plan.period }}
        </p>
      </div>

      <div
        v-if="code !== undefined"
        class="flex w-full flex-col gap-2 rounded-lg bg-secondary-background p-6 text-left"
      >
        <p class="m-0 text-sm/5 text-muted-foreground">
          {{ t(`${copyKey}.codeLabel`) }}
        </p>
        <div class="flex items-center justify-between gap-4">
          <code
            class="font-mono text-sm break-all text-base-foreground"
            data-testid="checkout-ending-code"
          >
            {{ code }}
          </code>
          <button
            type="button"
            :aria-label="
              copied
                ? t('checkout.fullPage.ending.copied')
                : t('checkout.fullPage.ending.copy')
            "
            class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-sm text-muted-foreground hover:text-base-foreground focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none"
            @click="copy(code)"
          >
            <i
              :class="
                cn(
                  'size-4',
                  copied ? 'icon-[lucide--check]' : 'icon-[lucide--copy]'
                )
              "
              aria-hidden="true"
            />
          </button>
        </div>
      </div>

      <div class="flex w-full flex-col items-center gap-4">
        <p
          v-if="ending.tone === 'waiting'"
          class="m-0 text-sm/5 text-muted-foreground"
        >
          {{ t('checkout.fullPage.ending.closeLine') }}
        </p>
        <button
          v-if="primary !== undefined"
          type="button"
          class="h-10 w-full cursor-pointer rounded-lg bg-secondary-background px-4 text-sm font-semibold text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-base-background focus-visible:outline-none"
          @click="act"
        >
          {{ t(`checkout.fullPage.ending.actions.${primary}`) }}
        </button>
        <a
          v-if="ending.support"
          :href="supportLink"
          class="text-sm font-semibold text-base-foreground no-underline hover:underline focus-visible:underline focus-visible:outline-none"
        >
          {{ t('checkout.fullPage.outcome.contactSupport') }}
        </a>
      </div>
    </section>
  </main>
</template>
