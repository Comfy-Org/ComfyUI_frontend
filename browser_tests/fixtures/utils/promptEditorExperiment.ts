import type { ComfyPage } from '@e2e/fixtures/ComfyPage'
import type { CapturedTelemetryEvent } from '@e2e/fixtures/hostTelemetryFixture'

export function promptNodes(comfyPage: ComfyPage) {
  return comfyPage.vueNodes.getNodeByTitle('CLIP Text Encode (Prompt)')
}

export async function expandPrompt(comfyPage: ComfyPage, index: number) {
  const node = promptNodes(comfyPage).nth(index)
  await node.getByRole('textbox', { name: 'text' }).hover()
  await node.getByRole('button', { name: 'Expand' }).click()
}

export function promptEditorEvents(events: CapturedTelemetryEvent[]) {
  return events.filter(({ event }) => event.startsWith('app:prompt_editor_'))
}
