import { isCloud } from '@/platform/distribution/types'

import './clipspace'
import './contextMenuFilter'
import './dynamicPrompts'
import './editAttention'
import './electronAdapter'
import './groupNode'
import './groupNodeManage'
import './groupOptions'
import './load3d'
import './maskeditor'
import './nodeTemplates'
import './noteNode'
import './previewAny'
import './rerouteNode'
import './saveImageExtraOutput'
import './saveMesh'
import './selectionBorder'
import './simpleTouchSupport'
import './slotDefaults'
import './uploadAudio'
import './uploadImage'
import './webcamCapture'
import './widgetInputs'

// Cloud-only extensions - tree-shaken in OSS builds
if (isCloud) {
  await import('./cloudRemoteConfig')
  await import('./cloudBadges')

  if (window.__CONFIG__?.subscription_required) {
    await import('./cloudSubscription')
  }
}
