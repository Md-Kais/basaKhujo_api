# BasaKhujo API

A TypeScript/Express + Prisma + PostgreSQL backend for the BasaKhujo home‑rental platform. Roles: **TENANT** and **LANDLORD**. Core modules: auth, properties, locations (Bangladesh: Division → District → Upazila), bookings (request → confirm → complete/cancel), favorites (toggle + listings), and messaging (DMs; by‑property start is currently disabled).

---

**Docs & links**

* 📄 **Project Report (PDF):** [Report.pdf](https://github.com/Md-Kais/basaKhujo_api/blob/main/CSE616_ProjectReport_TeamNo28.pdf)
* 🖥️ Frontend (BasaKhujo): [https://github.com/mdsoponabdullah/BasaKhojo/tree/main/basakhojo](https://github.com/mdsoponabdullah/BasaKhojo/tree/main/basakhojo)


## Tech stack

* **Runtime:** Node.js (LTS) + TypeScript
* **Web:** Express
* **ORM:** Prisma
* **DB:** PostgreSQL (Neon in prod recommended)
* **Auth:** JWT
* **Validation:** Zod
* **Deployment:** Render

> Tip: `amenities` is stored as a Postgres `text[]` via Prisma `String[]`.

---

## Project setup (local)

### 1) Clone & install

```bash
git clone https://github.com/Md-Kais/basaKhujo_api.git
cd basaKhujo_api
npm i
```

### 2) Environment variables

Create a `.env` in the project root:

```env
# PostgreSQL 
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require(non-pooled)"

# App
NODE_ENV=development
PORT=10000

# JWT
JWT_ACCESS_SECRET=""
JWT_REFRESH_SECRET=""
JWT_ACCESS_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"

# REDIS
REDIS_URL=""
```

### 3) Prisma: format, validate, migrate

```bash
npx prisma format
npx prisma validate
npx prisma migrate dev --name init
```

### 4) Build & run

```bash
# Clean existing build
rm -rf dist

# Compile TypeScript
npm run build    # or: tsc -p tsconfig.json

# Run compiled app
node dist/src/server.js

# or (if package.json provides it)
npm start
```

### 5) Health check

```bash
curl -i http://localhost:10000/health
```

You should see `{ ok: true, env: ..., time: ... }`.

---

## Database notes

* Prisma models live in `prisma/schema.prisma`.
* Use `npx prisma migrate dev` locally; in CI/prod use `npx prisma migrate deploy`.
* Postgres arrays: `amenities` is `String[]` in Prisma → `text[]` in Postgres.

---

## API quickstart (manual happy path)

### 1) Register

**POST** `/api/auth/register`

```json
{ "email": "teslo5.user@example.com", "password": "Passw0rd!", "role": "LANDLORD" }
```

Or as tenant:

```json
{ "email": "tenant134.user@example.com", "password": "Passw0rd!", "role": "TENANT" }
```

### 2) Login → get JWT

**POST** `/api/auth/login`

```json
{ "email": "teslo5.user@example.com", "password": "Passw0rd!" }
```

Response contains an access token. Use it as `Authorization: Bearer <token>`.

### 3) Create a property (as LANDLORD)

**POST** `/api/properties/`

```json
{
  "title": "Liton's Flat",

  "description": "Spacious 3 bedroom flat",
  "rentMonthly": 25000,
  "deposit": 50000,
  "type": "APARTMENT",
  "lat": "22.473984",
  "lon": "91.794383",
  "bedrooms": 3,
  "bathrooms": 2,
  "areaSqft": 1200,
  "amenities": ["Lift", "Parking"],
  "imageUrls": [
    "https://example.com/img1.jpg",
    "https://example.com/img2.jpg"
  ],
  "addressLine": "Dhanmondi, Road 5",
"divisionId": 6,
  "districtId": 36,
  "upazilaId": 301
}

```

> **Note:** add image URLs when posting properties (your UI should collect and send them; server persists them under the property’s images relation).

### 4) Bookings (TENANT requests; LANDLORD confirms/completes)

Create booking (tenant):

**POST** `/api/bookings/`

```json
{ "propertyId": "<PROPERTY_ID>", "startDate": "2025-10-01", "endDate": "2025-10-05" }
```

Confirm booking (landlord):

**PATCH** `/api/bookings/{bookingId}/confirm`

```json
{}
```

Complete booking (landlord):

**PATCH** `/api/bookings/{bookingId}/complete`

```json
{ "setPropertyListed": true }
```

Cancel booking (tenant or landlord if it’s theirs):

**PATCH** `/api/bookings/{bookingId}/cancel`

```json
{}
```

Fetch my bookings (tenant):

**GET** `/api/bookings/`

Fetch by ID:

**GET** `/api/bookings/{bookingId}`

### 5) Favorites (TENANT)

* **GET** `/api/favorites` – all favorite rows for the user
* **GET** `/api/favorites/properties?page=1&limit=12&orderBy=createdAt&order=desc` – favorited properties (paginated)
* **POST** `/api/favorites/toggle/{PROPERTY_ID}` – toggles favorite on/off for a property

### 6) Locations (public)

* **GET** `/api/locations/divisions`
* **GET** `/api/locations/divisions/:id`
* **GET** `/api/locations/divisions/:id/districts`
* **GET** `/api/locations/districts/:id/upazilas`

### 7) Messaging

* **POST** `/api/messages/conversations` `{ "userId": "OTHER_USER_ID" }` – start DM by userId
* **POST** `/api/messages/conversations/by-property` `{ "propertyId": "PROPERTY_ID" }` – **disabled for now**
* **GET** `/api/messages/conversations` – list my conversations
* **GET** `/api/messages/conversations/{CONVO_ID}/messages?limit=20` – page messages
* **POST** `/api/messages/conversations/{CONVO_ID}/messages` `{ "content": "YOUR MESSAGE" }` – send message

---

## End‑to‑end smoke (curl)

```bash
# Register two users
curl -sX POST :10000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"landlord@example.com","password":"Passw0rd!","role":"LANDLORD"}'
curl -sX POST :10000/api/auth/register -H 'Content-Type: application/json' \
  -d '{"email":"tenant@example.com","password":"Passw0rd!","role":"TENANT"}'

# Login
LL=$(curl -sX POST :10000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"landlord@example.com","password":"Passw0rd!"}' | jq -r .token)
TN=$(curl -sX POST :10000/api/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"tenant@example.com","password":"Passw0rd!"}' | jq -r .token)

# Create property (landlord)
PROP=$(curl -sX POST :10000/api/properties/ -H "Authorization: Bearer $LL" -H 'Content-Type: application/json' \
  -d '{"title":"Test Flat","description":"Cozy studio, balcony","rentMonthly":15000,"addressLine":"House 10, Road 5","divisionId":6,"districtId":36,"upazilaId":301,"bedrooms":1,"bathrooms":1,"type":"APARTMENT","amenities":["WIFI","PARKING","BALCONY"]}' | jq -r .id)

# Request booking (tenant)
BOOK=$(curl -sX POST :10000/api/bookings/ -H "Authorization: Bearer $TN" -H 'Content-Type: application/json' \
  -d "{\"propertyId\":\"$PROP\",\"startDate\":\"2025-10-01\",\"endDate\":\"2025-10-05\"}" | jq -r .id)

# Confirm (landlord) then complete
curl -sX PATCH :10000/api/bookings/$BOOK/confirm -H "Authorization: Bearer $LL" -H 'Content-Type: application/json' -d '{}'
curl -sX PATCH :10000/api/bookings/$BOOK/complete -H "Authorization: Bearer $LL" -H 'Content-Type: application/json' -d '{"setPropertyListed":true}'

# Toggle favorite (tenant)
curl -sX POST :10000/api/favorites/toggle/$PROP -H "Authorization: Bearer $TN"
```

---

## Deploying to Render (with Neon)

### 0) Create a Neon Postgres DB

* Create a database and copy its connection string. It usually looks like:
  `postgresql://USER:PASSWORD@HOST/dbname?sslmode=require` (keep `sslmode=require`).

### 1) New → Web Service on Render

* Connect your GitHub repo.
* **Build Command:** `npm ci && npx prisma generate && npm run build`
* **Start Command:** `node dist/src/server.js` (or `npm start` if configured)

### 2) Environment

* Add `DATABASE_URL` with your Neon URL.
* Add `JWT_SECRET` and any other secrets.
* Optional: set `PORT` (Render also sets a default). Ensure your app listens on that port.

### 3) Apply migrations on deploy

One of the following:

* **Pre‑deploy command (recommended):** set `npx prisma migrate deploy` so migrations run before a new version goes live.
* **One‑off job:** trigger a job with `npx prisma migrate deploy` (useful if you prefer manual control).

### 4) Re‑deploy

Trigger a deploy. Watch logs for: build → migrate → start → healthy.

---

## Scripts (suggested)

Add these in `package.json` if not present:

```json
{
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only src/server.ts",
    "build": "tsc -p tsconfig.json",
    "start": "node dist/src/server.js",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  }
}
```

---

## API reference (detailed)

### Auth

* `POST /api/auth/register` — email, password, role (`TENANT`|`LANDLORD`)
* `POST /api/auth/login` — returns JWT

### Properties

* `POST /api/properties/` — create (LANDLORD)
* `GET /api/properties/:id` — detail (includes images, basic landlord info)
* `GET /api/properties?query…` — list/filter (optional)

**Property schema (excerpt):**

```prisma
model Property {
  id            String   @id @default(cuid())
  title         String
  description   String
  rentMonthly   Int
  deposit       Int?
  type          String?
  bedrooms      Int?
  bathrooms     Int?
  areaSqft      Int?
  amenities     String[]
  addressLine   String
  lat           Float?
  lon           Float?
  status        PropertyStatus @default(LISTED)
  availableFrom DateTime?
  divisionId    Int
  districtId    Int
  upazilaId     Int
  landlordId    String
  landlord      User   @relation("UserProperties", fields: [landlordId], references: [id])
  images        PropertyImage[]
  favorites     Favorite[]
  bookings      Booking[]
  reviews       PropertyReview[]
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  division      Division @relation("DivisionProperties", fields: [divisionId], references: [id])
  district      District @relation("DistrictProperties", fields: [districtId], references: [id])
  upazila       Upazila  @relation("UpazilaProperties", fields: [upazilaId], references: [id])
  @@index([divisionId, districtId, upazilaId])
  @@index([status])
  @@index([rentMonthly])
}
```

### Locations

* `GET /api/locations/divisions`
* `GET /api/locations/divisions/:id`
* `GET /api/locations/divisions/:id/districts`
* `GET /api/locations/districts/:id/upazilas`

### Bookings

* `POST /api/bookings/` — tenant requests
* `PATCH /api/bookings/:id/confirm` — landlord confirms
* `PATCH /api/bookings/:id/complete` — landlord completes
* `PATCH /api/bookings/:id/cancel` — tenant/landlord cancels
* `GET /api/bookings/` — my bookings (tenant)
* `GET /api/bookings/:id` — booking by ID (includes property preview)
* **Landlord analytics:**

  * `GET /api/bookings/landlord/stats`
  * `GET /api/bookings/landlord/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`
  * `GET /api/bookings/landlord/requests?page=1&limit=12`
  * `GET /api/bookings/landlord/confirmed?page=1&limit=12`
  * `GET /api/bookings/landlord/confirmed?from=YYYY-MM-DD&to=YYYY-MM-DD&page=1&limit=12`
  * `GET /api/bookings/landlord/cancelled?page=1&limit=12`
  * `GET /api/bookings/landlord/completed?page=1&limit=12`

### Favorites

* `GET /api/favorites` — my favorites (rows)
* `GET /api/favorites/properties?page=1&limit=12&orderBy=createdAt&order=desc` — favorited properties
* `POST /api/favorites/toggle/:propertyId` — toggle favorite

### Messages

* `POST /api/messages/conversations` `{ userId }` — start DM by userId
* `POST /api/messages/conversations/by-property` `{ propertyId }` — **disabled**
* `GET /api/messages/conversations` — list conversations
* `GET /api/messages/conversations/:id/messages?limit=20` — page messages
* `POST /api/messages/conversations/:id/messages` `{ content }` — send message

---

## Testing

* Manual via curl/Postman/Thunder Client.
* (Optional) Add Jest + Supertest for route contracts.

Example test sketch (Jest + Supertest):

```ts
import request from 'supertest';
import app from '../src/app';

describe('Health', () => {
  it('GET /health -> ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
```

---

## Contributing

PRs welcome. Please:

* Sopon Abdullah for testing the api and reach me out as soon as found any bugs.
