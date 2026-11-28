import { z } from 'zod'

import type { JobDetail } from '@comfyorg/api-client/jobTypes'

/** `comfy_usage_source` stamped on jobs submitted by Comfy MCP. */
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
