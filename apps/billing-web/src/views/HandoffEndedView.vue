<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import { supportLinkWithCode } from '@/checkout/payVerdict'
import EndingCodeCard from '@/components/fullPage/EndingCodeCard.vue'
import EndingFrame from '@/components/fullPage/EndingFrame.vue'
import type { HandoffEnding } from '@/handoff/handoffTab'
import { handoffTab } from '@/handoff/handoffTab'

type Screen = 'link' | 'browser' | 'checking' | 'session'

const SCREEN: Readonly<Record<HandoffEnding, Screen>> = {
  link_unavailable: 'link',
  exchange_lost: 'link',
  refused: 'link',
  storage_unavailable: 'browser',
  payment_pending: 'checking',
  session_ended: 'session'
}

const { t } = useI18n()

const ended = computed(() =>
  handoffTab.value?.kind === 'ended' ? handoffTab.value : undefined
)
const screen = computed(() => SCREEN[ended.value?.ending ?? 'session_ended'])
const reference = computed(() =>
  screen.value === 'checking' ? ended.value?.reference : undefined
)
const hasStep = computed(
  () => screen.value === 'link' || screen.value === 'browser'
)
const supportLink = computed(() => supportLinkWithCode(reference.value))
</script>

<template>
  <EndingFrame
    :title="t(`handoff.${screen}.title`)"
    :body="t(`handoff.${screen}.body`)"
    data-testid="handoff-ending"
  >
    <template #icon>
      <i
        :class="
          cn(
            screen === 'checking'
              ? 'icon-[lucide--clock]'
              : 'icon-[lucide--circle-alert]',
            'size-10 text-warning'
          )
        "
        aria-hidden="true"
      />
    </template>

    <p
      v-if="hasStep"
      class="m-0 w-full rounded-lg bg-secondary p-6 text-left text-sm/5 text-muted-foreground"
    >
      {{ t(`handoff.${screen}.step`) }}
    </p>
    <EndingCodeCard
      v-if="reference !== undefined"
      :label="t('handoff.checking.codeLabel')"
      :code="reference"
    />

    <div class="flex w-full flex-col items-center gap-4">
      <p class="m-0 text-sm/5 text-muted-foreground">
        {{
          screen === 'checking'
            ? t('handoff.checking.closeLine')
            : t('handoff.closeTab')
        }}
      </p>
      <a
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
