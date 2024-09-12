<template>
  <div class="system-stats">
    <h2>{{ $t('systemStats') }}</h2>
    <Accordion :activeIndex="0">
      <AccordionTab :header="$t('systemInfo')">
        <DataTable :value="[systemInfo]" stripedRows>
          <Column
            v-for="col in systemColumns"
            :key="col.field"
            :field="col.field"
            :header="$t(col.header)"
          />
        </DataTable>
      </AccordionTab>
      <AccordionTab :header="$t('devices')">
        <DataTable :value="props.stats.devices" stripedRows>
          <Column
            v-for="col in deviceColumns"
            :key="col.field"
            :field="col.field"
            :header="$t(col.header)"
          />
        </DataTable>
      </AccordionTab>
    </Accordion>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Accordion from 'primevue/accordion'
import AccordionTab from 'primevue/accordiontab'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import type { SystemStats } from '@/types/apiTypes'

const props = defineProps<{
  stats: SystemStats
}>()

const systemInfo = computed(() => ({
  ...props.stats.system,
  argv: props.stats.system.argv.join(' ')
}))

const systemColumns = [
  { field: 'os', header: 'os' },
  { field: 'python_version', header: 'pythonVersion' },
  { field: 'embedded_python', header: 'embeddedPython' },
  { field: 'comfyui_version', header: 'comfyuiVersion' },
  { field: 'pytorch_version', header: 'pytorchVersion' },
  { field: 'argv', header: 'arguments' }
]

const deviceColumns = [
  { field: 'name', header: 'name' },
  { field: 'type', header: 'type' },
  { field: 'index', header: 'index' },
  { field: 'vram_total', header: 'vramTotal' },
  { field: 'vram_free', header: 'vramFree' },
  { field: 'torch_vram_total', header: 'torchVramTotal' },
  { field: 'torch_vram_free', header: 'torchVramFree' }
]
</script>
