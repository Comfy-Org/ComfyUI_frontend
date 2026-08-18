import { ref } from 'vue'

// Shared inline-rename state so both the header (double-click) and the
// workspace menu ("Rename") drive the same editing affordance.
const isRenaming = ref(false)

export function useWorkspaceRename() {
  function startRenaming() {
    isRenaming.value = true
  }

  function stopRenaming() {
    isRenaming.value = false
  }

  return { isRenaming, startRenaming, stopRenaming }
}
