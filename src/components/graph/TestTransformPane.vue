<template>
  <div class="relative w-full h-full bg-gray-100">
    <!-- Canvas placeholder -->
    <canvas ref="canvasRef" class="absolute inset-0 w-full h-full" />

    <!-- Transform Pane -->
    <TransformPane :canvas="mockCanvas" :viewport="viewport">
      <!-- Test nodes -->
      <div
        v-for="node in testNodes"
        :key="node.id"
        :data-node-id="node.id"
        class="absolute border-2 border-blue-500 bg-white p-4 rounded shadow-lg"
        :style="{
          left: node.pos[0] + 'px',
          top: node.pos[1] + 'px',
          width: node.size[0] + 'px',
          height: node.size[1] + 'px'
        }"
      >
        <h3 class="font-bold">{{ node.title }}</h3>
        <p class="text-sm text-gray-600">ID: {{ node.id }}</p>
      </div>
    </TransformPane>

    <!-- Controls -->
    <div class="absolute top-4 left-4 bg-white p-4 rounded shadow-lg">
      <h2 class="font-bold mb-2">Transform Controls</h2>
      <div class="space-y-2">
        <button
          class="px-3 py-1 bg-blue-500 text-white rounded"
          @click="pan(-50, 0)"
        >
          Pan Left
        </button>
        <button
          class="px-3 py-1 bg-blue-500 text-white rounded"
          @click="pan(50, 0)"
        >
          Pan Right
        </button>
        <button
          class="px-3 py-1 bg-blue-500 text-white rounded"
          @click="pan(0, -50)"
        >
          Pan Up
        </button>
        <button
          class="px-3 py-1 bg-blue-500 text-white rounded"
          @click="pan(0, 50)"
        >
          Pan Down
        </button>
        <button
          class="px-3 py-1 bg-green-500 text-white rounded"
          @click="zoom(1.2)"
        >
          Zoom In
        </button>
        <button
          class="px-3 py-1 bg-green-500 text-white rounded"
          @click="zoom(0.8)"
        >
          Zoom Out
        </button>
        <button
          class="px-3 py-1 bg-gray-500 text-white rounded"
          @click="reset()"
        >
          Reset
        </button>
      </div>
      <div class="mt-4 text-sm">
        <p>
          Offset: {{ mockCanvas.ds.offset[0].toFixed(1) }},
          {{ mockCanvas.ds.offset[1].toFixed(1) }}
        </p>
        <p>Scale: {{ mockCanvas.ds.scale.toFixed(2) }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'

import TransformPane from './TransformPane.vue'

// Mock canvas with transform state
const mockCanvas = reactive({
  ds: {
    offset: [0, 0] as [number, number],
    scale: 1
  },
  canvas: document.createElement('canvas')
}) as any // Using any for mock object

const canvasRef = ref<HTMLCanvasElement>()
const viewport = ref(new DOMRect(0, 0, window.innerWidth, window.innerHeight))

// Test nodes
const testNodes = ref([
  { id: '1', title: 'Node 1', pos: [100, 100], size: [200, 100] },
  { id: '2', title: 'Node 2', pos: [350, 150], size: [200, 100] },
  { id: '3', title: 'Node 3', pos: [200, 300], size: [200, 100] }
])

// Transform controls
const pan = (dx: number, dy: number) => {
  mockCanvas.ds.offset[0] += dx
  mockCanvas.ds.offset[1] += dy
}

const zoom = (factor: number) => {
  mockCanvas.ds.scale *= factor
}

const reset = () => {
  mockCanvas.ds.offset = [0, 0]
  mockCanvas.ds.scale = 1
}

onMounted(() => {
  if (canvasRef.value) {
    mockCanvas.canvas = canvasRef.value
  }
})
</script>
