/** Custom node packs' repository names, by registry id, as the repository's pack lists spell them. */
const NODE_PACK_NAMES: Readonly<Record<string, string>> = {
  'comfyui-depthanythingv2': 'ComfyUI-DepthAnythingV2',
  'comfyui-gimm-vfi': 'ComfyUI-GIMM-VFI',
  'comfyui-kjnodes': 'ComfyUI-KJNodes',
  'comfyui-liveportraitkj': 'ComfyUI-LivePortraitKJ',
  'comfyui-videohelpersuite': 'ComfyUI-VideoHelperSuite',
  'comfyui_fill-chatterbox': 'ComfyUI_Fill-ChatterBox',
  'comfyui_fill-nodes': 'ComfyUI_Fill-Nodes',
  'controlaltai-nodes': 'ControlAltAI-Nodes'
}

/** A pack's display name: the known name, else its repository, else its id. */
export function nodePackName(registryId: string, repoName?: string): string {
  const key = registryId.toLowerCase()
  return Object.hasOwn(NODE_PACK_NAMES, key)
    ? NODE_PACK_NAMES[key]
    : repoName || registryId
}
