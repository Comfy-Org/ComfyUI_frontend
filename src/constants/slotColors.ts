/**
 * Default colors for node slot types
 * Mirrors LiteGraph's slot_default_color_by_type
 */
const SLOT_TYPE_COLORS: Record<string, string> = {
  number: '#AAD',
  string: '#DCA',
  boolean: '#DAA',
  vec2: '#ADA',
  vec3: '#ADA',
  vec4: '#ADA',
  color: '#DDA',
  image: '#353',
  latent: '#858',
  conditioning: '#FFA',
  control_net: '#F8F',
  clip: '#FFD',
  vae: '#F82',
  model: '#B98',
  '*': '#AAA' // Default color
}

/**
 * Get the color for a slot type
 */
export function getSlotColor(type?: string | number | null): string {
  if (!type) return SLOT_TYPE_COLORS['*']
  const typeStr = String(type).toLowerCase()
  return SLOT_TYPE_COLORS[typeStr] || SLOT_TYPE_COLORS['*']
}
