import { ref } from 'vue'

const lift = ref(0)

/** Screen pixels the toolbox rises by while a bar under it is open. */
export function useSelectionToolboxLift() {
  return { lift }
}
