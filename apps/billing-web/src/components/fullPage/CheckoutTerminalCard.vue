<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * A payment that went through, as much as this page can say about it. The
 * plan is named only when this page's own Pay sent it (attribution, rule
 * 19); a payment found on the server shows its reference instead. FE-3021
 * replaces this with the Ending screens.
 */
const { started, workspace, plan, operationId, returnLabel } = defineProps<{
  started: boolean
  workspace?: string
  plan?: string
  operationId?: string
  returnLabel?: string
}>()

const emit = defineEmits<{ return: [] }>()

const { t } = useI18n()
</script>

<template>
  <main
    class="dark-theme fixed inset-0 flex items-center justify-center overflow-auto bg-base-background p-6 font-inter"
  >
    <section
      class="flex w-full max-w-96 flex-col items-center gap-4 text-center"
      data-testid="checkout-terminal"
    >
      <i
        class="icon-[lucide--circle-check-big] size-10 text-success-background"
        aria-hidden="true"
      />
      <h1 class="m-0 text-2xl font-semibold text-base-foreground">
        {{
          started
            ? t('checkout.fullPage.terminal.success.title')
            : t('checkout.fullPage.terminal.completed.title')
        }}
      </h1>
      <p class="m-0 text-sm/5 text-muted-foreground">
        {{
          started
            ? plan === undefined
              ? t('checkout.fullPage.terminal.success.body', { workspace })
              : t('checkout.fullPage.terminal.success.bodyPlan', {
                  plan,
                  workspace
                })
            : t('checkout.fullPage.terminal.completed.body', { workspace })
        }}
      </p>
      <p
        v-if="!started && operationId !== undefined"
        class="m-0 font-mono text-xs text-muted-foreground"
      >
        {{ t('checkout.fullPage.terminal.reference', { operationId }) }}
      </p>
      <button
        v-if="returnLabel !== undefined"
        type="button"
        class="mt-2 h-10 w-full cursor-pointer rounded-lg bg-secondary-background px-4 text-sm font-semibold text-base-foreground hover:bg-secondary-background-hover focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:outline-none"
        @click="emit('return')"
      >
        {{ returnLabel }}
      </button>
    </section>
  </main>
</template>
