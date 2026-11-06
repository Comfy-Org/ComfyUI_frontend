<template>
  <Table class="h-[min(30rem,55dvh)] border-border">
    <colgroup>
      <col />
      <col class="w-[18%]" />
      <col class="w-22" />
      <col class="w-16" />
      <col class="w-40" />
      <col class="w-24" />
      <col class="w-22" />
    </colgroup>
    <TableHeader class="sticky top-0 z-10 bg-background">
      <TableRow class="hover:bg-transparent">
        <TableHead class="pl-4">
          {{ $t('buildCustomNodes.picker.columnName') }}
        </TableHead>
        <TableHead>{{
          $t('buildCustomNodes.picker.columnPublisher')
        }}</TableHead>
        <TableHead>{{
          $t('buildCustomNodes.picker.columnInstalls')
        }}</TableHead>
        <TableHead>{{ $t('buildCustomNodes.picker.columnStars') }}</TableHead>
        <TableHead>{{ $t('buildCustomNodes.picker.columnVersion') }}</TableHead>
        <TableHead>{{ $t('buildCustomNodes.picker.columnLicense') }}</TableHead>
        <TableHead>{{ $t('buildCustomNodes.picker.columnInstall') }}</TableHead>
      </TableRow>
    </TableHeader>
    <TableBody>
      <NodePackRow
        v-for="row in rows"
        :key="row.key"
        :row
        @toggle="(pack, choice) => emit('toggle', pack, choice)"
        @choose="(pack, choice) => emit('choose', pack, choice)"
      />
      <TableRow v-if="statusText" class="hover:bg-transparent">
        <TableCell
          colspan="7"
          class="py-6 text-center whitespace-normal text-muted-foreground"
          :role="status === 'failed' ? 'alert' : 'status'"
        >
          {{ statusText }}
          <Button
            v-if="status === 'failed'"
            variant="secondary"
            size="md"
            class="ml-2"
            @click="emit('retry')"
          >
            {{ $t('g.retry') }}
          </Button>
        </TableCell>
      </TableRow>
    </TableBody>
  </Table>
</template>

<script setup lang="ts">
import Button from '@comfyorg/design-system/button/Button'
import Table from '@comfyorg/design-system/table/Table'
import TableBody from '@comfyorg/design-system/table/TableBody'
import TableCell from '@comfyorg/design-system/table/TableCell'
import TableHead from '@comfyorg/design-system/table/TableHead'
import TableHeader from '@comfyorg/design-system/table/TableHeader'
import TableRow from '@comfyorg/design-system/table/TableRow'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { NodePack } from '@/platform/workspace/buildCustomNodes/buildCustomNodesTypes'
import NodePackRow from '@/platform/workspace/buildCustomNodes/components/NodePackRow.vue'
import type { NodePackVersionChoice } from '@/platform/workspace/buildCustomNodes/nodePackChoice'
import type {
  NodePackRow as NodePackRowModel,
  NodePackSearchStatus
} from '@/platform/workspace/buildCustomNodes/useNodePackRows'

const { rows, status, query } = defineProps<{
  rows: readonly NodePackRowModel[]
  status: NodePackSearchStatus
  query: string
}>()

const emit = defineEmits<{
  toggle: [pack: NodePack, choice: NodePackVersionChoice]
  choose: [pack: NodePack, choice: NodePackVersionChoice]
  retry: []
}>()

const { t } = useI18n()

const statusText = computed(() => {
  if (status === 'loading') return t('buildCustomNodes.picker.loading')
  if (status === 'failed') return t('buildCustomNodes.picker.searchFailed')
  if (rows.length === 0)
    return t('buildCustomNodes.picker.noMatches', { query })
  return ''
})
</script>
