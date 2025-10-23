import { isCloud } from '@/platform/distribution/types'

/**
 * Auth service worker registration (cloud-only).
 * Tree-shaken for desktop/localhost builds via compile-time constant.
 */
if (isCloud) {
  void import('./register')
}
