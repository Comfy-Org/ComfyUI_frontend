<script setup lang="ts">
import { computed } from 'vue'

import Button from '@/components/ui/button/Button.vue'

import {
  agentGraphBuildPlaybackState as playback,
  pauseAgentGraphBuild,
  resumeAgentGraphBuild,
  skipAgentGraphBuild
} from '../../services/agent/agentGraphBuildPlayback'

const progress = computed(() =>
  playback.value.phase === 'playing' || playback.value.phase === 'paused'
    ? playback.value
    : null
)
const paused = computed(() => progress.value?.phase === 'paused')
</script>

<template>
  <div
    v-if="progress"
    aria-hidden="true"
    class="pointer-events-none fixed top-0 left-0 z-1100 transition-transform duration-75 ease-linear motion-reduce:hidden"
    :style="{
      transform: `translate3d(${progress.cursorX}px, ${progress.cursorY}px, 0)`
    }"
  >
    <span
      class="icon-[lucide--mouse-pointer-2] block size-6 fill-brand-yellow text-black drop-shadow-md"
    />
    <span
      class="bg-agent-surface text-agent-fg mt-1 ml-4 block max-w-56 truncate rounded-lg border border-interface-stroke px-2 py-1 text-xs shadow-lg"
    >
      {{ $t('agent.graphBuild.dragging', { node: progress.nodeLabel }) }}
    </span>
  </div>

  <Transition
    enter-active-class="transition duration-150 ease-out"
    enter-from-class="translate-y-2 opacity-0"
    leave-active-class="transition duration-100 ease-in"
    leave-to-class="translate-y-2 opacity-0"
  >
    <div
      v-if="progress"
      class="pointer-events-none fixed inset-x-4 bottom-20 z-1100 flex justify-center sm:inset-x-18"
    >
      <div
        role="status"
        aria-live="polite"
        class="bg-agent-surface pointer-events-auto flex min-h-12 w-full max-w-2xl items-center gap-3 rounded-2xl border border-interface-stroke px-3 py-2 shadow-xl"
      >
        <span
          aria-hidden="true"
          class="icon-[comfy--comfy-c] size-5 shrink-0 text-brand-yellow"
        />
        <span class="text-agent-fg min-w-0 flex-1 truncate text-sm">
          {{
            $t('agent.graphBuild.progress', {
              current: progress.current,
              total: progress.total,
              node: progress.nodeLabel
            })
          }}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          @click="paused ? resumeAgentGraphBuild() : pauseAgentGraphBuild()"
        >
          {{
            paused
              ? $t('agent.graphBuild.resume')
              : $t('agent.graphBuild.pause')
          }}
        </Button>
        <Button
          type="button"
          variant="textonly"
          size="sm"
          @click="skipAgentGraphBuild"
        >
          {{ $t('agent.graphBuild.skip') }}
        </Button>
      </div>
    </div>
  </Transition>
</template>
