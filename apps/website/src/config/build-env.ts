export function isProductionBuild(): boolean {
  return process.env.VERCEL_ENV === 'production'
}
