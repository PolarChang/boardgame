# Rules Knowledge API Contract

The existing RAG search contract remains unchanged:

- `GET /api/games` on the rules service returns legacy game names.
- `POST /api/query` performs legacy vector/RAG search.

The structured, template-oriented knowledge base is namespaced under
`/api/knowledge` to avoid collisions. The Next.js application proxies that
contract below `/api/rules/knowledge`.

## Identity

Use `game.id` as the only identifier shared between the web application and
the rules service. Never join records by a display name or a Notion `pageId`.

## Initial endpoint

`GET /api/knowledge/games` returns:

```json
{
  "games": [{ "id": "sky-mines", "name": "Skymines", "status": "draft" }]
}
```

The web-facing proxy supports `GET` and `POST` at
`/api/rules/knowledge/games`.

To import a rulebook, submit multipart form data with a `file` PDF field and
optional `version` and `language` fields to
`POST /api/rules/knowledge/games/{gameId}/rulebooks`.
