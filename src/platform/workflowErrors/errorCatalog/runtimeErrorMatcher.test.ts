import { describe, expect, it } from 'vitest'

import {
  INSUFFICIENT_CREDITS_CATALOG_ID,
  PERSONAL_WALLET_INSUFFICIENT_CREDITS_CATALOG_ID,
  WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID
} from './catalogIds'
import { resolveRuntimeCatalogMatch } from './runtimeErrorMatcher'

describe('resolveRuntimeCatalogMatch partner-node 402', () => {
  it.for([
    {
      case: 'legacy sentence',
      message:
        'Payment Required: Please add credits to your account to use this node.',
      expected: { catalogId: INSUFFICIENT_CREDITS_CATALOG_ID }
    },
    {
      case: 'personal API key sentence',
      message:
        'Payment Required: This API key bills your personal account, which is out of credits.',
      expected: {
        catalogId: PERSONAL_WALLET_INSUFFICIENT_CREDITS_CATALOG_ID,
        params: { credential: 'api_key' }
      }
    },
    {
      case: 'personal session sentence',
      message:
        'Payment Required: This session is set to bill your personal account, which is out of credits.',
      expected: {
        catalogId: PERSONAL_WALLET_INSUFFICIENT_CREDITS_CATALOG_ID,
        params: { credential: 'session' }
      }
    },
    {
      case: 'workspace queue sentence',
      message:
        'Payment Required: Please add credits to your workspace to continue.',
      expected: { catalogId: WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID }
    },
    {
      case: 'workspace submit sentence',
      message: 'Insufficient credits to queue workflows',
      expected: { catalogId: WORKSPACE_INSUFFICIENT_CREDITS_CATALOG_ID }
    }
  ])('catalogs the $case', ({ message, expected }) => {
    expect(
      resolveRuntimeCatalogMatch({
        exceptionType: 'RuntimeError',
        exceptionMessage: message
      })
    ).toEqual(expected)
  })

  it.for([
    {
      case: 'personal-account phrase without the 402 prefix',
      message: 'This API key bills your personal account.'
    },
    {
      case: 'team-wallet sentence',
      message:
        'Payment Required: This API key bills the Acme Studio team, which is out of credits.'
    },
    {
      case: 'team-wallet sentence whose team name quotes the personal phrase',
      message:
        'Payment Required: This API key bills the This API key bills your personal account, team, which is out of credits.'
    },
    {
      case: 'reworded personal sentence',
      message:
        'Payment Required: This session bills your personal account, which is out of credits.'
    },
    {
      case: 'lengthened legacy sentence',
      message:
        'Payment Required: Please add credits to your account to use this node. (Node: FluxPro)'
    },
    {
      case: 'lengthened workspace sentence',
      message:
        'Payment Required: Please add credits to your workspace to continue. (Node: FluxPro)'
    }
  ])('does not catalog the $case', ({ message }) => {
    expect(
      resolveRuntimeCatalogMatch({
        exceptionType: 'RuntimeError',
        exceptionMessage: message
      })
    ).toBeUndefined()
  })
})
