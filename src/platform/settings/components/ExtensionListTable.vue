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
          <Badge
            v-if="extensionStore.isAgentCreatedExtension(extension)"
            severity="info"
          >
            {{ $t('g.createdByAgent') }}
          </Badge>
          <Badge v-else-if="extensionStore.isCoreExtension(extension.name)">
            {{ $t('g.core') }}
          </Badge>
          <Badge v-else severity="info">{{ $t('g.custom') }}</Badge>
          <div
            v-if="extensionStore.isAgentCreatedExtension(extension)"
            class="text-xs text-muted-foreground"
          >
            <span>
              {{ agentExtensionPackName(extension.name) ?? extension.name }}
            </span>
            <span v-if="extension.provenance?.summary">
              · {{ extension.provenance.summary }}
            </span>
          </div>
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

import Badge from '@comfyorg/design-system/badge/Badge'
import Button from '@comfyorg/design-system/button/Button'
import Checkbox from '@comfyorg/design-system/checkbox/Checkbox'
import Menu from '@comfyorg/design-system/menu/Menu'
import type { MenuItem } from '@comfyorg/design-system/lib/menu/types'
import type { TableSortDirection } from '@comfyorg/design-system/lib/table/tableUtils'
import Switch from '@comfyorg/design-system/switch/Switch'
import Table from '@comfyorg/design-system/table/Table'
import TableBody from '@comfyorg/design-system/table/TableBody'
import TableCell from '@comfyorg/design-system/table/TableCell'
import TableHead from '@comfyorg/design-system/table/TableHead'
import TableHeader from '@comfyorg/design-system/table/TableHeader'
import TableRow from '@comfyorg/design-system/table/TableRow'
import TableSortHead from '@comfyorg/design-system/table/TableSortHead'
import {
  agentExtensionPackName,
  useExtensionStore
} from '@/stores/extensionStore'
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
