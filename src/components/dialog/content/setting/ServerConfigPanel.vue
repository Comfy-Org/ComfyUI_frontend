<template>
  <div
    v-for="([label, items], i) in Object.entries(serverConfigGroup)"
    :key="label"
  >
    <Divider v-if="i > 0" />
    <h3>{{ formatCamelCase(label) }}</h3>
    <div v-for="item in items" :key="item.name" class="flex items-center mb-4">
      <FormItem :item="item" :form-value="item.defaultValue" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import FormItem from '@/components/common/FormItem.vue'
import { formatCamelCase } from '@/utils/formatUtil'
import { SERVER_CONFIG_ITEMS, ServerConfig } from '@/constants/serverConfig'

const serverConfigGroup: Record<string, ServerConfig<any>[]> =
  SERVER_CONFIG_ITEMS.reduce((acc, item) => {
    const category = item.category?.[0] ?? 'General'
    acc[category] = acc[category] || []
    acc[category].push(item)
    return acc
  }, {})
</script>
