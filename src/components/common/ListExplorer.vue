<template>
  <div class="h-full overflow-hidden pb-1">
    <div class="flex item-center">
      <div
        v-for="item in columns"
        :key="item.key"
        class="flex justify-between items-center px-2 overflow-hidden hover:bg-blue-600/40 cursor-pointer"
        :style="{ flexBasis: `${item.width}px`, height: '36px' }"
        @click="changeSort(item)"
      >
        <span class="whitespace-nowrap overflow-hidden text-ellipsis">
          {{ $t(`g.${item.key}`) }}
        </span>
        <span
          v-show="item.key === sortField"
          :class="[
            'text-xs pi',
            sortDirection === 'asc' ? 'pi-angle-up' : 'pi-angle-down'
          ]"
        ></span>
      </div>
    </div>
    <div :style="{ height: 'calc(100% - 36px)' }">
      <VirtualScroll :items="sortedItems" :item-size="36">
        <template #item="{ item: row }">
          <div
            class="h-full py-px"
            @click="emit('itemClick', row, $event)"
            @dblclick="emit('itemDbClick', row, $event)"
          >
            <div
              :class="[
                'flex items-center h-full hover:bg-blue-600/40',
                selectedKeys.includes(row.key) ? 'bg-blue-700/40' : ''
              ]"
            >
              <div
                v-for="(item, index) in columns"
                :key="item.key"
                class="flex items-center px-2 py-1 overflow-hidden select-none"
                :style="{ flexBasis: `${item.width}px`, textAlign: item.align }"
              >
                <span v-if="index === 0" :class="['mr-2 pi', row.icon]"></span>
                <span class="whitespace-nowrap overflow-hidden text-ellipsis">
                  {{ row._display[item.key] }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </VirtualScroll>
    </div>
  </div>
</template>

<script setup lang="ts" generic="T">
import { computed, provide, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { formatSize } from '@/utils/formatUtil'

import VirtualScroll from './VirtualScroll.vue'

const { t } = useI18n()

type SortDirection = 'asc' | 'desc'

type Item = {
  key: string
  name: string
  type: string
  modifyTime: number
  size: number
}

type RecordString<T> = {
  [key in keyof T]: T[key]
}

type ResolvedItem<T> = T & {
  icon: string
  _display: RecordString<T>
}

interface Column {
  key: string
  width: number
  align?: 'left' | 'right'
  defaultSort?: SortDirection
  renderText: (val: any, row: Item) => string
}

const props = defineProps<{
  items: Item[]
}>()

const selectedKeys = defineModel<string[]>({ default: [] })

const emit = defineEmits<{
  itemClick: [Item, MouseEvent]
  itemDbClick: [Item, MouseEvent]
}>()

const columns = ref<Column[]>([
  {
    key: 'name',
    width: 300,
    renderText: (val) => val
  },
  {
    key: 'modifyTime',
    width: 200,
    defaultSort: 'desc',
    renderText: (val) =>
      new Date(val).toLocaleDateString() +
      ' ' +
      new Date(val).toLocaleTimeString()
  },
  {
    key: 'type',
    width: 100,
    renderText: (val) => t(`g.${val}`)
  },
  {
    key: 'size',
    width: 120,
    defaultSort: 'desc',
    align: 'right',
    renderText: (val, item) => (item.type === 'folder' ? '' : formatSize(val))
  }
])

provide('listExplorerColumns', columns)

const sortDirection = ref<SortDirection>('asc')
const sortField = ref('name')

const iconMapLegacy = (icon: string) => {
  const prefix = 'pi-'
  const legacy = {
    audio: 'headphones'
  }
  return prefix + (legacy[icon] || icon)
}

const renderedItems = computed(() => {
  const columnRenderText = columns.value.reduce((acc, column) => {
    acc[column.key] = column.renderText
    return acc
  }, {})

  return props.items.map((item) => {
    const display = Object.entries(item).reduce((acc, [key, value]) => {
      acc[key] = columnRenderText[key]?.(value, item) ?? value
      return acc
    }, {} as RecordString<Item>)
    return { ...item, icon: iconMapLegacy(item.type), _display: display }
  })
})

const sortedItems = computed(() => {
  const folderItems: ResolvedItem<Item>[] = []
  const fileItems: ResolvedItem<Item>[] = []

  for (const item of renderedItems.value) {
    if (item.type === 'folder') {
      folderItems.push(item)
    } else {
      fileItems.push(item)
    }
  }

  const direction = sortDirection.value === 'asc' ? 1 : -1

  const sorting = (a: ResolvedItem<Item>, b: ResolvedItem<Item>) => {
    const aValue = a[sortField.value]
    const bValue = b[sortField.value]

    const result =
      typeof aValue === 'string'
        ? aValue.localeCompare(bValue)
        : aValue - bValue

    return result * direction
  }

  folderItems.sort(sorting)
  fileItems.sort(sorting)

  const folderFirstField = ['modifyTime', 'type']
  return direction > 0 || folderFirstField.includes(sortField.value)
    ? [...folderItems, ...fileItems]
    : [...fileItems, ...folderItems]
})

const changeSort = (column: Column) => {
  if (column.key === sortField.value) {
    sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = column.key
    sortDirection.value = column.defaultSort ?? 'asc'
  }
}
</script>
