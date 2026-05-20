import { computed, ref } from 'vue'

export function useZoomControls() {
  const isModalVisible = ref(false)

  function showModal() {
    isModalVisible.value = true
  }

  function hideModal() {
    isModalVisible.value = false
  }

  function toggleModal() {
    isModalVisible.value = !isModalVisible.value
  }

  const hasActivePopup = computed(() => isModalVisible.value)

  return {
    isModalVisible,
    showModal,
    hideModal,
    toggleModal,
    hasActivePopup
  }
}
