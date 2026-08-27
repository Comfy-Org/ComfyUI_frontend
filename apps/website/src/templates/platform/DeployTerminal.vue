<script setup lang="ts">
interface TerminalLine {
  kind: 'command' | 'success'
  text: string
}

const lines: TerminalLine[] = [
  { kind: 'command', text: 'comfy deploy ./workflow_api.json' },
  {
    kind: 'success',
    text: 'Build resolved by Builder (nodes · models · pinned deps)'
  },
  { kind: 'success', text: 'Deployed → https://your-build.run.comfy.app' }
]
</script>

<template>
  <div
    class="overflow-hidden rounded-3xl border border-white/10 bg-black/40 font-mono text-xs shadow-2xl lg:text-sm"
  >
    <div class="flex items-center gap-1.5 border-b border-white/10 px-5 py-3.5">
      <span class="size-3 rounded-full bg-white/15" />
      <span class="size-3 rounded-full bg-white/15" />
      <span class="size-3 rounded-full bg-white/15" />
    </div>
    <div class="space-y-3 px-5 py-6 lg:px-6 lg:py-8">
      <p
        v-for="line in lines"
        :key="line.text"
        class="flex items-start gap-2.5 text-primary-comfy-canvas"
      >
        <span
          class="text-primary-comfy-yellow shrink-0"
          aria-hidden="true"
          v-text="line.kind === 'command' ? '$' : '✔'"
        />
        <span class="break-all">{{ line.text }}</span>
      </p>
    </div>
  </div>
</template>
