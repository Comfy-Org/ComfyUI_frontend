import type { PreviewExposureIdentity } from './previewExposureTypes'

/**
 * Construct a {@link PreviewExposureIdentity}.
 *
 * Use {@link createNodeLocatorId} from `@/types/nodeIdentification` to build
 * the `hostNodeLocator` from a root graph id and host node id.
 */
export function makePreviewExposureIdentity(
  hostNodeLocator: string,
  previewName: string
): PreviewExposureIdentity {
  return { hostNodeLocator, previewName }
}

export function previewExposureIdentityEquals(
  a: PreviewExposureIdentity | undefined,
  b: PreviewExposureIdentity | undefined
): boolean {
  if (!a || !b) return false
  return (
    a.hostNodeLocator === b.hostNodeLocator && a.previewName === b.previewName
  )
}

export function previewExposureIdentityKey(
  identity: PreviewExposureIdentity
): string {
  return `${identity.hostNodeLocator}::${identity.previewName}`
}
