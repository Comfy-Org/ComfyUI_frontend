export const footerLogoFrameUrls = Array.from({ length: 75 }, (_, i) => {
  const index = String(i).padStart(5, '0')
  return `https://media.comfy.org/website/homepage/footer-logo-seq/seq-footer_${index}.webp`
})

export const footerLogoRestingFrameUrl = footerLogoFrameUrls.at(-1)
