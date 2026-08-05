export function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

export function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055
}

export const LUM_R = 0.2224884
export const LUM_G = 0.71690369
export const LUM_B = 0.06060791

export function luminance(r: number, g: number, b: number): number {
  return r * LUM_R + g * LUM_G + b * LUM_B
}
