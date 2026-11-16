# E-Commerce Catalog Validator Service

Dependency-free Node.js HTTP server that validates complex payloads for `POST /api/catalog/items`.

## Run
```bash
node server.js     # or: npm start
```
Runs at `http://localhost:3000`.

## POST /api/catalog/items

| Field | Rule |
|---|---|
| `sku` | required, regex `^[A-Z]{3}-\d{4,6}$` (e.g. `ABC-1234`) |
| `price` | required number, must be `> 0` |
| `tags` | array, min 1 item, non-empty strings, all unique (case-insensitive) |
| `vendor` | object with `name`, `email` (valid format), `country` (2-letter code, e.g. `US`) |

Responses:
- `201 Created` - valid payload
- `422 Unprocessable Entity` - payload parsed but failed validation; body has `details: [{field, message}]` listing every problem
- `400 Bad Request` - body is not valid JSON

Valid example:
```json
{
  "sku": "ABC-1234",
  "price": 49.99,
  "tags": ["electronics", "sale"],
  "vendor": { "name": "TechCorp", "email": "sales@techcorp.com", "country": "US" }
}
```

`GET /api/catalog/items` lists created items.

## Postman
Import `Catalog-Validator.postman_collection.json` and run it (server must be running).
It has 1 valid request and 4 distinct 422 cases: invalid SKU, non-positive price, duplicate tags, invalid vendor.
