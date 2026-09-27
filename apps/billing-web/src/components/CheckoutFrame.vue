<template>
  <div
    data-app-defaults
    class="flex max-h-[90vh] w-fit max-w-[min(1280px,95vw)] flex-col rounded-2xl border border-border-default bg-secondary-background text-base-foreground scheme-dark shadow-[0_25px_80px_rgba(5,6,12,0.45)]"
  >
    <div
      :class="
        cn(
          'relative flex h-full flex-col gap-4 overflow-y-auto p-4 pt-6',
          // The app's dark palette (src/assets/palettes/dark.json) replaces
          // the design-system stroke at runtime.
          '[--interface-stroke:color-mix(in_srgb,#171718_75.5%,#fff)]',
          step === 'payment' &&
            'xl:h-[min(740px,90vh)] xl:min-h-[min(740px,90vh)] xl:w-[min(1280px,95vw)] xl:gap-0 xl:overflow-hidden xl:rounded-2xl xl:p-0',
          step !== 'payment' &&
            'h-[min(740px,85vh)] overflow-hidden rounded-2xl bg-base-background xl:h-[min(740px,90vh)] xl:w-[512px]',
          'max-xl:w-[min(430px,92vw)] motion-safe:xl:transition-[width] motion-safe:xl:duration-300 motion-safe:xl:ease-in-out',
          step === 'payment' && 'max-xl:h-[85vh]'
        )
      "
    >
      <button
        type="button"
        :class="
          cn(
            buttonVariants({ variant: 'muted-textonly', size: 'icon' }),
            'absolute top-6 right-4 shrink-0 rounded-full text-text-secondary hover:bg-white/10'
          )
        "
        :aria-label="closeLabel"
        @click="emit('close')"
      >
        <i class="pi pi-times text-xl" />
      </button>
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * The cloud app's checkout dialog, as a page: the dialog's frame
 * (`useSubscriptionDialog`'s content class) around the step container
 * (`SubscriptionRequiredDialogContentUnified`'s embedded-step classes), so the
 * shared steps sit in the same box in both hosts. `payment` is the wide card
 * capture split; `confirm` and `success` are the narrow column.
 */
import { buttonVariants } from '@comfyorg/design-system/button.variants'
import { cn } from '@comfyorg/tailwind-utils'

const { step, closeLabel } = defineProps<{
  step: 'payment' | 'confirm' | 'success'
  closeLabel: string
}>()

const emit = defineEmits<{
  close: []
}>()
</script>
