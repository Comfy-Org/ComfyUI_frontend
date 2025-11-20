import tgpu from 'typegpu'
import * as d from 'typegpu/data'
import { BrushUniforms } from './gpuSchema'

const VertexOutput = d.struct({
  position: d.builtin.position,
  localUV: d.location(0, d.vec2f),
  color: d.location(1, d.vec3f),
  opacity: d.location(2, d.f32),
  hardness: d.location(3, d.f32)
})

const brushVertexTemplate = `
@group(0) @binding(0) var<uniform> globals: BrushUniforms;

@vertex
fn vs(
  @location(0) quadPos: vec2<f32>,
  @location(1) pos: vec2<f32>,
  @location(2) size: f32,
  @location(3) pressure: f32
) -> VertexOutput {
  // 'size' is diameter, so convert to radius
  let radius = size * pressure;
  let pixelPos = pos + (quadPos * radius);
  
  // Convert Pixel Space -> NDC
  let ndcX = (pixelPos.x / globals.screenSize.x) * 2.0 - 1.0;
  let ndcY = 1.0 - ((pixelPos.y / globals.screenSize.y) * 2.0); // Flip Y

  return VertexOutput(
    vec4<f32>(ndcX, ndcY, 0.0, 1.0),
    quadPos,
    globals.brushColor,
    pressure * globals.brushOpacity,
    globals.hardness
  );
}
`

export const brushVertex = tgpu.resolve({
  template: brushVertexTemplate,
  externals: {
    BrushUniforms,
    VertexOutput
  }
})

const brushFragmentTemplate = `
@group(0) @binding(0) var<uniform> globals: BrushUniforms;

@fragment
fn fs(v: VertexOutput) -> @location(0) vec4<f32> {
  var dist: f32;
  if (globals.brushShape == 1u) {
    // Square (Chebyshev distance)
    dist = max(abs(v.localUV.x), abs(v.localUV.y));
  } else {
    // Circle (Euclidean distance)
    dist = length(v.localUV);
  }

  if (dist > 1.0) { discard; }

  // Correct Hardness Math with Anti-Aliasing:
  // Use fwidth() to prevent aliasing at hardness=1.0
  let edgeWidth = fwidth(dist);
  let startFade = min(v.hardness, 1.0 - edgeWidth * 2.0);
  let linearAlpha = 1.0 - smoothstep(startFade, 1.0, dist);
  // Squared falloff for softer edges (Quadratic)
  let alphaShape = pow(linearAlpha, 2.0);
  
  // Output Premultiplied Alpha
  let alpha = alphaShape * v.opacity;
  return vec4<f32>(v.color * alpha, alpha);
}
`

export const brushFragment = tgpu.resolve({
  template: brushFragmentTemplate,
  externals: {
    VertexOutput,
    BrushUniforms
  }
})

const blitShaderTemplate = `
@vertex fn vs(@builtin(vertex_index) vIdx: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0)
  );
  return vec4<f32>(pos[vIdx], 0.0, 1.0);
}

@group(0) @binding(0) var myTexture: texture_2d<f32>;

@fragment fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let c = textureLoad(myTexture, vec2<i32>(pos.xy), 0);
  // Premultiply alpha because the source (maskTexture) is straight alpha
  // but the canvas (and blending) expects premultiplied.
  return vec4<f32>(c.rgb * c.a, c.a);
}
`

export const blitShader = tgpu.resolve({
  template: blitShaderTemplate,
  externals: {}
})

const compositeShaderTemplate = `
@vertex fn vs(@builtin(vertex_index) vIdx: u32) -> @builtin(position) vec4<f32> {
  var pos = array<vec2<f32>, 3>(
    vec2<f32>(-1.0, -1.0), vec2<f32>(3.0, -1.0), vec2<f32>(-1.0, 3.0)
  );
  return vec4<f32>(pos[vIdx], 0.0, 1.0);
}

@group(0) @binding(0) var myTexture: texture_2d<f32>;
@group(1) @binding(0) var<uniform> globals: BrushUniforms;

@fragment fn fs(@builtin(position) pos: vec4<f32>) -> @location(0) vec4<f32> {
  let sampled = textureLoad(myTexture, vec2<i32>(pos.xy), 0);
  // Scale the accumulated coverage by the global brush opacity
  return sampled * globals.brushOpacity;
}
`

export const compositeShader = tgpu.resolve({
  template: compositeShaderTemplate,
  externals: {
    BrushUniforms
  }
})
