# GPU Brush Rendering: Photoshop-Like Vertex Splatter Implementation Plan

## Photoshop's Brush System: How It Works (High-Performance Native GPU Rendering)

Photoshop (and pro apps like Krita/Clip Studio) uses a **vertex-driven splatting pipeline** optimized for real-time stroke rendering. It's built on native GPU APIs (Metal on macOS, DirectX 12 on Windows, Vulkan cross-platform) with these core principles:

### 1. Stroke Data → Vertex Buffer (Per-Point Instancing)
- **Input**: Mouse/touch points → smoothed path (Catmull-Rom or similar, ~5-50 pts/stroke segment).
- **Processing**: CPU generates **position + attributes** per point (pos `{x,y}`, size, opacity, rotation if textured).
- **GPU Upload**: Dynamic **vertex buffer** (`GPUBuffer` equivalent): Append/update points (~1kB/stroke). No full-canvas ops.
- **Geometry**: **Instanced quads** (or triangles):
  | Primitive | Why |
  |-----------|-----|
  | 4-vertex quad/pt | Covers brush diameter; fragment shader fills alpha. |
  | Fixed VBO (screen quad × instances) | GPU reuses tiny static buffer (4 verts); `draw(6, numPoints)` triangles. |

### 2. Render Pipeline (Vertex + Fragment Shaders)
- **Vertex Shader** (per-vertex, runs ~4 verts/pt):
  ```glsl
  // Pseudo-Metal
  vertex float4 vs_main(uint vid [[vertex_id]], uint iid [[instance_id]]) {
    float2 quadOffset[4] = {{-r, -r}, {r, -r}, {r, r}, {-r, r}};  // r = brush radius
    float2 center = points[iid].xy;  // Fetch from instance buffer
    return float4(center + quadOffset[vid] * points[iid].size, 0, 1);
  }
  ```
  - Outputs **screen-space quad** positioned/scaled per point.
  - **Key**: Runs O(4 × points) = tiny (~800 invocations/stroke).

- **Fragment Shader** (per-pixel **inside quads only**, ~brush²/pt):
  ```glsl
  fragment float4 fs_main(float2 pos [[position]]) {
    float2 center = points[gl_InstanceID].xy;
    float dist = length(pos - center);  // Euclidean/Chebyshev
    float alpha = opacity * smoothstep(radius, hardRadius, dist);  // Falloff
    return float4(color.rgb, alpha);  // Src-over blend
  }
  ```
  - **Rasterizer Magic**: GPU hardware culls fragments outside quads (scissor/depth reject 99.9% canvas).
  - **Executions**: Only ~π×r² fragments/pt (e.g., r=50 → 8k frags/pt × 200 pts = 1.6M total, fully parallel).
  - **Perf**: <1ms/stroke on iPhone GPU.
  - **Opacity Clamping**: For a single stroke (mouse down to up), overlapping brush points accumulate opacity, but the total added opacity per pixel is clamped to the brush opacity (e.g., if brush opacity = 50%, max added = 50%, even with heavy overlaps).

### 3. Async Tiled Rendering + Persistent GPU Textures
- **Framebuffers**: Layer stack (base image, mask, paint) as **GPU textures** (no CPU canvas sync).
  - Render-to-texture: Stroke → temp → clamp alpha → composite (ping-pong for undo).
- **Command Buffers**: Async submit (`MTLCommandBuffer.commit()`); GPU runs in background.
- **Tiling**: Metal PSMT/Vulkan subpasses → render only dirty tiles (e.g., stroke bbox).
- **Blending**: Native `src-over`/`dst-out` in pipeline state; `loadOp: 'load'` preserves prior content.
- **No Readback**: UI reads GPU via `blit` to display texture or partial staging. History: Copy layers on save.

### 4. Multi-Threading + Optimizations
- **CPU**: Path smoothing, pressure curves (separate thread).
- **Preview**: Thin line (1px polyline) + deferred fat stroke.
- **Caches**: Pre-baked brushes (noise textures), LOD (small brushes CPU).
- **Scalability**: 8k canvas, 60FPS stylus, tablet pressure/tilt.

