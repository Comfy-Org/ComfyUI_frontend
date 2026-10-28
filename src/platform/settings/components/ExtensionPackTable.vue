<template>
  <div v-if="packs.length" class="flex flex-col gap-2">
    <h3 class="font-semibold">{{ $t('g.extensionPacks') }}</h3>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ $t('g.extensionPack') }}</TableHead>
          <TableHead class="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="pack in packs" :key="pack">
          <TableCell>{{ extensionPackName(pack) }}</TableCell>
          <TableCell class="text-right">
            <Switch
              :model-value="enabledByPath[pack]"
              :disabled="saving"
              :aria-label="
                $t('g.extensionPackToggle', { name: extensionPackName(pack) })
              "
              @update:model-value="
                (enabled) => emit('setEnabled', pack, enabled)
              "
            />
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>

<script setup lang="ts">
import Switch from '@comfyorg/design-system/switch/Switch'
import Table from '@comfyorg/design-system/table/Table'
import TableBody from '@comfyorg/design-system/table/TableBody'
import TableCell from '@comfyorg/design-system/table/TableCell'
import TableHead from '@comfyorg/design-system/table/TableHead'
import TableHeader from '@comfyorg/design-system/table/TableHeader'
import TableRow from '@comfyorg/design-system/table/TableRow'
import { extensionPackName } from '@/stores/extensionStore'

const { packs, enabledByPath, saving } = defineProps<{
  packs: string[]
  enabledByPath: Record<string, boolean>
  saving: boolean
}>()

const emit = defineEmits<{
  setEnabled: [path: string, enabled: boolean]
}>()
</script>
