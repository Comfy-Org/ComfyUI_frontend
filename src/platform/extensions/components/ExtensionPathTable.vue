<template>
  <div v-if="paths.length" class="flex flex-col gap-2">
    <h3 class="font-semibold">{{ $t('g.extensionPaths') }}</h3>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{{ $t('g.extensionPath') }}</TableHead>
          <TableHead class="w-20" />
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="path in paths" :key="path">
          <TableCell>{{ extensionNameFromPath(path) }}</TableCell>
          <TableCell class="text-right">
            <Switch
              :model-value="enabledByPath[path]"
              :disabled="disabled"
              :aria-label="
                $t('g.extensionPathToggle', {
                  name: extensionNameFromPath(path)
                })
              "
              @update:model-value="
                (enabled) => emit('setEnabled', path, enabled)
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
import { extensionNameFromPath } from '@/platform/settings/utils/extensionPath'

const {
  paths,
  enabledByPath,
  disabled = false
} = defineProps<{
  paths: string[]
  enabledByPath: Record<string, boolean>
  disabled?: boolean
}>()

const emit = defineEmits<{
  setEnabled: [path: string, enabled: boolean]
}>()
</script>
