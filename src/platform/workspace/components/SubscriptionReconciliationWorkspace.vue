<template>
  <div
    class="mx-auto flex h-full max-w-[400px] flex-col items-stretch justify-between text-sm motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
  >
    <div class="flex flex-col items-center gap-4 pt-8">
      <i
        class="icon-[lucide--clock] size-12 shrink-0 text-warning-background"
      />
      <h2
        class="m-0 text-center text-xl font-semibold text-base-foreground lg:text-2xl"
      >
        {{ $t('billingOperation.reconciliationScreenTitle') }}
      </h2>
      <p class="m-0 text-center text-sm text-muted-foreground">
        {{ $t('billingOperation.reconciliationScreenDetail') }}
      </p>

      <!-- Shown only when an operation id is known: an empty box reads as a
           second failure rather than a support handle. -->
      <div
        v-if="operationId"
        class="mt-4 flex w-full flex-col gap-1 rounded-xl bg-secondary-background p-4"
      >
        <span class="text-sm text-muted-foreground">
          {{ $t('billingOperation.reconciliationSupportLabel') }}
        </span>
        <span class="font-mono text-sm text-base-foreground">{{
          operationId
        }}</span>
      </div>
    </div>

    <div class="flex flex-col gap-2 pt-8 pb-4">
      <Button
        variant="inverted"
        size="lg"
        class="w-full rounded-lg"
        @click="$emit('close')"
      >
        {{ $t('billingOperation.gotIt') }}
      </Button>
      <Button
        variant="muted-textonly"
        size="lg"
        class="w-full rounded-lg"
        @click="$emit('contactSupport')"
      >
        {{ $t('billingOperation.contactSupport') }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const { operationId = null } = defineProps<{
  /** The billing operation id support needs to locate the charge. */
  operationId?: string | null
}>()

defineEmits<{
  /** This step is terminal for the dialog — closing is the expected exit. */
  close: []
  /** Open the support destination with the operation id at hand. */
  contactSupport: []
}>()
</script>
