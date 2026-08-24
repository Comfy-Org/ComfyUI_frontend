export type MatrixRenderer = 'legacy' | 'vue'

export function matrixRendererFromEnv(
  value: string | undefined = process.env.MATRIX_VUE
): MatrixRenderer {
  if (value === undefined || value === '' || value === '0') return 'legacy'
  if (value === '1') return 'vue'
  throw new Error(
    `MATRIX_VUE must be 0 or 1, received ${JSON.stringify(value)}`
  )
}