**Total Cost**: **O(points × brush_pixels)** ≈ 2M ops/stroke → instant.

## Current System: Why It's 400x Slower + Crashing

Your WebGPU impl uses **compute shaders naively**, mimicking CPU pixel loops:

### 1. Full-Canvas Compute Dispatch (Fatal Flaw)
```wgsl
@compute @workgroup_size(8,8)  // Dispatch: canvas.w/8 × canvas.h/8 = 65k workgroups
fn main(gid) {
  for (i = 0; i < numPoints; i++) {  // Loops ALL points/PER PIXEL
    dist = max(abs(gid.xy - points[i]));  // 200x loop
  }
}
```
- **Executions**: **4M pixels × 200 pts** = **800M invocations** (vs Photoshop's 1.6M fragments).
- GPU overloads: Workgroups serialize on register pressure/memory bandwidth.

### 2. Synchronous JS-WebGPU Queue
- `queue.submit(commands)` **blocks JS thread** until GPU ~finishes (WebGPU sync semantics).
- Browser tab hangs (GPU→CPU callback delay).

### 3. Expensive CPU Overlaps
- **Preview**: `drawWithBetterSmoothing` → JS `drawShape()` loops (10k px/pt uncached).
- **Readback**: Full 16MB `copyTextureToBuffer` + JS `ImageData` loop per batch.
- **Batching**: Unlimited points → shader loops explode.

### 4. No Culling/Persistence
- No quad rasterization → no hardware culling.
- CPU canvases → constant GPU↔CPU sync.

**Result**: 500ms+ latency → freeze/crash.

| Metric | Photoshop | Current |
|--------|-----------|---------|
| Ops/Stroke | 2M (parallel frags) | 800M (serial loops) |
| Latency | <1ms | 500ms+ |
| Sync | Async | Blocking |
| Pixels Processed | Brush area | Full canvas |

## Rework Plan: Implement Photoshop-Like Vertex Splatter in WebGPU

**Goal**: Replace compute → **render pipeline**. O(points × brush_px) perf. No CPU canvases (GPU-only layers). ~10x faster than canvas fallback.

### High-Level Architecture Changes
1. **Ditch CPU Canvases**: `maskCanvas`, `rgbCanvas` → **GPU textures only** (`maskTexture`, `rgbTexture` persistent).
2. **Stroke Pipeline**:
   - Points → dynamic `GPUBuffer` (vertex data).
   - Fixed quad **index buffer** (static VBO for quad).
   - Render stroke to temp texture with `src-over` blending.
   - Clamp temp texture alpha to brush opacity using compute shader.
   - Composite temp texture to main layer with `src-over`.
3. **No Preview During Stroke**: Thin polyline (CPU canvas) + fat GPU stroke async.
4. **Async Everything**: `submit()` non-blocking; readback **only** for history/export.
5. **History**: GPU texture snapshots (`copyTextureToTexture`) on `drawEnd`.
6. **Display**: Blit GPU layers → visible `imgCanvas` (CPU) via staging (once/frame or dirty).

### Core Code Rework (`useBrushDrawing.ts`)

This implementation uses **TypeGPU** (https://docs.swmansion.com/typegpu/) for type-safe WebGPU programming, with shaders defined as TypeScript functions that compile to WGSL. Full TypeGPU documentation is available via the MCP server "typegpu docs".

```typescript
import tgpu from 'typegpu';
import * as d from 'typegpu/data';

const root = await tgpu.init();

// Stroke vertex: per-point attributes
const StrokeVertex = d.struct({
  pos: d.location(0, d.vec2f),      // Center x,y
  size_opacity: d.location(1, d.vec2f),
  color: d.location(2, d.vec3f),
});

// Vertex output
const VertexOut = d.struct({
  @builtin.position position: d.vec4f,
  fragCenter: d.location(0, d.vec2f),
  fragDistOffset: d.location(1, d.vec2f),  // Relative to center
  fragColor: d.location(2, d.vec3f),
  fragOpacity: d.location(3, d.f32),
});

// Static quad vertices/indices (shared)
const QUAD_VERTICES = new Float32Array([-1,-1, 1,-1, 1,1, -1,1]);  // NDC quad, 4 vec2f
const QUAD_INDICES = new Uint16Array([0,1,2, 0,2,3]);  // Triangles
```

#### 1. New Data Structures
```typescript
// Stroke vertex: per-point attributes
interface StrokeVertex {
  x: number; y: number;  // Center
  size: number; opacity: number; r: f32; g: f32; b: f32;
}

// Static quad vertices/indices (shared)
const QUAD_VERTICES = new Float32Array([-1,-1, 1,-1, 1,1, -1,1]);  // NDC quad
const QUAD_INDICES = new Uint16Array([0,1,2, 0,2,3]);  // Triangles
```

#### 2. GPU Resources (Extend Existing)
```typescript
// Existing: maskTexture, rgbTexture (storage=renderable, created via TypeGPU root.createTexture)
// NEW: TypeGPU pipelines, layouts, buffers
let renderPipeline;  // TypeGPUPipeline
let quadVertexLayout;
let strokeInstanceLayout;
let quadVertexBuffer;
let quadIndexBuffer;
let strokeVertexBuffer;  // Preallocated large buffer

let strokeTempTexture;  // root.createTexture
let clampComputePipeline;
let clampBindGroupLayout;
let clampBindGroup;
let brushOpacityBuffer;  // uniform f32
```

#### 3. Shaders (TypeGPU TS Functions -> WGSL)
```typescript
// Vertex shader as TypeGPU function
const strokeVertexFn = tgpu['~unstable'].vertexFn({
  in: {
    quadPos: d.vec2f,
    strokeData: StrokeVertex,
  },
  out: VertexOut,
})(({ quadPos, strokeData }) => {
  const position = d.vec4f(strokeData.pos + quadPos * strokeData.size_opacity.x, 0.0, 1.0);
  return {
    position,
    fragCenter: strokeData.pos,
    fragDistOffset: quadPos,
    fragColor: strokeData.color,
    fragOpacity: strokeData.size_opacity.y,
  };
});

// Fragment shader (assumes params uniform bound separately)
const strokeFragmentFn = tgpu['~unstable'].fragmentFn({
  in: VertexOut,  // Auto-matched from vertex out
  out: d.vec4f,
})(({ fragCenter, fragDistOffset, fragColor, fragOpacity }) => {
  const dist = d.length(fragDistOffset) * 0.5;
  const hardRadius = 0.5 * params.hardness;  // From uniform bind group
  const fadeRange = 0.5 - hardRadius;
  
  let alpha = 0.0 as d.f32;
  if (dist <= hardRadius) {
    alpha = fragOpacity;
  } else if (dist <= 0.5) {
    const fade = (dist - hardRadius) / fadeRange;
    alpha = fragOpacity * (1.0 - fade);
  } else {
    d.discard();
  }
  
  return d.vec4f(fragColor, alpha);
});

// Clamp compute shader
const clampComputeFn = tgpu['~unstable'].computeFn({
  in: { gid: d.builtin.globalInvocationId },
  workgroupSize: [8, 8],
})(({ gid }) => {
  const texSize = d.textureDimensions(strokeTemp);
  if (gid.x >= texSize.x || gid.y >= texSize.y) { return; }
  
  const color = d.textureLoad(strokeTemp, d.vec2i(gid.xy), 0);
  const clampedAlpha = d.min(color.a, brushOpacity);
  d.textureStore(strokeTemp, d.vec2i(gid.xy), 0, d.vec4f(color.rgb, clampedAlpha));
});
```


#### 4. Pipeline Init (`initStrokeRenderPipeline`)
```typescript
const initStrokeRenderPipeline = () => {
  // Vertex layouts
  quadVertexLayout = tgpu.vertexLayout(d.arrayOf(d.vec2f), 'vertex');
  strokeInstanceLayout = tgpu.vertexLayout(d.disarrayOf(StrokeVertex, 1024), 'instance');

  // Static buffers
  quadVertexBuffer = root.createBuffer(d.arrayOf(d.vec2f, 4), QUAD_VERTICES).$usage('vertex');
  quadIndexBuffer = root.createBuffer(d.arrayOf(d.u16, 6), QUAD_INDICES).$usage('index');
  strokeVertexBuffer = root.createBuffer(d.disarrayOf(StrokeVertex, 1024)).$usage('vertex');

  // Render pipeline (src-over blend)
  renderPipeline = root['~unstable']
    .withVertex(strokeVertexFn, {
      quadPos: quadVertexLayout.attrib,
      strokeData: strokeInstanceLayout.attrib,
    })
    .withFragment(strokeFragmentFn, {
      format: 'rgba8unorm',
      blend: {
        color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
        alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      },
    })
    .withPrimitive({ topology: 'triangle-list' })
    .createPipeline();

  // Temp texture
  strokeTempTexture = root.createTexture({
    size: [canvasWidth, canvasHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.STORAGE_BINDING,
  });

  // Clamp compute
  clampBindGroupLayout = tgpu.bindGroupLayout({
    strokeTemp: { storageTexture: d.storageTexture2d('rgba8unorm') },
    brushOpacity: { uniform: d.f32 },
  });
  clampComputePipeline = root['~unstable']
    .withCompute(clampComputeFn)
    .createPipeline();
};
```

#### 5. Stroke Render (`drawStrokeGPU` Rework)
```typescript
const drawStrokeGPU = async (points: Point[], opacities: number[]) => {
  if (points.length === 0) return;

  // CPU: Pack vertices (batch) - TypeGPU write
  const verticesData = new Float32Array(points.length * 7);  // Matches StrokeVertex stride
  for (let i = 0; i < points.length; i++) {
    const off = i * 7;
    verticesData[off + 0] = points[i].x; verticesData[off + 1] = points[i].y;
    verticesData[off + 2] = store.brushSettings.size; verticesData[off + 3] = opacities[i];
    const {r,g,b} = parseToRgb(store.rgbColor);
    verticesData[off + 4] = r/255; verticesData[off + 5] = g/255; verticesData[off + 6] = b/255;
  }
  strokeVertexBuffer.write(verticesData);  // TypeGPU buffer update

  const brushOpacity = store.brushSettings.opacity / 100;

  // Update uniform
  brushOpacityBuffer.write(new Float32Array([brushOpacity]));

  const clampBindGroup = root.createBindGroup(clampBindGroupLayout, {
    strokeTemp: strokeTempTexture,
    brushOpacity: brushOpacityBuffer,
  });

  // Step 1: Render stroke to temp texture (high-level TypeGPU)
  root.clearTexture(strokeTempTexture.createView(), {r:0,g:0,b:0,a:0});
  renderPipeline
    .withIndexBuffer(quadIndexBuffer)
    .with(quadVertexLayout, quadVertexBuffer)
    .with(strokeInstanceLayout, strokeVertexBuffer.slice(0, points.length))  // Dynamic slice
    .withColorAttachment({
      view: strokeTempTexture.createView(),
      loadOp: 'load',  // Already cleared
      storeOp: 'store',
    })
    .drawIndexed(6, points.length);

  // Step 2: Clamp alpha
  clampComputePipeline.with(clampBindGroup).dispatchWorkgroups(
    Math.ceil(canvasWidth / 8), Math.ceil(canvasHeight / 8)
  );

  // Step 3: Composite (use separate fullscreen composite pipeline, details omitted)
  // compositePipeline.with(...).draw(6);  // Fullscreen quad blitting temp -> target
};
```
```typescript
const drawStrokeGPU = async (points: Point[], opacities: number[]) => {
  if (points.length === 0) return;

  // CPU: Pack vertices (batch)
  const vertices = new Float32Array(points.length * 7);  // x,y,size,opacity,r,g,b
  for (let i = 0; i < points.length; i++) {
    const off = i * 7;
    vertices[off + 0] = points[i].x; vertices[off + 1] = points[i].y;
    vertices[off + 2] = store.brushSettings.size; vertices[off + 3] = opacities[i];
    // Pack color: parseToRgb(store.rgbColor || maskColor)
    const {r,g,b} = parseToRgb(store.rgbColor);
    vertices[off + 4] = r/255; vertices[off + 5] = g/255; vertices[off + 6] = b/255;
  }
  device!.queue.writeBuffer(strokeVertexBuffer, 0, vertices);

  const commandEncoder = device!.createCommandEncoder();

  // Step 1: Render stroke to temp texture with src-over (accumulate overlaps)
  const strokePass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: strokeTempTexture.createView(),
      loadOp: 'clear', storeOp: 'store',  // Clear temp for each stroke
      clearValue: { r: 0, g: 0, b: 0, a: 0 },
    }],
  });
  strokePass.setPipeline(renderPipeline!);
  strokePass.setVertexBuffer(0, quadVertexBuffer);
  strokePass.setVertexBuffer(1, strokeVertexBuffer);
  strokePass.setIndexBuffer(quadIndexBuffer, 'uint16');
  strokePass.drawIndexed(6, points.length);
  strokePass.end();

  // Step 2: Clamp alpha in temp texture to brush opacity
  const brushOpacity = store.brushSettings.opacity / 100;  // Assume 0-100 scale
  device!.queue.writeBuffer(clampUniformBuffer, 0, new Float32Array([brushOpacity]));
  const computePass = commandEncoder.beginComputePass();
  computePass.setPipeline(clampComputePipeline);
  computePass.setBindGroup(0, clampBindGroup);
  computePass.dispatchWorkgroups(Math.ceil(canvasWidth / 8), Math.ceil(canvasHeight / 8));
  computePass.end();

  // Step 3: Composite temp to main layer with src-over
  const targetTexture = store.activeLayer === 'rgb' ? rgbTexture! : maskTexture!;
  const compositePass = commandEncoder.beginRenderPass({
    colorAttachments: [{
      view: targetTexture.createView(),
      loadOp: 'load', storeOp: 'store',  // Preserve prior content
    }],
  });
  // Use a full-screen quad render to composite temp onto target (src-over)
  // Assuming a simple composite shader that samples temp and blends
  // (Details omitted for brevity; similar to render pipeline but full-screen)
  compositePass.end();

  device!.queue.submit([commandEncoder.finish()]);
};
```

#### 6. Integration Changes
- **`src/components/maskeditor/MaskEditorContent.vue`**: Remove CPU canvas refs for drawing (keep `imgCanvas` for display blit). Call `compositeGPULayers()` in RAF for display.
- **Stores**: `maskCtx`/`rgbCtx` → obsolete; use GPU compositing for history (`copyTextureToTexture(maskTexture, historyTexture)`).
- **PanZoom/Display**: New `compositeGPULayers()` → blit layers → `imgCanvas` (throttled RAF).
- **Erasing**: For erasing, render to temp with negative alpha or use dst-out blend, then clamp (ensure clamped alpha doesn't go negative).
- **Smoothing**: Unchanged, but mini-batch `drawStrokeGPU(32pts)` per `mousemove`.

### Implementation Phases
1. **Phase 1: Render Pipeline Basics** (1-2 days)
   - Init pipeline/buffers/shaders, including temp texture and clamp compute.
   - `drawStrokeGPU` with render to temp, clamp, composite.
   - Test: Single stroke → inspect GPU texture (Chrome GPU inspector).

2. **Phase 2: Layer Compositing + Display** (1 day)
   - Persistent textures, blit chain to display canvas.
   - Async `drawStrokeGPU` in `handleDrawing` (mini-batches).

3. **Phase 3: Smoothing, Batching, Preview** (1 day)
   - Thin CPU polyline preview (`ctx.lineTo()` 1px).
   - Unlimited stroke → auto mini-batch.

4. **Phase 4: Polish + Features** (1-2 days)
   - Brush shapes (texture atlas in vertex).
   - Undo/History (texture copies).
   - Erase mode, hardness/opacity uniforms.
   - Error fallback → pure canvas.
   - Perf validate: <5ms/stroke (Chrome profiler).

**Expected Outcome**: 60FPS on 4k canvas, tablet-smooth. Matches Photoshop perf natively in WebGPU.

**Files to Update**:
- `useBrushDrawing.ts`: Full GPU rewrite (~400 LOC).
- `MaskEditorContent.vue`: Display compositing.
- `maskEditorStore.ts`: Remove CPU ctx refs.
- Tests: Add GPU perf assertions.
