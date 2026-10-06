import { captureVfxLandingCtaClicked } from '@/scripts/posthog'

/** Marks the page regions whose contact links count as the primary CTA. */
const VFX_CTA_ZONE_ATTRIBUTE = 'data-vfx-cta'

/**
 * Reports `website:vfx_landing_cta_clicked` when a visitor clicks a link in
 * a marked region. Delegated on the document so the zones stay plain markup
 * and the link keeps its full href, query string included.
 */
export function trackVfxCtaClicks(doc: Document = document): () => void {
  const onClick = ({ target }: MouseEvent) => {
    if (!(target instanceof Element)) return
    if (!target.closest(`[${VFX_CTA_ZONE_ATTRIBUTE}] a[href]`)) return
    captureVfxLandingCtaClicked()
  }
  doc.addEventListener('click', onClick, true)
  return () => doc.removeEventListener('click', onClick, true)
}
