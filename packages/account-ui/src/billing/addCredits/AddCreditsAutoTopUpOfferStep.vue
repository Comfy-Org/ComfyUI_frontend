<template>
  <div :class="cn('flex flex-col gap-4 p-4', ui.body)">
    <p class="m-0 text-muted-foreground">
      {{ translate('autoTopUpOffer.body') }}
    </p>
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
      @click="emit('close')"
    >
      {{ translate('autoTopUpOffer.notNow') }}
    </button>
    <AddCreditsBillingLink
      :to="setupUrl"
      :class="primaryActionClass(ui)"
      data-testid="add-credits-auto-top-up-set-up"
      @click="emit('setUp')"
    >
      {{ translate('autoTopUpOffer.setUp') }}
      <i class="icon-[lucide--arrow-up-right]" aria-hidden="true" />
    </AddCreditsBillingLink>
  </div>
</template>

<script setup lang="ts">
import type { AddCreditsTranslate } from '@comfyorg/account-core/billing'
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

import AddCreditsBillingLink from './AddCreditsBillingLink.vue'
import type {
  AddCreditsBillingLinkTarget,
  AddCreditsUi
} from './addCreditsPresentation'
import { footerBarClass, primaryActionClass } from './addCreditsPresentation'

const { setupUrl, translate, ui } = defineProps<{
  setupUrl: AddCreditsBillingLinkTarget
  translate: AddCreditsTranslate
  ui: AddCreditsUi
}>()

const emit = defineEmits<{ setUp: []; close: [] }>()
</script>
