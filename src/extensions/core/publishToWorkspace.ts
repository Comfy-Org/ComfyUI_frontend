import { t } from '@/i18n'
import type { LGraphNode } from '@/lib/litegraph/src/litegraph'
import { useExtensionService } from '@/services/extensionService'

/**
 * Media save nodes that can publish their outputs to a team workspace. This is
 * the media subset of the core save-node list in
 * {@link ./saveImageExtraOutput.ts} — model/latent saves are intentionally
 * excluded.
 */
const MEDIA_SAVE_NODES = new Set([
  'SaveImage',
  'SaveImageAdvanced',
  'SaveSVGNode',
  'SaveVideo',
  'SaveWEBM',
  'SaveAnimatedWEBP',
  'SaveAnimatedPNG',
  'SaveAudio',
  'SaveAudioMP3',
  'SaveAudioOpus',
  'SaveAudioAdvanced',
  'SaveGLB'
])

const WIDGET_NAME = 'publish_to_workspace'

/**
 * Adds a "Share with team" toggle to media save nodes, off by default.
 *
 * VISIBILITY — currently shown to ALL users. This toggle should only be shown to
 * users who are currently in a cloud team workspace, gated the same way as the
 * topbar workspace indicator (`showWorkspaceIcon` in CurrentUserButton.vue:
 * `isCloud && flags.teamWorkspacesEnabled && initState === 'ready' &&
 * !isInPersonalWorkspace`). That gate is omitted for now only because team
 * workspaces are impractical to activate in staging — it must be restored before
 * production so the toggle does not show for everyone.
 *
 * REFERENCE BUILD — the toggle is a frontend-only, session-scoped flag: kept out
 * of the workflow JSON and the API prompt (the backend save node has no such
 * input). Wiring the actual publish is a follow-up: when a real publish endpoint
 * exists, read this value on the `executed` event and share the node's outputs
 * via useAssetVisibilityStore (see feat/media-assets-publish-share).
 */
useExtensionService().registerExtension({
  name: 'Comfy.PublishToWorkspace',

  nodeCreated(node: LGraphNode) {
    if (!MEDIA_SAVE_NODES.has(node.constructor.comfyClass ?? '')) return

    const widget = node.addWidget('toggle', WIDGET_NAME, false, () => {}, {})
    widget.label = t('publishToWorkspace.widgetLabel')
    widget.serialize = false
    widget.options.serialize = false
  }
})
