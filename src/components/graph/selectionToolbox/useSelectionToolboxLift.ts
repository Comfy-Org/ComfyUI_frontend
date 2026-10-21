import { ref } from 'vue'

const lift = ref(0)

/** Screen pixels the selection toolbox rises by, so a popover under it opens beneath the cursor. */
export function useSelectionToolboxLift() {
  return { lift }
}
