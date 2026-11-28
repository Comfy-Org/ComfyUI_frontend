import { zComfyApiWorkflow } from '@comfyorg/graph-model/workflowSchema'

import { useApp } from '@/scripts/appInstance'

export async function importApiPrompt(data: unknown, name: string) {
  const parsed = zComfyApiWorkflow.safeParse(data)
  if (!parsed.success || !Object.keys(parsed.data).length) return false
  const prompt = parsed.data
  for (const node of Object.values(prompt)) {
    for (const field of Object.keys(node.inputs)) {
      if (/^(api_key_comfy_org|auth_token_comfy_org)$/i.test(field))
        delete node.inputs[field]
    }
  }
  return (await useApp().loadApiJson(prompt, name)) !== false
}
