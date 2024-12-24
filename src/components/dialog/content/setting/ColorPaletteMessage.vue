<template>
  <Message severity="info" icon="pi pi-palette" pt:text="w-full">
    <div class="flex items-center justify-between">
      <Select
        v-model="activePaletteId"
        :options="palettes"
        optionLabel="name"
        optionValue="id"
      />
      <div class="actions"></div>
    </div>
  </Message>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import Select from 'primevue/select'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { storeToRefs } from 'pinia'

const colorPaletteStore = useColorPaletteStore()
const { palettes, activePaletteId } = storeToRefs(colorPaletteStore)
</script>
