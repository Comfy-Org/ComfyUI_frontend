<template>
  <Message
    v-if="show"
    class="first-time-ui-message"
    severity="info"
    :closable="true"
    @close="handleClose"
  >
    {{ $t('g.firstTimeUIMessage') }}
  </Message>
</template>

<script setup lang="ts">
import Message from 'primevue/message'
import { computed } from 'vue'

import { useSettingStore } from '@/stores/settingStore'

const settingStore = useSettingStore()
const show = computed(() => !settingStore.exists('Comfy.UseNewMenu'))
const handleClose = async () => {
  // Explicitly write the current value to the store.
  const currentValue = settingStore.get('Comfy.UseNewMenu')
  await settingStore.set('Comfy.UseNewMenu', currentValue)
}
</script>
