<template>
  <div
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    :aria-describedby="messageId"
    data-testid="coach-landing"
    class="relative w-[800px] max-w-[calc(100vw-2.5rem)]"
  >
    <Button
      variant="secondary"
      size="icon"
      :aria-label="t('g.close')"
      class="absolute top-0 right-0 z-20 size-9 translate-x-[calc(100%+0.75rem)] rounded-full bg-secondary-background/80 text-base-foreground/70 backdrop-blur-xl hover:bg-secondary-background-hover/90 hover:text-base-foreground"
      @click="emit('close')"
    >
      <i class="icon-[lucide--x] size-4.5" />
    </Button>
    <div
      class="flex flex-col overflow-hidden rounded-2xl border border-border-default bg-secondary-background shadow-[0_24px_80px_rgba(0,0,0,0.85)] md:min-h-98 md:flex-row"
    >
      <div
        class="flex aspect-video items-center justify-center bg-base-background md:aspect-auto md:w-1/2"
      >
        <img v-if="image" :src="image" alt="" class="size-full object-cover" />
      </div>
      <div
        class="flex flex-col items-start justify-between self-stretch px-15 pt-15 pb-10 md:w-1/2"
      >
        <div class="flex flex-col gap-3">
          <h2
            class="m-0 text-[28px] leading-normal font-medium text-base-foreground"
          >
            {{ title }}
          </h2>
          <div
            :id="messageId"
            class="flex flex-col items-start gap-2 self-stretch py-2 text-base/5 text-muted-foreground"
          >
            {{ message }}
          </div>
        </div>
        <div class="flex w-full items-center justify-end gap-2">
          <Button variant="secondary" size="lg" @click="emit('skip')">
            {{ skipLabel }}
          </Button>
          <Button
            variant="inverted"
            size="lg"
            class="w-[146px]"
            @click="emit('start')"
          >
            {{ primaryLabel }}
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useId } from 'vue'
import { useI18n } from 'vue-i18n'

import Button from '@/components/ui/button/Button.vue'

const { title, message, image, primaryLabel, skipLabel } = defineProps<{
  title: string
  message: string
  image?: string
  primaryLabel: string
  skipLabel: string
}>()

const messageId = useId()

const emit = defineEmits<{
  skip: []
  start: []
  close: []
}>()

const { t } = useI18n()
</script>
