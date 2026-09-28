<script setup lang="ts">
import { useI18n } from 'vue-i18n'

/**
 * `column` is the element down with no saved method to fall back on,
 * `element` the element down beside live saved methods, `saved` the saved
 * methods down beside a live element.
 */
const { rail = 'column' } = defineProps<{
  rail?: 'column' | 'element' | 'saved'
}>()

const emit = defineEmits<{ retry: [] }>()

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-col gap-6">
    <div role="alert" class="rounded-lg bg-secondary-background-hover p-4">
      <p
        class="m-0 flex items-center gap-2 text-sm font-semibold text-base-foreground"
      >
        <i
          class="icon-[lucide--circle-alert] size-4 shrink-0 text-warning-background"
          aria-hidden="true"
        />
        {{ t(`checkout.fullPage.railFailed.${rail}.title`) }}
      </p>
      <p class="m-0 mt-2 text-sm/5 text-muted-foreground">
        {{ t(`checkout.fullPage.railFailed.${rail}.body`) }}
      </p>
    </div>
    <button
      type="button"
      class="h-10 w-full cursor-pointer rounded-lg bg-base-foreground px-4 text-sm font-semibold text-base-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-base-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-secondary-background focus-visible:outline-none"
      @click="emit('retry')"
    >
      {{ t('checkout.fullPage.railFailed.retry') }}
    </button>
  </div>
</template>
