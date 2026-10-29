import type { CloudWorkflowGaps } from '@/platform/openOnCloud/cloudWorkflowCheck'

/** A prompt for a coding agent to get the open workflow running on Comfy Cloud. */
export function runOnCloudPrompt({ nodePacks, models }: CloudWorkflowGaps) {
  return [
    '# Run this ComfyUI workflow on Comfy Cloud',
    '',
    'Help the user run the workflow open in their local ComfyUI on Comfy Cloud.',
    'Work on a copy, and leave their original as it is.',
    '',
    'Comfy Cloud lacks:',
    ...nodePacks.map((pack) => `- the node pack ${pack}`),
    ...models.map((model) => `- the model ${model.name} (${model.folder})`),
    '',
    'For each node from a missing pack, find a node Comfy Cloud has that does',
    'the same job, or offer a custom Build that has the pack. Ask the user',
    'before a swap that changes the output, and before you upload any file.'
  ].join('\n')
}
