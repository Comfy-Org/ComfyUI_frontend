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
          <TableCell>{{ packName(pack) }}</TableCell>
          <TableCell class="text-right">
            <Switch
              :model-value="enabledByPath[pack]"
              :aria-label="
                $t('g.extensionPackToggle', { name: packName(pack) })
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
import Switch from '@/components/ui/switch/Switch.vue'
import Table from '@/components/ui/table/Table.vue'
import TableBody from '@/components/ui/table/TableBody.vue'
import TableCell from '@/components/ui/table/TableCell.vue'
import TableHead from '@/components/ui/table/TableHead.vue'
import TableHeader from '@/components/ui/table/TableHeader.vue'
import TableRow from '@/components/ui/table/TableRow.vue'

const { packs, enabledByPath } = defineProps<{
  packs: string[]
  enabledByPath: Record<string, boolean>
}>()

const emit = defineEmits<{
  setEnabled: [path: string, enabled: boolean]
}>()

function packName(path: string) {
  return path.split('/').filter(Boolean).at(-1) ?? path
}
</script>
