---
  name: openapi-codegen
  description: Parse OpenAPI/Swagger specs and generate type-safe TypeScript API client functions with request and response types.
---
 
# OpenAPI Codegen
 
Generate TypeScript API request functions and types from OpenAPI/Swagger specifications.
 
Function Format: `export async function <method><RouteName>(params)`
 
## Constraints
 
- `fetchData.ts` is readonly
- Format all generated files according to `.prettierrc`
- Do NOT add runtime checks (e.g. `Object.keys`, `null/undefined` guards, conditional spreads) — type safety is enforced by TypeScript types
- Do NOT filter query params — use `new URLSearchParams(search)` directly
## Rules
 
- Function name must be: `<method><RouteLastSegment>`
  - Example:
    - `GET /user` → `getUser`
    - `POST /user` → `postUser`
    - `POST /api/v1/patrol/current` → `postCurrent`
- Import:
```ts
import fetchData from "@/utils/fetchData";
```
 
---
 
### File Output Rules
 
- All generated API files must be placed under:
src/api/
- If the directory does not exist, create it automatically.
- Group APIs by route segment and generate files as:
<segment>.api.ts
- Rules for determining `<segment>`:
  - Ignore common prefixes like `/api`, `/v1`, `/v2`
  - Use the main resource segment in the path
- Examples:
  - `/user` → `src/api/user.api.ts`
  - `/api/v1/user/list` → `src/api/user.api.ts`
  - `/api/v1/patrol/current` → `src/api/patrol.api.ts`
---
 
### GET Requests
- Function signature: `(search: Record<string, any>)`
- Implementation:
```ts
const params = new URLSearchParams(search);
return fetchData<XXXResponse>(url + `?${params.toString()}`);
```
- `XXXResponse` must be inferred from the OpenAPI response schema
---
 
### Non-GET Requests (POST / PUT / DELETE)
 
- Generate a request type from OpenAPI schema: `type XXXRequest { ... }`
- Function signature: `(data: XXXRequest)`
- Implementation:
```ts
return fetchData(url, {
  method: "<METHOD>",
  body:JSON.stringify(data),
});
```
 
- Response type is NOT required
---
 
### Type Generation Rules
 
- All types MUST use `type` instead of `interface`.
- Only generate types for the `data` field of the response.
  - The wrapper fields (`code`, `message`, `succeeded`...) are handled by `fetchData` internally.
  - Example: if the OpenAPI response schema is `{ code, data: { id, name } }`, generate only:
    ```ts
    type UserResponse = {
      id: string;
      name: string;
    };
    ```
 
---
 
### Type File Output Rules
 
- All generated types must be placed under: 
`src/types/`
- Each module must generate its own type file:
`<resource>.type.ts`
- Example
  - `/user` → `src/types/user.type.ts`
  - `/api/v1/patrol/current` → `src/types/patrol.type.ts`
---
 
### Naming Convention
- Request type: `XXXRequest`
- Response type: `XXXResponse`
- Must always end with suffix:
  - Request for request body
  - Response for API response
---
 
## Example
```ts
import fetchData from "@/utils/fetchData";
 
export async function getUser(search: Record<string, any>) {
  const params = new URLSearchParams(search);
  return fetchData<UserResponse[]>(`/user?${params.toString()}`);
}
 
export async function postCurrent(data: CreatePatrolRequest) {
  return fetchData(`/api/v1/patrol/current`, {
    method: "POST",
    body:JSON.stringify(data),
  });
}
```
 
---
 
## Quick Start
 
1. Read OpenAPI spec JSON from local file
- The file must be located at: `./openapi.json`
- If the file does not exist, stop execution and prompt: "openapi.json not found in current directory, please provide it."
2. Parse the JSON and iterate all paths
3. For each endpoint:
- Extract method (get/post/put/delete)
- Extract route (e.g. `/user`)
- Extract:
  - query params
  - requestBody (for non-GET)
  - response schema (for GET)
4. Generate:
- TypeScript types
- API functions following the rules above
- Output files into `src/api/` based on grouping rules
5. Read prettier config from `./.prettierrc` and apply those formatting rules to all generated files
- If `./.prettierrc` does not exist, use Prettier defaults
6. Save the codegen script to `./scripts/openapi-codegen.ts` for future reuse