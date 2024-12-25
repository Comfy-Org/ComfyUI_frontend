<template>
  <Message severity="info" icon="pi pi-palette" pt:text="w-full">
    <div class="flex items-center justify-between">
      <Select
        v-model="activePaletteId"
        :options="palettes"
        optionLabel="name"
        optionValue="id"
      />
      <div class="actions">
        <Button
          icon="pi pi-download"
          @click="colorPaletteService.exportColorPalette(activePaletteId)"
        />
        <Button
          icon="pi pi-upload"
          @click="colorPaletteService.importColorPalette()"
        />
      </div>
    </div>
  </Message>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'
import { useColorPaletteService } from '@/services/colorPaletteService'
import { storeToRefs } from 'pinia'
import { watch } from 'vue'

const colorPaletteStore = useColorPaletteStore()
const colorPaletteService = useColorPaletteService()
const { palettes, activePaletteId } = storeToRefs(colorPaletteStore)

watch(activePaletteId, () => {
  colorPaletteService.loadColorPalette(activePaletteId.value)
})
</script>
