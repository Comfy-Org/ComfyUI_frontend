import { isCloud, isNightly } from '@/platform/distribution/types'

import './clipspace'
import './contextMenuFilter'
import './createBoundingBoxes'
import './customWidgets'
import './dynamicPrompts'
import './editAttention'
import './electronAdapter'
import './groupNode'
import './groupOptions'
import './imageCompare'
import './imageCompositor'
import './imageCrop'
import './layerEditor'
// load3d and saveMesh are loaded on-demand to defer THREE.js (~1.8MB)
// The lazy loader triggers loading when a 3D node is used
import './load3dLazy'
import './maskeditor'
if (!isCloud) {
  await import('./nodeTemplates')
}
import './noteNode'
import './painter'
import './previewAny'
import './saveText'
import './rerouteNode'
import './saveImageExtraOutput'
// saveMesh is loaded on-demand with load3d (see load3dLazy.ts)
import './selectionBorder'
import './simpleTouchSupport'
import './slotDefaults'
import './uploadAudio'
import './uploadImage'
import './webcamCapture'
import './widgetInputs'

// Cloud-only extensions - tree-shaken in OSS builds
// The literal __DISTRIBUTION__ comparison (not the isCloud const) is what
// dead-code-eliminates this block and its posthog-js import from OSS builds.
if (__DISTRIBUTION__ === 'cloud') {
  await import('./cloudRemoteConfig')
  const { registerAgentPanelExtension } = await import('./agentPanel')
  registerAgentPanelExtension()
  await import('./cloudBadges')
  await import('./cloudSessionCookie')
} else if (import.meta.env.VITE_AGENT_STANDALONE === 'true') {
  // The local agent harness mounts the panel in any distribution.
  const { registerAgentPanelExtension } = await import('./agentPanel')
  registerAgentPanelExtension()
}

// Feedback button for cloud and nightly builds
if (isCloud || isNightly) {
  await import('./cloudFeedbackTopbarButton')
}

// Nightly-only extensions
if (isNightly && !isCloud) {
  await import('./nightlyBadges')
}
