export interface TeamCreditTier {
  credits: string
  basePrice: number
  monthlyPrice: number
  yearlyPrice: number
  videos: number
}

export const teamCreditTiers: readonly TeamCreditTier[] = [
  {
    credits: '42.2K',
    basePrice: 200,
    monthlyPrice: 200,
    yearlyPrice: 200,
    videos: 3830
  },
  {
    credits: '84.4K',
    basePrice: 400,
    monthlyPrice: 390,
    yearlyPrice: 380,
    videos: 7660
  },
  {
    credits: '147K',
    basePrice: 700,
    monthlyPrice: 665,
    yearlyPrice: 630,
    videos: 13405
  },
  {
    credits: '295K',
    basePrice: 1400,
    monthlyPrice: 1295,
    yearlyPrice: 1190,
    videos: 26810
  },
  {
    credits: '528K',
    basePrice: 2500,
    monthlyPrice: 2250,
    yearlyPrice: 2000,
    videos: 47830
  }
] as const
