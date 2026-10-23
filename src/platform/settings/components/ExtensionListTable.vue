<template>
  <Table>
    <TableHeader>
      <TableRow>
        <TableHead class="w-12">
          <Checkbox
            :model-value="selectAllState"
            :aria-label="$t('g.selectAll')"
            @update:model-value="(selected) => emit('toggleAll', selected)"
          />
        </TableHead>
        <TableSortHead v-model:direction="direction">
          {{ $t('g.extensionName') }}
        </TableSortHead>
        <TableHead class="w-20 text-right">
          <Menu :items="actions" align="end">
            <template #trigger>
              <Button
                size="icon"
                variant="muted-textonly"
                :aria-label="$t('g.moreOptions')"
              >
                <i class="icon-[lucide--ellipsis]" />
              </Button>
            </template>
          </Menu>
        </TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <TableRow
        v-for="extension in extensions"
        :key="extension.name"
        class="cursor-pointer"
        :data-state="selectedNames.has(extension.name) ? 'selected' : undefined"
        @click="
          emit(
            'setSelected',
            extension.name,
            !selectedNames.has(extension.name)
          )
        "
      >
        <TableCell>
          <Checkbox
            :model-value="selectedNames.has(extension.name)"
            :aria-label="$t('g.selectItem', { name: extension.name })"
            @click.stop
            @update:model-value="
              (selected) => emit('setSelected', extension.name, selected)
            "
          />
        </TableCell>
        <TableCell>
          {{ extension.name }}
          <Badge v-if="extensionStore.isCoreExtension(extension.name)">
            {{ $t('g.core') }}
          </Badge>
          <Badge v-else severity="info">{{ $t('g.custom') }}</Badge>
        </TableCell>
        <TableCell class="text-right">
          <Switch
            :model-value="enabledByName[extension.name]"
            :disabled="extensionStore.isExtensionReadOnly(extension.name)"
            :aria-label="extension.name"
            @click.stop
            @update:model-value="
              (enabled) => emit('setEnabled', extension.name, enabled)
            "
          />
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script setup lang="ts">
import type { CheckboxCheckedState } from 'reka-ui'

import Badge from '@/components/ui/badge/Badge.vue'
import Button from '@/components/ui/button/Button.vue'
import Checkbox from '@/components/ui/checkbox/Checkbox.vue'
import Menu from '@/components/ui/menu/Menu.vue'
import type { MenuItem } from '@/components/ui/menu/types'
import Switch from '@/components/ui/switch/Switch.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'
import TableSortHead from '@/components/ui/table/TableSortHead.vue'
import type { TableSortDirection } from '@/components/ui/table/tableUtils'
import { useExtensionStore } from '@/stores/extensionStore'
import type { ComfyExtension } from '@/types/comfy'

const { extensions, selectedNames, enabledByName, selectAllState, actions } =
  defineProps<{
    extensions: ComfyExtension[]
    selectedNames: Set<string>
    enabledByName: Record<string, boolean>
    selectAllState: CheckboxCheckedState
    actions: MenuItem[]
  }>()

const direction = defineModel<TableSortDirection | null>('direction', {
  required: true
})

const emit = defineEmits<{
  toggleAll: [selected: CheckboxCheckedState]
  setSelected: [name: string, selected: CheckboxCheckedState]
  setEnabled: [name: string, enabled: boolean]
}>()

const extensionStore = useExtensionStore()
</script>
