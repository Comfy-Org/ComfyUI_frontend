<script setup lang="ts">
import { ref } from 'vue'
import MockManagerDialog from './MockManagerDialog.vue'
import MockOSSMissingNodePack from './MockOSSMissingNodePack.vue'
import type { MissingNodePack } from './MockManagerDialog.vue'

// State

const isManagerOpen = ref(false)
const selectedPack = ref<MissingNodePack | null>(null)
const statusLog = ref<string>('')

// Actions

function log(msg: string) {
  statusLog.value = msg
}

function openManager(pack: MissingNodePack) {
  selectedPack.value = pack
  isManagerOpen.value = true
  log(`ⓘ Opening Manager: "${pack.displayName.split('//')[0].trim()}"`)
}

function closeManager() {
  isManagerOpen.value = false
  selectedPack.value = null
  log('Manager closed')
}

function onLocate(pack: MissingNodePack) {
  log(`◎ Locating on canvas: "${pack.displayName.split('//')[0].trim()}"`)
}
</script>

<template>
  <!-- ComfyUI layout simulation: canvas + right side panel + manager overlay -->
  <div class="relative w-full h-full flex overflow-hidden bg-[#0d0e10]">

    <!-- Canvas area -->
    <div class="flex-1 min-w-0 relative flex flex-col items-center justify-center gap-4 overflow-hidden">
      <!-- Grid background -->
      <div
        class="absolute inset-0 opacity-15"
        style="background-image: repeating-linear-gradient(#444 0 1px, transparent 1px 100%), repeating-linear-gradient(90deg, #444 0 1px, transparent 1px 100%); background-size: 32px 32px;"
      />
      <div class="relative z-10 flex flex-col items-center gap-4">
        <div class="text-[#8a8a8a]/30 text-sm select-none">ComfyUI Canvas</div>
        <div class="flex gap-5 flex-wrap justify-center px-8">
          <div v-for="i in 4" :key="i" class="w-[160px] h-[80px] rounded-lg border border-[#3a3b3d] bg-[#1a1b1d]/80 flex flex-col p-3 gap-2">
            <div class="h-3 w-24 rounded bg-[#2a2b2d]" />
            <div class="h-2 w-16 rounded bg-[#2a2b2d]" />
            <div class="h-2 w-20 rounded bg-[#2a2b2d]" />
          </div>
        </div>
        <div class="flex items-center justify-center min-h-[36px]">
          <div
            v-if="statusLog"
            class="px-4 py-1.5 rounded-lg text-xs text-center bg-blue-950/70 border border-blue-500/40 text-blue-300"
          >{{ statusLog }}</div>
          <div v-else class="px-4 py-1.5 text-xs text-[#8a8a8a]/30 border border-dashed border-[#2a2b2d] rounded-lg">
            Click the buttons in the right-side error tab
          </div>
        </div>
      </div>
    </div>

    <!-- Right: MockOSSMissingNodePack (320px) -->
    <MockOSSMissingNodePack
      @open-manager="openManager"
      @locate="onLocate"
      @log="log"
    />

    <!-- Manager dialog overlay (full screen including right panel) -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition-all duration-150 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-if="isManagerOpen"
        class="absolute inset-0 z-20 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        @click.self="closeManager"
      >
        <div class="relative h-[80vh] w-[90vw] max-w-[1400px]">
          <MockManagerDialog :selected-pack="selectedPack" @close="closeManager" />
        </div>
      </div>
    </Transition>

  </div>
</template>
