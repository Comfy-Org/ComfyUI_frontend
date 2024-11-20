<template>
  <FormItem
    :item="setting"
    :id="setting.id"
    :formValue="settingValue"
    @update:formValue="updateSettingValue"
  >
    <template #name-prefix>
      <Tag v-if="setting.experimental" :value="$t('experimental')" />
      <Tag
        v-if="setting.deprecated"
        :value="$t('deprecated')"
        severity="danger"
      />
    </template>
  </FormItem>
</template>

<script setup lang="ts">
import Tag from 'primevue/tag'
import FormItem from '@/components/common/FormItem.vue'
import { useSettingStore } from '@/stores/settingStore'
import { SettingParams } from '@/types/settingTypes'
import { computed } from 'vue'

const props = defineProps<{
  setting: SettingParams
}>()

const settingStore = useSettingStore()
const settingValue = computed(() => settingStore.get(props.setting.id))
const updateSettingValue = (value: any) => {
  settingStore.set(props.setting.id, value)
}
</script>
