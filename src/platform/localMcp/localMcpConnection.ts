import { z } from 'zod'

import type { JobDetail } from '@comfyorg/api-client/jobTypes'

/**
 * `comfy_usage_source` that comfy-cli stamps on every prompt it submits when
 * the caller self-attributes as `comfy-mcp` (comfy-mcp sets
 * `COMFY_USER_AGENT=comfy-mcp` on each comfy-cli spawn; comfy-cli maps agentic
 * callers to `comfy-cli/<kind>`). ComfyUI keeps it in the job's `extra_data`.
 */
export const LOCAL_MCP_USAGE_SOURCE = 'comfy-cli/comfy-mcp'

const zJobAttribution = z.object({
  extra_data: z
    .object({ comfy_usage_source: z.string().optional().catch(undefined) })
    .nullish()
})

export function readJobUsageSource(
  detail: JobDetail | undefined
): string | undefined {
  const parsed = zJobAttribution.safeParse(detail?.workflow)
  return parsed.success ? parsed.data.extra_data?.comfy_usage_source : undefined
}
