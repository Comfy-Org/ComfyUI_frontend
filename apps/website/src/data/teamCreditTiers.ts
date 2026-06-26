export interface TeamCreditTier {
  credits: number
  basePrice: number
  monthlyPrice: number
  yearlyPrice: number
  videos: number
}

export const teamCreditTiers: readonly TeamCreditTier[] = [
  {
    credits: 42200,
    basePrice: 200,
    monthlyPrice: 200,
    yearlyPrice: 200,
    videos: 3830
  },
  {
    credits: 84400,
    basePrice: 400,
    monthlyPrice: 390,
    yearlyPrice: 380,
    videos: 7660
  },
  {
    credits: 147700,
    basePrice: 700,
    monthlyPrice: 665,
    yearlyPrice: 630,
    videos: 13405
  },
  {
    credits: 295400,
    basePrice: 1400,
    monthlyPrice: 1295,
    yearlyPrice: 1190,
    videos: 26810
  },
  {
    credits: 527500,
    basePrice: 2500,
    monthlyPrice: 2250,
    yearlyPrice: 2000,
    videos: 47830
  }
] as const

export function formatTeamCreditsLong(n: number): string {
  return n.toLocaleString('en-US')
}

export function formatTeamCreditsShort(n: number): string {
  const k = n / 1000
  return k % 1 === 0 ? `${k}K` : `${k.toFixed(1)}K`
}
