import * as d from 'typegpu/data'

// 1. Global Brush Settings (Uniforms)
export const BrushUniforms = d.struct({
  brushColor: d.vec3f,
  brushOpacity: d.f32,
  hardness: d.f32,
  screenSize: d.vec2f,
  brushShape: d.u32 // 0 = Circle, 1 = Square
})

// 2. Per-Point Instance Data (Batched)
export const StrokePoint = d.struct({
  pos: d.location(0, d.vec2f), // Center x,y
  size: d.location(1, d.f32), // Radius
  pressure: d.location(2, d.f32) // 0.0 - 1.0
})
