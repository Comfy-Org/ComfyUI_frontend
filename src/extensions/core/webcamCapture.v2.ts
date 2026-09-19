/**
 * WebcamCapture — rewritten with the v2 extension API.
 *
 * v1: registers the `WEBCAM` custom widget type via `getCustomWidgets()`
 *     returning `node.addDOMWidget(name, 'WEBCAM', container)`, then a
 *     separate `nodeCreated` reaches into `node.widgets` to wire the
 *     capture button and `serializeValue` override.
 *
 * v2: registers the `WEBCAM` widget type via `defineWidget({ type, mount })`
 *     per **Axiom A12** — the mount-lifecycle hook is the sole DOM seam.
 *     The mount body captures `host` (and the constructed `<video>`) via
 *     closure; there is no `widget.element` accessor on `WidgetHandle`.
 *     Cleanup stops the camera stream when the widget is destroyed
 *     (D-widget-converge §Clarification 1: cleanup = destruction-only).
 *
 * The `nodeCreated` half of the v1 extension (wiring the capture button +
 * serializeValue override) surfaces several gaps already tracked under
 * I-COORD.1 — see GAP comments inline.
 */

import { defineNode, defineWidget, type NodeHandle } from '@/extension-api'

// ── defineWidget — Axiom A12 mount-lifecycle seam ───────────────────────────

export default defineWidget({
  name: 'Comfy.WebcamCapture.V2.Widget',
  type: 'WEBCAM',

  mount(host, ctx) {
    const container = document.createElement('div')
    container.style.background = 'rgba(0,0,0,0.25)'
    container.style.textAlign = 'center'

    const video = document.createElement('video')
    video.style.height = video.style.width = '100%'

    let stream: MediaStream | null = null

    const loadVideo = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        })
        container.replaceChildren(video)
        video.srcObject = stream
        await video.play()
      } catch (error) {
        const label = document.createElement('div')
        label.style.color = 'red'
        label.style.overflow = 'auto'
        label.style.maxHeight = '100%'
        label.style.whiteSpace = 'pre-wrap'

        const message = error instanceof Error ? error.message : String(error)
        label.textContent = window.isSecureContext
          ? `Unable to load webcam, please ensure access is granted:\n${message}`
          : `Unable to load webcam. A secure context is required, if you are not accessing ComfyUI on localhost (127.0.0.1) you will have to enable TLS (https)\n\n${message}`

        container.replaceChildren(label)
      }
    }

    host.appendChild(container)
    void loadVideo()

    // Re-bind the video element to the new host on remount (graph ↔ app
    // mode swap, subgraph promotion). Mount body is NOT re-invoked per
    // D-widget-converge §Clarification 1.
    ctx.onAfterRemount((newHost) => {
      newHost.appendChild(container)
    })

    // Destruction-only cleanup: stop the camera stream + release tracks.
    return () => {
      stream?.getTracks().forEach((t) => t.stop())
      stream = null
      video.srcObject = null
      container.remove()
    }
  }
})

// ── Companion defineNode — capture button + serializeValue wiring ──────────
//
// The `WebcamCapture` node-side logic still has open v2 surface gaps:
//   GAP-2  (I-COORD.1): no type-construction `addWidget('button', …)` on
//          NodeHandle — the v1 path adds a button programmatically inside
//          `nodeCreated` to drive `capture()`.
//   GAP-11 (new):       no `widget.serializeValue = async () => …` setter
//          on WidgetHandle. The v2 path is `widget.on('beforeSerialize',
//          e => e.setSerializedValue(…))`, but the v1 override is *async*
//          (uploads to /upload/image and awaits the response); the
//          `beforeSerialize` payload shape (D5) does not yet promise async
//          resolution. Tracked separately — do not unblock here.
// Until those land, the node-side companion stays a v1 extension. The
// `defineNode` below is a placeholder that registers the type filter so
// downstream tooling can correlate the v2 widget registration with the
// node that consumes it.

defineNode({
  name: 'Comfy.WebcamCapture.V2.Node',
  nodeTypes: ['WebcamCapture'],

  nodeCreated(_node: NodeHandle) {
    // Wiring deferred — see GAP-2 / GAP-11 above. The v1 extension's
    // nodeCreated body remains the authoritative implementation until
    // those gaps close.
  }
})
