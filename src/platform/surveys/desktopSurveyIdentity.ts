import { getOrCreateAnonId } from './surveyIdentity'
import type { IdentityProvider, SurveyIdentity } from './surveyIdentity'

interface DesktopSurveyIdentityBridge {
  Surveys?: {
    getIdentity?: () => Promise<Partial<SurveyIdentity> | null>
  }
}

function getDesktopBridge(): DesktopSurveyIdentityBridge | undefined {
  return (window as Window & { __comfyDesktop2?: DesktopSurveyIdentityBridge })
    .__comfyDesktop2
}

export const desktopSurveyIdentityProvider: IdentityProvider = {
  async getIdentity() {
    try {
      const identity = await getDesktopBridge()?.Surveys?.getIdentity?.()
      return {
        ...identity,
        anon_id: identity?.anon_id ?? getOrCreateAnonId()
      }
    } catch {
      return { anon_id: getOrCreateAnonId() }
    }
  }
}
