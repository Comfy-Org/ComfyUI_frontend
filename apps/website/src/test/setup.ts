import '@testing-library/jest-dom/vitest'
import * as matchers from '@testing-library/jest-dom/matchers'
import { cleanup } from '@testing-library/vue'
import { afterEach, expect } from 'vitest'

expect.extend(matchers)

afterEach(cleanup)
