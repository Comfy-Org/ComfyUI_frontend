<template>
  <Message severity="info" icon="pi pi-palette" pt:text="w-full">
    <div class="flex items-center justify-between">
      <div>
        {{ $t('settingsCategories.ColorPalette') }}
      </div>
      <div class="actions">
        <Select
          class="w-44"
          v-model="activePaletteId"
          :options="palettes"
          optionLabel="name"
          optionValue="id"
        />
        <Button
          icon="pi pi-upload"
          text
          :title="$t('g.export')"
          @click="colorPaletteService.exportColorPalette(activePaletteId)"
        />
        <Button
          icon="pi pi-download"
          text
          :title="$t('g.import')"
          @click="importCustomPalette"
        />
        <Button
          icon="pi pi-trash"
          severity="danger"
          text
          :title="$t('g.delete')"
          @click="colorPaletteService.deleteCustomColorPalette(activePaletteId)"
          :disabled="!colorPaletteStore.isCustomPalette(activePaletteId)"
        />
      </div>
    </div>
  </Message>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import Button from 'primevue/button'
import Message from 'primevue/message'
import Select from 'primevue/select'

import { useColorPaletteService } from '@/services/colorPaletteService'
import { useSettingStore } from '@/stores/settingStore'
import { useColorPaletteStore } from '@/stores/workspace/colorPaletteStore'

const settingStore = useSettingStore()
const colorPaletteStore = useColorPaletteStore()
const colorPaletteService = useColorPaletteService()
const { palettes, activePaletteId } = storeToRefs(colorPaletteStore)

const importCustomPalette = async () => {
  const palette = await colorPaletteService.importColorPalette()
  if (palette) {
    settingStore.set('Comfy.ColorPalette', palette.id)
  }
}
</script>
