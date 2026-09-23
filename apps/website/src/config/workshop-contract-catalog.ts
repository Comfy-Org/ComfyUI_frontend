import { z } from 'astro/zod'

import contractsJson from '../content/workshop-router-contracts.json'
import { workshopContractRecordSchema } from './workshop-contract'

const contracts = new Map(
  z
    .array(workshopContractRecordSchema)
    .parse(contractsJson)
    .map(({ catalogId, ...contract }) => [catalogId, contract])
)

export function workshopContract(id: string) {
  return contracts.get(id)
}
