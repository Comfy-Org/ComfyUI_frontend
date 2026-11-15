<script setup lang="ts">
import { computed, onScopeDispose } from 'vue'
import { useI18n } from 'vue-i18n'

import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import { supportLinkWithCode } from '@/checkout/payVerdict'
import EndingCodeCard from '@/components/fullPage/EndingCodeCard.vue'
import EndingFrame from '@/components/fullPage/EndingFrame.vue'
import type { HandoffEnding } from '@/handoff/handoffTab'
import {
  followPaymentOutcome,
  handoffTab,
  sessionTabStorage
} from '@/handoff/handoffTab'
import { readPaymentOutcome } from '@/session/billingWebClient'

interface EndingView {
  readonly copy: string
  readonly icon: string
  readonly closeLine: string
  readonly step?: true
  readonly code?: true
  readonly support?: true
}

const ALERT = 'icon-[lucide--circle-alert] text-warning'
const CLOCK = 'icon-[lucide--clock] text-warning'
const DONE = 'icon-[lucide--circle-check-big] text-success'
const CLOSE_TAB = 'handoff.closeTab'

const LINK: EndingView = {
  copy: 'handoff.link',
  icon: ALERT,
  closeLine: CLOSE_TAB,
  step: true,
  support: true
}

const VIEW: Readonly<Record<HandoffEnding, EndingView>> = {
  link_unavailable: LINK,
  exchange_lost: LINK,
  refused: LINK,
  storage_unavailable: { ...LINK, copy: 'handoff.browser' },
  payment_pending: {
    copy: 'handoff.checking',
    icon: CLOCK,
    closeLine: 'handoff.checking.closeLine',
    code: true,
    support: true
  },
  completed: {
    copy: 'checkout.fullPage.ending.completed',
    icon: DONE,
    closeLine: CLOSE_TAB,
    code: true
  },
  unconfirmed: {
    copy: 'checkout.fullPage.ending.unconfirmed',
    icon: CLOCK,
    closeLine: CLOSE_TAB,
    code: true,
    support: true
  }
}

const { t } = useI18n()

onScopeDispose(
  followPaymentOutcome({
    storage: sessionTabStorage,
    readOutcome: readPaymentOutcome
  })
)

const ended = computed(() =>
  handoffTab.value?.kind === 'ended' ? handoffTab.value : undefined
)
const view = computed(() => VIEW[ended.value?.ending ?? 'unconfirmed'])
const workspace = computed(() =>
  ended.value?.ending === 'completed' ? ended.value.workspace : undefined
)
const reference = computed(() =>
  view.value.code ? ended.value?.reference : undefined
)
const supportLink = computed(() => supportLinkWithCode(reference.value))
</script>

<template>
  <EndingFrame
    :title="t(`${view.copy}.title`)"
    :body="t(`${view.copy}.body`, { workspace })"
    data-testid="handoff-ending"
  >
    <template #icon>
      <i :class="cn(view.icon, 'size-10')" aria-hidden="true" />
    </template>

    <p
      v-if="view.step"
      class="m-0 w-full rounded-lg bg-secondary p-6 text-left text-sm/5 text-muted-foreground"
    >
      {{ t(`${view.copy}.step`) }}
    </p>
    <EndingCodeCard
      v-if="reference !== undefined"
      :label="t(`${view.copy}.codeLabel`)"
      :code="reference"
    />

    <div class="flex w-full flex-col items-center gap-4">
      <p class="m-0 text-sm/5 text-muted-foreground">
        {{ t(view.closeLine) }}
      </p>
      <a
        v-if="view.support"
        :href="supportLink"
        :class="
          cn(
            buttonVariants({ variant: 'textonly', size: 'lg' }),
            'w-full font-semibold no-underline'
          )
        "
      >
        {{ t('checkout.fullPage.outcome.contactSupport') }}
      </a>
    </div>
  </EndingFrame>
</template>
