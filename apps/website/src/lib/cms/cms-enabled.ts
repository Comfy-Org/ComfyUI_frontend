import { catalogApiOrigin } from './catalog-origin'

// Server-only configuration. Browser islands read same-origin JSON endpoints.
// On in deployed previews (the site's own Cloud base URL) and wherever
// SITE_CATALOG_API_URL is set; production keeps the static Hub regardless.
export const cmsEnabled = () => Boolean(catalogApiOrigin())
