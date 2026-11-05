import { toError } from '@comfyorg/shared-frontend-utils/errorUtil'

/** Sentry fingerprint for a prompt build failure, with node ids and slot indexes removed. */
export function promptBuildErrorFingerprint(error: unknown): string[] {
  const { name, message } = toError(error)
  const shape = message.replace(/\[[^\]]*\]/g, '[]').replace(/\d+/g, 'N')
  return ['error_building_prompt', name, shape]
}
