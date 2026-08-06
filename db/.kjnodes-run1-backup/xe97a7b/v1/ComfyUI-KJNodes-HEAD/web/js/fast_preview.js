import { comfy } from '/comfy/api/v1.js';

comfy.defs.extend('FastPreview', (b) => {
  // Per-node preview state. Handles hold no arbitrary properties, and the
  // entry is dropped in onRemoved.
  const previews = new Map();

  b.onCreated((node) => {
    node.setSize({ width: 550, height: 550 });

    const state = { img: null };
    state.canvas = node.widgets.canvas({
      name: 'preview',
      draw(ctx, [w, h]) {
        const img = state.img;
        if (!img) return;
        const scale = Math.min(w / img.width, h / img.height);
        const dw = img.width * scale, dh = img.height * scale;
        ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      },
    });
    previews.set(node.id, state);
  });

  // onPreview answers "is this frame mine?" for us — the `executing` global,
  // the displayNodeId test and the supports_preview_metadata probe all go away.
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
