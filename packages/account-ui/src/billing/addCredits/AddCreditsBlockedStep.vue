<template>
  <div :class="cn('p-4', ui.body)">
    <p class="m-0 text-muted-foreground">{{ translate('blocked.body') }}</p>
  </div>
  <div :class="footerBarClass(ui, 'justify-end')">
    <a
      v-if="checkoutUrl"
      :href="checkoutUrl"
      target="_blank"
      rel="noopener noreferrer"
      :class="primaryActionClass(ui)"
      data-testid="add-credits-open-checkout"
      @click="emit('follow')"
    >
      {{ translate('blocked.action') }}
      <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
    </a>
    <button
      v-else-if="reissues"
      type="button"
      :class="primaryActionClass(ui)"
      :disabled="!canReissue"
      data-testid="add-credits-open-checkout"
      @click="emit('reissue')"
    >
      {{ translate('blocked.action') }}
      <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
    </button>
    <button
      v-else
      type="button"
      :class="primaryActionClass(ui)"
      disabled
      aria-busy="true"
    >
      {{ translate('opening') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AddCreditsTranslate } from '@comfyorg/account-core/billing'
import { cn } from '@comfyorg/tailwind-utils'

import type { AddCreditsUi } from './addCreditsPresentation'
import { footerBarClass, primaryActionClass } from './addCreditsPresentation'

const {
  checkoutUrl,
  reissues = false,
  canReissue = true,
  translate,
  ui
} = defineProps<{
  checkoutUrl: string | undefined
  reissues?: boolean
  canReissue?: boolean
  translate: AddCreditsTranslate
  ui: AddCreditsUi
}>()

const emit = defineEmits<{ follow: []; reissue: [] }>()
</script>
