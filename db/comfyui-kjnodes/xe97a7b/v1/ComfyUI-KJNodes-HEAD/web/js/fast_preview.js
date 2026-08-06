import { comfy } from '/comfy/api/v1.js';

// Per-node preview state. Handles hold no arbitrary properties, and a Map entry
// is dropped explicitly in onRemoved rather than collected with the node.
const previews = new Map();

comfy.defs.extend('FastPreview', (b) => {
  b.onCreated((node) => {
    node.setSize({ width: 550, height: 550 });

    const state = { img: null };
    state.canvas = node.widgets.canvas({
      name: 'preview',
      draw(ctx, [w, h]) {
        const img = state.img;
        if (!img) return;
        const s = Math.min(w / img.width, h / img.height);
        const dw = img.width * s, dh = img.height * s;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      },
    });
    previews.set(node.id, state);
  });

  // Already correlated to this node, so the module-level `execId`, the two
  // raw socket listeners and the supports_preview_metadata probe all go away.
  b.onPreview((node, frame) => {
    const state = previews.get(node.id);
    if (!state) return;
    const img = new Image();
    img.onload = () => { state.img = img; state.canvas.redraw(); };
    img.src = URL.createObjectURL(frame.blob);
  });

  b.onRemoved((node) => {
    previews.delete(node.id);
  });
});
