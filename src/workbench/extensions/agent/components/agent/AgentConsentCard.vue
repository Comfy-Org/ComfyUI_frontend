<script setup lang="ts">
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
  close: []
  reject: []
  accept: []
}>()

function openDocs(): void {
  if (docsUrl) window.open(docsUrl, '_blank', 'noopener')
}
</script>

<template>
  <div class="@container w-full max-w-[1040px]">
    <div
      role="dialog"
      aria-modal="true"
      :aria-label="title"
      class="bg-agent-surface border-agent-border relative grid max-h-[90dvh] grid-cols-1 overflow-hidden rounded-4xl border shadow-[0_20px_24px_-4px_rgba(10,13,18,0.4),0_8px_8px_-4px_rgba(10,13,18,0.25)] @2xl:min-h-[543px] @2xl:grid-cols-[555fr_483fr]"
    >
      <!-- On the card, not the panel, so it stays top-right once the grid stacks. -->
      <button
        type="button"
        :aria-label="$t('agent.consent.close')"
        class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg bg-agent-surface/70 absolute top-[18px] right-[18px] z-10 flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 transition-colors @2xl:bg-transparent"
        @click="emit('close')"
      >
        <span class="icon-[lucide--x] size-4" />
      </button>

      <div class="shrink-0 p-2">
        <video
          v-if="videoSrc"
          :src="videoSrc"
          class="aspect-video w-full rounded-3xl border border-white/20 object-cover @2xl:aspect-auto @2xl:size-full"
          autoplay
          muted
          loop
          playsinline
        />
        <div
          v-else
          class="text-agent-fg-muted grid aspect-video w-full place-items-center rounded-3xl border border-white/20 text-xs @2xl:aspect-auto @2xl:size-full"
        >
          {{ $t('agent.consent.videoPlaceholder') }}
        </div>
      </div>

      <section
        class="flex min-h-0 flex-col gap-6 overflow-y-auto p-6 @2xl:gap-9 @2xl:p-9"
      >
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
        </div>

        <footer class="flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            class="text-agent-fg hover:bg-agent-surface-hover -ml-2 flex h-8 cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-2 text-xs transition-colors"
            @click="openDocs"
          >
            {{ $t('agent.consent.readDocs') }}
            <span class="icon-[lucide--square-arrow-out-up-right] size-4" />
          </button>

          <div class="ml-auto flex items-center gap-2.5">
            <button
              type="button"
              class="text-agent-fg bg-agent-surface-raised hover:bg-agent-surface-hover h-8 cursor-pointer rounded-lg border-0 px-3 text-xs transition-colors"
              @click="emit('reject')"
            >
              {{ $t('agent.consent.reject') }}
            </button>
            <button
              type="button"
              class="bg-agent-fg text-agent-surface h-8 cursor-pointer rounded-lg border-0 px-3 text-xs transition-opacity hover:opacity-90"
              @click="emit('accept')"
            >
              {{ $t('agent.consent.accept') }}
            </button>
          </div>
        </footer>
      </section>
    </div>
  </div>
</template>
