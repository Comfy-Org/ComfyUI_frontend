<script setup lang="ts">
import Button from '@/components/ui/button/Button.vue'

const {
  title,
  paragraphs,
  videoSrc = '',
  docsUrl = ''
} = defineProps<{
  title: string
  paragraphs: string[]
  videoSrc?: string
  docsUrl?: string
}>()

const emit = defineEmits<{
  reject: []
  accept: []
}>()

function openDocs(): void {
  window.open(docsUrl, '_blank', 'noopener')
}
</script>

<template>
  <div class="@container w-full max-w-[1040px]">
    <div
      class="bg-agent-surface border-agent-border grid max-h-[90dvh] grid-cols-1 overflow-hidden rounded-2xl border shadow-[0_20px_24px_-4px_rgba(10,13,18,0.4),0_8px_8px_-4px_rgba(10,13,18,0.25)] @2xl:min-h-[543px] @2xl:grid-cols-[555fr_483fr]"
    >
      <div class="shrink-0 p-2">
        <video
          v-if="videoSrc"
          :src="videoSrc"
          class="aspect-362/262 w-full rounded-xl object-cover @2xl:aspect-auto @2xl:size-full"
          autoplay
          muted
          loop
          playsinline
        />
        <div
          v-else
          class="text-agent-fg-muted bg-agent-surface-raised grid aspect-362/262 w-full place-items-center rounded-xl text-xs @2xl:aspect-auto @2xl:size-full"
        >
          {{ $t('agent.consent.videoPlaceholder') }}
        </div>
      </div>

      <section class="flex min-h-0 flex-col gap-9 overflow-y-auto p-6 @2xl:p-9">
        <div class="hidden flex-1 @2xl:block" />

        <div class="flex flex-col gap-4">
          <h2 class="text-agent-fg my-0 text-xl font-semibold @2xl:text-2xl">
            {{ title }}
          </h2>
          <p
            v-for="(paragraph, index) in paragraphs"
            :key="index"
            class="text-agent-fg-muted my-0 text-sm/5"
          >
            {{ paragraph }}
          </p>

          <Button
            v-if="docsUrl"
            variant="link"
            size="unset"
            class="w-fit gap-1 px-0 py-2 text-sm/5 font-normal hover:underline"
            @click="openDocs"
          >
            {{ $t('agent.consent.readDocs') }}
            <span class="icon-[lucide--square-arrow-out-up-right] size-4" />
          </Button>
        </div>

        <!-- Reversed so the primary sits on top when the actions stack. -->
        <footer
          class="flex flex-col-reverse gap-2.5 @2xl:flex-row @2xl:justify-end"
        >
          <Button
            variant="textonly"
            size="md"
            class="w-full @2xl:w-auto"
            @click="emit('reject')"
          >
            {{ $t('agent.consent.reject') }}
          </Button>
          <Button
            variant="inverted"
            size="md"
            class="w-full @2xl:w-auto"
            @click="emit('accept')"
          >
            {{ $t('agent.consent.accept') }}
          </Button>
        </footer>
      </section>
    </div>
  </div>
</template>
