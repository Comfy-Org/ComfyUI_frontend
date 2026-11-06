<template>
  <TableRow>
    <TableCell class="truncate font-medium" :title="row.pack.name">
      {{ row.pack.name }}
    </TableCell>
    <TableCell
      class="truncate text-muted-foreground"
      :title="row.pack.publisher"
    >
      {{ row.pack.publisher || EMPTY_CELL }}
    </TableCell>
    <TableCell class="text-muted-foreground tabular-nums">
      {{ hasRegistryData ? formatCount(row.pack.installs) : EMPTY_CELL }}
    </TableCell>
    <TableCell class="text-muted-foreground tabular-nums">
      {{ hasRegistryData ? formatCount(row.pack.stars) : EMPTY_CELL }}
    </TableCell>
    <TableCell>
      <NodePackVersionSelect
        v-if="row.kind === 'pickable'"
        :pack="row.pack"
        :choice="row.choice"
        @choose="emit('choose', row.pack, $event)"
      />
      <span v-else class="font-mono text-xs text-muted-foreground">
        {{ versionCell }}
      </span>
    </TableCell>
    <TableCell class="truncate text-muted-foreground" :title="row.pack.license">
      {{ row.pack.license || EMPTY_CELL }}
    </TableCell>
    <TableCell>
      <NodePackCheckbox
        v-if="row.kind === 'pickable'"
        :model-value="row.picked"
        :aria-label="
          $t('buildCustomNodes.picker.installLabel', { pack: row.pack.name })
        "
        @update:model-value="emit('toggle', row.pack, row.choice)"
      />
      <NodePackCheckbox
        v-else-if="row.kind === 'inBuild'"
        :model-value="true"
        disabled
        :aria-label="
          $t('buildCustomNodes.picker.inBuildLabel', { pack: row.pack.name })
        "
      />
    </TableCell>
  </TableRow>
</template>

<script setup lang="ts">
import TableCell from '@comfyorg/design-system/table/TableCell'
import TableRow from '@comfyorg/design-system/table/TableRow'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { NodePack } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import NodePackCheckbox from '@/platform/workspace/buildCustomNodes/components/NodePackCheckbox.vue'
import NodePackVersionSelect from '@/platform/workspace/buildCustomNodes/components/NodePackVersionSelect.vue'
import type { NodePackVersionChoice } from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import type { NodePackRow } from '@/platform/workspace/buildCustomNodes/useNodePackRows'
import { useNodePackListItems } from '@/platform/workspace/buildCustomNodes/useNodePackListItems'

const { row } = defineProps<{
  row: NodePackRow
}>()

const emit = defineEmits<{
  toggle: [pack: NodePack, choice: NodePackVersionChoice]
  choose: [pack: NodePack, choice: NodePackVersionChoice]
}>()

const { t, locale } = useI18n()
const { versionText } = useNodePackListItems()

const EMPTY_CELL = '—'

const hasRegistryData = computed(() => row.kind !== 'inBuild' || row.listed)
const versionCell = computed(() =>
  row.kind === 'inBuild'
    ? versionText(row.label)
    : t('buildCustomNodes.picker.noVersion')
)
const countFormat = computed(
  () => new Intl.NumberFormat(locale.value, { notation: 'compact' })
)

function formatCount(count: number): string {
  return countFormat.value.format(count)
}
</script>
