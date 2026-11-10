<template>
  <div :class="footerBarClass(ui, 'justify-between gap-4')">
    <div class="flex min-w-0 flex-col" data-testid="add-credits-summary">
      <span class="text-base font-semibold text-foreground tabular-nums">
        <span
          v-if="footer.loading"
          class="inline-block h-4 w-24 animate-pulse rounded-sm bg-secondary align-middle"
          data-testid="add-credits-credits-loading"
        />
        <template v-else>{{ footer.credits }}</template>
      </span>
      <span class="text-muted-foreground tabular-nums">
        {{ footer.detail }}
      </span>
    </div>
    <a
      v-if="view.notice?.kind === 'needs_verification'"
      :href="view.notice.verifyUrl"
      target="_blank"
      rel="noopener noreferrer"
      :class="primaryActionClass(ui)"
    >
      {{ translate('needsVerification.action') }}
      <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
    </a>
    <a
      v-else-if="view.notice?.kind === 'not_verified'"
      :href="supportUrl"
      target="_blank"
      rel="noopener noreferrer"
      :class="primaryActionClass(ui)"
    >
      {{ translate('notVerified.action') }}
    </a>
    <button
      v-else
      type="button"
      :class="primaryActionClass(ui)"
      :disabled="!view.canContinue"
      :aria-busy="view.opening || undefined"
      data-testid="add-credits-continue"
      @click="emit('continue')"
    >
      {{ view.opening ? translate('opening') : translate('continue') }}
      <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
    </button>
  </div>
</template>

<script setup lang="ts">
import type {
  AddCreditsAmountView,
  AddCreditsTranslate
} from '@comfyorg/account-core/billing'

import type {
  AddCreditsFooterCopy,
  AddCreditsUi
} from './addCreditsPresentation'
import { footerBarClass, primaryActionClass } from './addCreditsPresentation'

const { view, footer, supportUrl, translate, ui } = defineProps<{
  view: AddCreditsAmountView
  footer: AddCreditsFooterCopy
  supportUrl: string
  translate: AddCreditsTranslate
  ui: AddCreditsUi
}>()

const emit = defineEmits<{ continue: [] }>()
</script>
