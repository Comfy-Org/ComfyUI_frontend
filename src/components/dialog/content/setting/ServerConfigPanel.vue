<template>
  <div
    v-for="([label, items], i) in Object.entries(serverConfigsByCategory)"
    :key="label"
  >
    <Divider v-if="i > 0" />
    <h3>{{ formatCamelCase(label) }}</h3>
    <div v-for="item in items" :key="item.name" class="flex items-center mb-4">
      <FormItem :item="item" v-model:formValue="item.value" />
    </div>
  </div>
</template>

<script setup lang="ts">
import Divider from 'primevue/divider'
import FormItem from '@/components/common/FormItem.vue'
import { formatCamelCase } from '@/utils/formatUtil'
import { useSettingStore } from '@/stores/settingStore'
import { useServerConfigStore } from '@/stores/serverConfigStore'
import { storeToRefs } from 'pinia'
import { onMounted, watch } from 'vue'
import { SERVER_CONFIG_ITEMS } from '@/constants/serverConfig'

const settingStore = useSettingStore()
const serverConfigStore = useServerConfigStore()
const { serverConfigsByCategory, launchArgs, serverConfigValues } =
  storeToRefs(serverConfigStore)

onMounted(() => {
  serverConfigStore.loadServerConfig(
    SERVER_CONFIG_ITEMS,
    settingStore.get('Comfy.Server.ServerConfigValues')
  )
})

watch(launchArgs, (newVal) => {
  settingStore.set('Comfy.Server.LaunchArgs', newVal)
})

watch(serverConfigValues, (newVal) => {
  settingStore.set('Comfy.Server.ServerConfigValues', newVal)
})
</script>
