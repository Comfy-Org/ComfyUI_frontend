import { useCommandStore } from '@/stores/commandStore'

export function useLinearRunPrompt() {
  const commandStore = useCommandStore()

  async function runPrompt(e: Event) {
    const isShiftPressed = 'shiftKey' in e && e.shiftKey
    const commandId = isShiftPressed
      ? 'Comfy.QueuePromptFront'
      : 'Comfy.QueuePrompt'
    await commandStore.execute(commandId, {
      metadata: { subscribe_to_run: false, trigger_source: 'linear' }
    })
  }

  return { runPrompt }
}
