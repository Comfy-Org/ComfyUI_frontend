/**
 * Survey Response Normalization Utilities
 *
 * Smart categorization system to normalize free-text survey responses
 * into standardized categories for better analytics breakdowns.
 */

/**
 * Normalize industry responses into standardized categories
 * Based on analysis of ~9,000 existing user responses
 */
export function normalizeIndustry(rawIndustry: string): string {
  if (!rawIndustry || typeof rawIndustry !== 'string') {
    return 'Other / Undefined'
  }

  const industry = rawIndustry.toLowerCase().trim()

  // Film / TV / Animation (~2,885 users)
  if (
    industry.match(
      /film|tv|animation|story|anime|video|cinematography|visual effects|vfx|movie|cinema/
    )
  ) {
    return 'Film / TV / Animation'
  }

  // Marketing / Advertising / Social Media (~1,340 users)
  if (
    industry.match(
      /marketing|advertising|youtube|tiktok|social media|content creation|influencer|brand|promotion/
    )
  ) {
    return 'Marketing / Advertising / Social Media'
  }

  // Software / IT / AI (~1,100 users)
  if (
    industry.match(
      /software|it|ai|developer|consulting|engineering|tech|programmer|data science|machine learning/
    )
  ) {
    return 'Software / IT / AI'
  }

  // Product & Industrial Design (~1,050 users)
  if (
    industry.match(
      /product.?design|industrial|manufacturing|3d rendering|product visualization|mechanical|automotive/
    )
  ) {
    return 'Product & Industrial Design'
  }

  // Fine Art / Contemporary Art (~780 users)
  if (
    industry.match(
      /fine.?art|art|illustration|contemporary|artist|painting|drawing|sculpture|gallery/
    )
  ) {
    return 'Fine Art / Contemporary Art'
  }

  // Education / Research (~640 users)
  if (
    industry.match(
      /education|student|teacher|research|learning|university|school|academic|professor/
    )
  ) {
    return 'Education / Research'
  }

  // Architecture / Engineering / Construction (~420 users)
  if (
    industry.match(
      /architecture|construction|engineering|civil|cad|building|structural|landscape/
    )
  ) {
    return 'Architecture / Engineering / Construction'
  }

  // Gaming / Interactive Media (~410 users)
  if (
    industry.match(
      /gaming|game dev|roblox|interactive|virtual world|vr|ar|metaverse|simulation/
    )
  ) {
    return 'Gaming / Interactive Media'
  }

  // Photography / Videography (~70 users)
  if (
    industry.match(
      /photography|photo|videography|camera|image|portrait|wedding|commercial photo/
    )
  ) {
    return 'Photography / Videography'
  }

  // Fashion / Beauty / Retail (~25 users)
  if (
    industry.match(
      /fashion|beauty|jewelry|retail|style|clothing|cosmetics|makeup/
    )
  ) {
    return 'Fashion / Beauty / Retail'
  }

  // Music / Performing Arts (~25 users)
  if (
    industry.match(
      /music|vj|dance|projection mapping|audio visual|concert|performance|theater/
    )
  ) {
    return 'Music / Performing Arts'
  }

  // Healthcare / Medical / Life Science (~30 users)
  if (
    industry.match(
      /healthcare|medical|doctor|biotech|life science|pharmaceutical|clinical|hospital/
    )
  ) {
    return 'Healthcare / Medical / Life Science'
  }

  // E-commerce / Print-on-Demand / Business (~15 users)
  if (
    industry.match(
      /ecommerce|print on demand|shop|business|commercial|startup|entrepreneur|sales/
    )
  ) {
    return 'E-commerce / Print-on-Demand / Business'
  }

  // Nonprofit / Government / Public Sector (~15 users)
  if (
    industry.match(
      /501c3|ngo|government|public service|policy|nonprofit|charity|civic/
    )
  ) {
    return 'Nonprofit / Government / Public Sector'
  }

  // Adult / NSFW (~10 users)
  if (industry.match(/nsfw|adult|erotic|explicit|xxx|porn/)) {
    return 'Adult / NSFW'
  }

  // Other / Undefined - catch common undefined responses
  if (
    industry.match(
      /other|none|undefined|unknown|n\/a|not applicable|^-$|^$|misc/
    )
  ) {
    return 'Other / Undefined'
  }

  // Uncategorized - preserve original but prefix for analysis
  return `Uncategorized: ${rawIndustry}`
}

/**
 * Normalize use case responses into standardized categories
 * Based on common patterns in user responses
 */
export function normalizeUseCase(rawUseCase: string): string {
  if (!rawUseCase || typeof rawUseCase !== 'string') {
    return 'Other / Undefined'
  }

  const useCase = rawUseCase.toLowerCase().trim()

  // Content Creation & Marketing
  if (
    useCase.match(
      /content creation|social media|marketing|advertising|youtube|tiktok|instagram|thumbnails/
    )
  ) {
    return 'Content Creation & Marketing'
  }

  // Art & Illustration
  if (
    useCase.match(
      /art|illustration|drawing|painting|concept art|character design|digital art/
    )
  ) {
    return 'Art & Illustration'
  }

  // Product Visualization & Design
  if (
    useCase.match(
      /product|visualization|design|prototype|mockup|3d rendering|industrial design/
    )
  ) {
    return 'Product Visualization & Design'
  }

  // Film & Video Production
  if (
    useCase.match(
      /film|video|movie|animation|vfx|visual effects|storyboard|cinematography/
    )
  ) {
    return 'Film & Video Production'
  }

  // Gaming & Interactive Media
  if (
    useCase.match(/game|gaming|interactive|vr|ar|virtual|simulation|metaverse/)
  ) {
    return 'Gaming & Interactive Media'
  }

  // Architecture & Construction
  if (
    useCase.match(
      /architecture|building|construction|interior design|landscape|real estate/
    )
  ) {
    return 'Architecture & Construction'
  }

  // Education & Training
  if (
    useCase.match(
      /education|training|learning|teaching|tutorial|course|academic/
    )
  ) {
    return 'Education & Training'
  }

  // Research & Development
  if (
    useCase.match(
      /research|development|experiment|prototype|testing|analysis|study/
    )
  ) {
    return 'Research & Development'
  }

  // Personal & Hobby
  if (
    useCase.match(/personal|hobby|fun|experiment|learning|curiosity|explore/)
  ) {
    return 'Personal & Hobby'
  }

  // Photography & Image Processing
  if (
    useCase.match(
      /photography|photo|image|portrait|editing|enhancement|restoration/
    )
  ) {
    return 'Photography & Image Processing'
  }

  // Other / Undefined
  if (
    useCase.match(
      /other|none|undefined|unknown|n\/a|not applicable|^-$|^$|misc/
    )
  ) {
    return 'Other / Undefined'
  }

  // Uncategorized - preserve original but prefix for analysis
  return `Uncategorized: ${rawUseCase}`
}

/**
 * Apply normalization to survey responses
 * Creates both normalized and raw versions of responses
 */
export function normalizeSurveyResponses(responses: {
  industry?: string
  useCase?: string
  [key: string]: any
}) {
  const normalized = { ...responses }

  // Normalize industry
  if (responses.industry) {
    normalized.industry_normalized = normalizeIndustry(responses.industry)
    normalized.industry_raw = responses.industry
  }

  // Normalize use case
  if (responses.useCase) {
    normalized.useCase_normalized = normalizeUseCase(responses.useCase)
    normalized.useCase_raw = responses.useCase
  }

  return normalized
}
