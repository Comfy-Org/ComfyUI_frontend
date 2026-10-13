export function formatClock(seconds: number): string {
  const whole = Math.floor(seconds)
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0')
  const remainder = String(whole % 60).padStart(2, '0')
  return `${minutes}:${remainder}`
}
