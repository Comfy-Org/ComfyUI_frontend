import type { CollectionSlug, Payload, RequiredDataFromCollectionSlug } from 'payload'

// Idempotent upsert-by-natural-key: return the id of the doc whose `field`
// equals `value`, creating it from `createData` if none exists yet.
export const findOrCreateByField = async <TSlug extends CollectionSlug>(
  payload: Payload,
  collection: TSlug,
  field: keyof RequiredDataFromCollectionSlug<TSlug> & string,
  value: string,
  createData: RequiredDataFromCollectionSlug<TSlug>,
): Promise<number> => {
  const existing = await payload.find({
    collection,
    where: { [field]: { equals: value } },
    limit: 1,
  })

  if (existing.docs.length > 0) {
    return existing.docs[0].id as number
  }

  const created = await payload.create({ collection, data: createData })
  return created.id as number
}
