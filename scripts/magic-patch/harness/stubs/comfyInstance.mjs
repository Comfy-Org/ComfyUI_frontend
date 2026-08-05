/** The real published API, bound to the harness graph. */
import { useComfyApi } from '@/platform/nodeApi/comfyApi'

import { registry } from './registry.mjs'

export const comfy = useComfyApi(() => registry.graph)
