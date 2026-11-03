<template>
  <PaginationRoot
    v-model:page="page"
    :total
    :items-per-page
    :sibling-count="1"
    show-edges
  >
    <div class="flex flex-wrap items-center justify-center gap-2">
      <div
        v-if="itemsPerPageOptions?.length"
        class="mr-2 flex items-center gap-2"
      >
        <span class="text-sm text-muted-foreground">
          {{ itemsPerPageLabel }}
        </span>
        <Select
          :model-value="itemsPerPage"
          @update:model-value="updateItemsPerPage"
        >
          <SelectTrigger size="md" class="w-20" :aria-label="itemsPerPageLabel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="option in itemsPerPageOptions"
              :key="option"
              :value="option"
            >
              {{ option }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <PaginationPrev as-child>
        <Button
          variant="muted-textonly"
          size="md"
          class="text-sm"
          :aria-label="previousLabel"
        >
          <i class="icon-[lucide--chevron-left]" />
          {{ previousLabel }}
        </Button>
      </PaginationPrev>
      <PaginationList v-slot="{ items }" class="flex items-center gap-1">
        <template v-for="(item, index) in items" :key="index">
          <PaginationListItem
            v-if="item.type === 'page'"
            :value="item.value"
            as-child
          >
            <Button
              :variant="item.value === page ? 'secondary' : 'muted-textonly'"
              size="icon"
              :aria-label="formatPageLabel(item.value)"
            >
              {{ item.value }}
            </Button>
          </PaginationListItem>
          <PaginationEllipsis v-else :index="index" :class="ellipsisClass">
            …
          </PaginationEllipsis>
        </template>
      </PaginationList>
      <PaginationNext as-child>
        <Button
          variant="muted-textonly"
          size="md"
          class="text-sm"
          :aria-label="nextLabel"
        >
          {{ nextLabel }}
          <i class="icon-[lucide--chevron-right]" />
        </Button>
      </PaginationNext>
    </div>
  </PaginationRoot>
</template>

<script setup lang="ts">
import type { AcceptableValue } from 'reka-ui'
import {
  PaginationEllipsis,
  PaginationList,
  PaginationListItem,
  PaginationNext,
  PaginationPrev,
  PaginationRoot
} from 'reka-ui'

import Button from '@comfyorg/design-system/button/Button'
import Select from '@comfyorg/design-system/select/Select'
import SelectContent from '@comfyorg/design-system/select/SelectContent'
import SelectItem from '@comfyorg/design-system/select/SelectItem'
import SelectTrigger from '@comfyorg/design-system/select/SelectTrigger'
import SelectValue from '@comfyorg/design-system/select/SelectValue'

const { total, itemsPerPageOptions } = defineProps<{
  total: number
  itemsPerPageLabel: string
  previousLabel: string
  nextLabel: string
  formatPageLabel: (page: number) => string
  itemsPerPageOptions?: number[]
}>()

const page = defineModel<number>('page', { default: 1 })
const itemsPerPage = defineModel<number>('itemsPerPage', { default: 10 })

function updateItemsPerPage(value: AcceptableValue) {
  if (typeof value !== 'number') return
  itemsPerPage.value = value
  page.value = 1
}

const ellipsisClass =
  'inline-flex size-8 items-center justify-center text-sm text-muted-foreground'
</script>
