<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import Pagination from '@/components/ui/pagination/Pagination.vue'

defineProps<{
  total: number
  itemsPerPageOptions?: number[]
}>()

const page = defineModel<number>('page', { default: 1 })
const itemsPerPage = defineModel<number>('itemsPerPage', { default: 10 })
const { t } = useI18n()
</script>

<template>
  <Pagination
    v-model:page="page"
    v-model:items-per-page="itemsPerPage"
    :total
    :items-per-page-options
    :items-per-page-label="t('g.itemsPerPage')"
    :previous-label="t('g.previous')"
    :next-label="t('g.next')"
    :format-page-label="(page) => t('g.pageNumber', { page })"
  />
</template>
