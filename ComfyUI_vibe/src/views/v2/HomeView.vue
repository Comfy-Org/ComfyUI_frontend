<script setup lang="ts">
import { ref } from 'vue'

import Button from 'primevue/button'
import Card from 'primevue/card'

import { useComfyStore } from '@/stores/comfyStore'

const comfyStore = useComfyStore()
const isConnecting = ref(false)

async function connectToServer() {
  isConnecting.value = true
  try {
    await comfyStore.connect()
  } finally {
    isConnecting.value = false
  }
}
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center p-8">
    <Card class="w-full max-w-md">
      <template #title>
        <h1 class="text-2xl font-bold">ComfyUI Prototypes</h1>
      </template>
      <template #subtitle>
        <p class="text-surface-500">Prototype new features for ComfyUI</p>
      </template>
      <template #content>
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2">
            <span
              :class="[
                'inline-block h-3 w-3 rounded-full',
                comfyStore.isConnected ? 'bg-green-500' : 'bg-red-500'
              ]"
            />
            <span>
              {{
                comfyStore.isConnected
                  ? 'Connected to ComfyUI'
                  : 'Not connected'
              }}
            </span>
          </div>

          <Button
            :label="comfyStore.isConnected ? 'Open Canvas' : 'Connect'"
            :loading="isConnecting"
            :icon="comfyStore.isConnected ? 'pi pi-arrow-right' : 'pi pi-link'"
            @click="
              comfyStore.isConnected
                ? $router.push('/default/main/untitled')
                : connectToServer()
            "
          />

          <Button
            label="Linear Mode"
            severity="secondary"
            icon="pi pi-bolt"
            @click="$router.push('/create')"
          />
          <p class="text-center text-xs text-zinc-500">
            Simplified Runway/Midjourney-style interface
          </p>
        </div>
      </template>
    </Card>
  </div>
</template>
