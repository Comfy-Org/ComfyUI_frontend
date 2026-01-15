The key is like this:

```text
firebase:authUser:<REDACTED_API_KEY>:[DEFAULT]
```

The value is like this:

```json
{
  "uid": "<REDACTED_UID>",
  "email": "user@example.com",
  "emailVerified": true,
  "displayName": "Example User",
  "isAnonymous": false,
  "photoURL": "https://example.com/photo.jpg",
  "providerData": [
    {
      "providerId": "google.com",
      "uid": "<REDACTED_PROVIDER_UID>",
      "displayName": "Example User",
      "email": "user@example.com",
      "phoneNumber": null,
      "photoURL": "https://example.com/photo.jpg"
    }
  ],
  "stsTokenManager": {
    "refreshToken": "<REDACTED_REFRESH_TOKEN>",
    "accessToken": "<REDACTED_ACCESS_TOKEN>",
    "expirationTime": 1768346128532
  },
  "createdAt": "1744833024270",
  "lastLoginAt": "1768342528496",
  "apiKey": "<REDACTED_API_KEY>",
  "appName": "[DEFAULT]"
}
```
