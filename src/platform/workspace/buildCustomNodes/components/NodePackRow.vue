<template>
  <TableRow>
    <TableCell class="truncate font-medium" :title="name">{{ name }}</TableCell>
    <TableCell class="truncate text-muted-foreground" :title="pack?.publisher">
      {{ pack?.publisher || '—' }}
    </TableCell>
    <TableCell class="text-muted-foreground tabular-nums">
      {{ pack ? formatCount(pack.installs) : '—' }}
    </TableCell>
    <TableCell class="text-muted-foreground tabular-nums">
      {{ pack ? formatCount(pack.stars) : '—' }}
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
    <TableCell class="truncate text-muted-foreground" :title="pack?.license">
      {{ pack?.license || '—' }}
    </TableCell>
    <TableCell>
      <Checkbox
        v-if="row.kind === 'pickable'"
        :model-value="row.picked"
        :aria-label="$t('buildCustomNodes.picker.installLabel', { pack: name })"
        @update:model-value="emit('toggle', row.pack, row.choice)"
      />
      <Badge v-else-if="row.kind === 'inBuild'">
        {{ $t('buildCustomNodes.picker.inBuild') }}
      </Badge>
    </TableCell>
  </TableRow>
</template>

<script setup lang="ts">
import Badge from '@comfyorg/design-system/badge/Badge'
import Checkbox from '@comfyorg/design-system/checkbox/Checkbox'
import TableCell from '@comfyorg/design-system/table/TableCell'
import TableRow from '@comfyorg/design-system/table/TableRow'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { NodePack } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
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

const pack = computed(() => row.pack)
const name = computed(() => (row.kind === 'inBuild' ? row.name : row.pack.name))
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
