/**
 * Runtime environment configuration that determines if we're in production or staging
 * based on the hostname. Replaces the build-time __USE_PROD_CONFIG__ constant.
 */

/**
 * Checks if the application is running in production environment
 * @returns true if hostname is cloud.comfy.org (production), false otherwise (staging)
 */
export function isProductionEnvironment(): boolean {
  // In SSR/Node.js environments or during build, use the environment variable
  if (typeof window === 'undefined') {
    return process.env.USE_PROD_CONFIG === 'true'
  }

  // In browser, check the hostname
  return window.location.hostname === 'cloud.comfy.org'
}
