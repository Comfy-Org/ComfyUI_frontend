// Where the roadmap's feedback block sends each of the three asks. The channel
// is not settled yet, so these are placeholders: repoint a URL here, nowhere else.
export const roadmapFeedbackLinks = {
  // "This roadmap is missing something, is wrong, or why is X not on it."
  roadmap: 'https://forum.comfy.org/',
  featureRequest:
    'https://github.com/Comfy-Org/ComfyUI/issues/new?template=feature-request.yml',
  bug: 'https://github.com/Comfy-Org/ComfyUI/issues/new?template=bug-report.yml'
} as const
