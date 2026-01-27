import { isCloud, isNightly } from '@/platform/distribution/types'

import './clipspace'
import './contextMenuFilter'
import './customWidgets'
import './dynamicPrompts'
import './editAttention'
import './electronAdapter'
import './groupNode'
import './groupNodeManage'
import './groupOptions'
import './imageCompare'
import './imageCrop'
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
  await import('./cloudSessionCookie')

  if (window.__CONFIG__?.subscription_required) {
    await import('./cloudSubscription')
  }
}

// Feedback button for cloud and nightly builds
if (isCloud || isNightly) {
  await import('./cloudFeedbackTopbarButton')
}

// Nightly-only extensions
if (isNightly && !isCloud) {
  await import('./nightlyBadges')
}
