export function loadReviewGuidanceVerification(): Promise<Response> {
  return fetch('/api/review-guidance')
}
