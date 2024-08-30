<script setup lang="ts">
import { useSettingStore } from '@/stores/settingStore'
import { onMounted, onUnmounted } from 'vue'

const settingStore = useSettingStore()
const handleBeforeUnload = (event: BeforeUnloadEvent) => {
  if (settingStore.get('Comfy.Window.UnloadConfirmation')) {
    event.preventDefault()
    return true
  }
  return undefined
}

onMounted(() => {
  window.addEventListener('beforeunload', handleBeforeUnload)
})

onUnmounted(() => {
  window.removeEventListener('beforeunload', handleBeforeUnload)
})
</script>
