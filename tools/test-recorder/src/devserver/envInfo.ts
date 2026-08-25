export type EnvInfoResult =
  | {
      ok: true
      cloudVersion: string
      comfyuiVersion: string
      deployEnvironment: string
    }
  | { ok: false }

interface SystemStatsResponse {
  system?: {
    cloud_version?: unknown
    comfyui_version?: unknown
    deploy_environment?: unknown
  }
}

export async function fetchEnvInfo(
  backendUrl: string,
  timeoutMs = 2500
): Promise<EnvInfoResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(new URL('api/system_stats', backendUrl), {
      signal: controller.signal
    })
    if (!response.ok) return { ok: false }
    const data: unknown = await response.json()
    if (typeof data !== 'object' || data === null) return { ok: false }
    const system = (data as SystemStatsResponse).system
    if (
      typeof system?.cloud_version !== 'string' ||
      typeof system.comfyui_version !== 'string' ||
      typeof system.deploy_environment !== 'string'
    ) {
      return { ok: false }
    }
    return {
      ok: true,
      cloudVersion: system.cloud_version,
      comfyuiVersion: system.comfyui_version,
      deployEnvironment: system.deploy_environment
    }
  } catch {
    return { ok: false }
  } finally {
    clearTimeout(timeout)
  }
}
