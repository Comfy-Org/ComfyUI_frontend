# Mock Marketplace API Diagrams

### Endpoint Summary Table

| Method | Path | Handler | State |
|--------|------|---------|-------|
| POST | `/api/marketplace/templates` | createTemplate | db |
| PUT | `/api/marketplace/templates/:id` | updateTemplate | db |
| POST | `/api/marketplace/templates/:id/submit` | transitionStatus | db |
| POST | `/api/marketplace/templates/:id/approve` | transitionStatus | db |
| POST | `/api/marketplace/templates/:id/reject` | transitionStatus | db |
| POST | `/api/marketplace/templates/:id/publish` | transitionStatus | db |
| POST | `/api/marketplace/templates/:id/unpublish` | transitionStatus | db |
| POST | `/api/marketplace/templates/:id/media` | addMedia | db, mediaBlobs |
| GET | `/api/marketplace/media/seed/*` | readFile (fs) | seed-media/ |
| GET | `/api/marketplace/media/:templateId/:filename` | getMediaBlob | mediaBlobs |
| GET | `/api/marketplace/author/templates` | getDb | db |
| GET | `/api/marketplace/author/stats` | getDb | db |
| GET | `/api/marketplace/categories` | getDb | db |
| GET | `/api/marketplace/tags/suggest` | getDb | db |
| POST | `/api/marketplace/_reset` | resetDb | db, mediaBlobs |
| GET | `/review` | static HTML | — |


### Template Status Flow

```mermaid
stateDiagram-v2
    [*] --> draft: POST /templates
    draft --> pending_review: POST /submit
    pending_review --> approved: POST /approve
    pending_review --> rejected: POST /reject
    approved --> published: POST /publish
    published --> unpublished: POST /unpublish
    unpublished --> published: POST /publish
    rejected --> pending_review: POST /submit (resubmit)
```

### Media Upload Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as handleRequest
    participant S as State

    C->>R: POST /templates/:id/media (FormData: file, type?)
    R->>R: extractIdFromPath
    R->>S: findTemplate(id)
    alt Template not found
        R-->>C: 404
    end
    R->>R: formData.get('file'), formData.get('type')
    R->>S: addMedia(id, file, mediaType)
    S->>S: Store buffer in mediaBlobs[key]
    S->>S: Append to mediaByTemplateId[templateId]
    S-->>R: MediaUploadResponse { url, type }
    R-->>C: 201 { url, type }
```


