type LoggedInAuthHeader = {
  Authorization: `Bearer ${string}`
}

export type ApiKeyAuthHeader = {
  'X-COMFY-API-KEY': string
}

export type AuthHeader = LoggedInAuthHeader | ApiKeyAuthHeader
