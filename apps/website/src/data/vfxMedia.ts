export const vfxMediaRoot =
  'https://media.comfy.org/website/vfx/v3/2026-10-19-43beb0de27'

export const vfxRedSkyMedia = {
  video:
    'https://media.comfy.org/website/vfx/v3/2026-10-20-red-sky-2f96a729/relight-red-sky-meteors-2f96a729.mp4',
  poster:
    'https://media.comfy.org/website/vfx/v3/2026-10-20-red-sky-2f96a729/relight-red-sky-meteors-2f96a729-og.jpg',
  share:
    'https://media.comfy.org/website/vfx/v3/2026-10-20-red-sky-2f96a729/relight-red-sky-meteors-2f96a729-og.gif'
}

/** Preserve stable variant IDs while replacing only the approved Blue hour clip. */
export function vfxVariantMedia(
  id: string | undefined,
  kind: 'jpg' | 'mp4'
): string {
  if (id === 'relight_blue')
    return kind === 'mp4' ? vfxRedSkyMedia.video : vfxRedSkyMedia.poster
  return `${vfxMediaRoot}/${id}.${kind}`
}
