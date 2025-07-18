/**
 * Base domain configuration and core website URLs
 * Forkers can change the base domain to use their own
 */
export const COMFY_BASE_DOMAIN =
  process.env.VITE_COMFY_BASE_DOMAIN || 'comfy.org'

const WEBSITE_BASE_URL = `https://www.${COMFY_BASE_DOMAIN}`

export const COMFY_WEBSITE_URLS = {
  base: WEBSITE_BASE_URL,
  termsOfService: `${WEBSITE_BASE_URL}/terms-of-service`,
  privacy: `${WEBSITE_BASE_URL}/privacy`
}
