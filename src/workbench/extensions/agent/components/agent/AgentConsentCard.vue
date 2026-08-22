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
  <div
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    class="bg-agent-surface border-agent-border grid w-[1040px] max-w-full grid-cols-[555fr_483fr] overflow-hidden rounded-[14px] border shadow-[0_20px_24px_-4px_rgba(10,13,18,0.4),0_8px_8px_-4px_rgba(10,13,18,0.25)]"
  >
    <div class="p-2">
      <video
        v-if="videoSrc"
        :src="videoSrc"
        class="size-full rounded-[13px] border border-white/20 object-cover"
        autoplay
        muted
        loop
        playsinline
      />
      <div
        v-else
        class="text-agent-fg-muted grid size-full place-items-center rounded-[13px] border border-white/20 text-xs"
      >
        {{ $t('agent.consent.videoPlaceholder') }}
      </div>
    </div>

    <section class="relative flex flex-col gap-9 p-9">
      <button
        type="button"
        :aria-label="$t('agent.consent.close')"
        class="text-agent-fg-muted hover:bg-agent-surface-hover hover:text-agent-fg absolute top-[18px] right-[18px] flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent transition-colors"
        @click="emit('close')"
      >
        <span class="icon-[lucide--x] size-4" />
      </button>

      <div class="flex-1" />

      <div class="flex flex-col gap-4">
        <h2 class="text-agent-fg my-0 text-2xl font-semibold">{{ title }}</h2>
        <p
          v-for="(paragraph, index) in paragraphs"
          :key="index"
          class="text-agent-fg-muted my-0 text-sm/5"
        >
          {{ paragraph }}
        </p>
      </div>

      <footer class="flex items-center justify-between gap-2.5">
        <button
          type="button"
          class="text-agent-fg hover:bg-agent-surface-hover -ml-2 flex h-8 cursor-pointer items-center gap-1 rounded-lg border-0 bg-transparent px-2 text-xs transition-colors"
          @click="openDocs"
        >
          {{ $t('agent.consent.readDocs') }}
          <span class="icon-[lucide--square-arrow-out-up-right] size-4" />
        </button>

        <div class="flex items-center gap-2.5">
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
</template>
