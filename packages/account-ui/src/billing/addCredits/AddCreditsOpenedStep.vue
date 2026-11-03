<template>
  <div :class="cn('flex flex-col gap-4 p-4', ui.body)">
    <p class="m-0 text-muted-foreground">{{ translate('opened.body') }}</p>
    <dl
      :class="
        cn('m-0 flex flex-col gap-1 rounded-lg bg-secondary p-3', ui.summary)
      "
      data-testid="add-credits-opened-summary"
    >
      <div class="flex justify-between">
        <dt class="text-muted-foreground">{{ translate('opened.credits') }}</dt>
        <dd class="m-0 tabular-nums">{{ credits }}</dd>
      </div>
      <div class="flex justify-between">
        <dt class="text-muted-foreground">{{ translate('opened.amount') }}</dt>
        <dd class="m-0 tabular-nums">{{ format.money(amountCents) }}</dd>
      </div>
    </dl>
    <div
      v-if="refused"
      role="alert"
      class="flex gap-2 rounded-lg border border-solid border-warning/60 bg-warning/10 p-3"
    >
      <i
        class="mt-0.5 icon-[lucide--circle-alert] text-warning"
        aria-hidden="true"
      />
      <span>{{ translate('checkoutFailed.title') }}</span>
    </div>
  </div>
  <div :class="footerBarClass(ui, 'justify-end')">
    <button
      type="button"
      :class="
        cn(
          buttonVariants({ variant: 'muted-textonly', size: 'lg' }),
          ui.secondary
        )
      "
      :disabled="!canReopen"
      data-testid="add-credits-reopen"
      @click="emit('reopen')"
    >
      {{ translate('opened.reopen') }}
      <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
    </button>
    <button
      type="button"
      :class="
        cn(buttonVariants({ variant: 'secondary', size: 'lg' }), ui.secondary)
      "
      @click="emit('close')"
    >
      {{ translate('close') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AddCreditsTranslate } from '@comfyorg/account-core/billing'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import type { AddCreditsFormat, AddCreditsUi } from './addCreditsPresentation'
import { footerBarClass } from './addCreditsPresentation'

const { amountCents, credits, refused, canReopen, translate, format, ui } =
  defineProps<{
    amountCents: number
    credits: string
    refused: boolean
    canReopen: boolean
    translate: AddCreditsTranslate
    format: AddCreditsFormat
    ui: AddCreditsUi
  }>()

const emit = defineEmits<{ reopen: []; close: [] }>()
</script>
