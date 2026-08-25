import type {
  ComfyDesktop2Bridge,
  ComfyTemplateInputAsset
} from '@comfyorg/comfyui-desktop-bridge-types'

type BridgeProvider = () => ComfyDesktop2Bridge | undefined

export async function resolveTemplateInputAssets(
  templateId: string,
  getBridge: BridgeProvider
): Promise<readonly ComfyTemplateInputAsset[]> {
  const bridge = getBridge()
  if (!bridge?.getTemplateInputAssets || bridge.isRemote()) return []

  try {
    return (await bridge.getTemplateInputAssets(templateId)) ?? []
  } catch {
    return []
  }
}

export function startMissingTemplateInputDownloads(
  templateId: string,
  assets: readonly ComfyTemplateInputAsset[],
  {
    getBridge,
    reportError
  }: {
    getBridge: BridgeProvider
    reportError: (error: unknown) => void
  }
): void {
  const missingAssets = assets.filter(
    ({ availability }) => availability === 'missing'
  )
  if (!missingAssets.length) return

  const bridge = getBridge()
  const downloadInput = bridge?.downloadTemplateInputAsset
  if (!downloadInput || bridge.isRemote()) {
    reportError(new Error('Template input download bridge unavailable'))
    return
  }

  let firstError: unknown
  const attempts = missingAssets.map(async ({ assetId }) => {
    try {
      const result = await downloadInput(templateId, assetId)
      if (result.status === 'not-started' && !firstError) {
        firstError = new Error(
          `Template input download not started: ${result.reason}`
        )
      }
    } catch (error) {
      firstError ??= error
    }
  })

  void Promise.all(attempts).then(() => {
    if (firstError) reportError(firstError)
  })
}
