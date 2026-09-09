export interface TeamCreditTier {
  credits: number
  basePrice: number
  monthlyPrice: number
  yearlyPrice: number
  eduMonthlyPrice: number
  eduYearlyPrice: number
  videos: number
}

export const teamCreditTiers: readonly TeamCreditTier[] = [
  {
    credits: 42200,
    basePrice: 200,
    monthlyPrice: 200,
    yearlyPrice: 200,
    eduMonthlyPrice: 190,
    eduYearlyPrice: 190,
    videos: 3830
  },
  {
    credits: 84400,
    basePrice: 400,
    monthlyPrice: 390,
    yearlyPrice: 380,
    eduMonthlyPrice: 370,
    eduYearlyPrice: 360,
    videos: 7660
  },
  {
    credits: 147700,
    basePrice: 700,
    monthlyPrice: 665,
    yearlyPrice: 630,
    eduMonthlyPrice: 630,
    eduYearlyPrice: 595,
    videos: 13405
  },
  {
    credits: 295400,
    basePrice: 1400,
    monthlyPrice: 1295,
    yearlyPrice: 1190,
    eduMonthlyPrice: 1225,
    eduYearlyPrice: 1120,
    videos: 26810
  },
  {
    credits: 527500,
    basePrice: 2500,
    monthlyPrice: 2250,
    yearlyPrice: 2000,
    eduMonthlyPrice: 2125,
    eduYearlyPrice: 1875,
    videos: 47875
  }
]

// Yearly totals reach seven figures, where a K unit stops abbreviating
// ("1772.4K"), so the unit follows the magnitude — the same compact formatting
// the in-app slider uses, so the two surfaces read identically.
export function formatTeamCreditsShort(n: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(n)
}
