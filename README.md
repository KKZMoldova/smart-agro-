# Smart-Agro

Agricultural management system for KKZ Moldova.
- **SmartVegetable** — vegetable field management (16 parcels, pea, corn, tomato...)
- **SmartOrchard** — cherry & apple orchard management

## Stack
- **Node.js** + Express.js — API server
- **PostgreSQL** — database (hosted on Railway)
- **FieldClimate API** — automatic weather sync every hour (station 00002158, Kaменка)

## Railway Setup

### 1. Environment Variables (Railway → Variables)
```
DATABASE_URL              = (auto-set by Railway PostgreSQL plugin)
FIELDCLIMATE_PUBLIC_KEY   = your_public_key_here
FIELDCLIMATE_PRIVATE_KEY  = your_private_key_here
FIELDCLIMATE_STATION      = 00002158
APP_SECRET                = change_this_to_random_string
NODE_ENV                  = production
```

### 2. Create database tables
In Railway → PostgreSQL → Query:
```sql
-- paste contents of schema.sql
```

### 3. Add HTML files
Place your HTML files in the `public/` folder:
```
public/
  index.html                    ← landing page
  smart-vegetable.html          ← vegetable system
  cherry-orchard-passport.html  ← orchard system
```

### 4. Deploy
```bash
git add .
git commit -m "initial deploy"
git push origin main
```
Railway auto-deploys on every push.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | /api/auth/login | Login with PIN |
| GET | /api/weather | Daily weather data |
| GET | /api/weather/latest | Last 72h hourly |
| GET/POST/DELETE | /api/parcels | Field parcels |
| GET/POST/DELETE | /api/treatments | Spray treatments |
| GET/POST/DELETE | /api/irrigations | Irrigation logs |
| GET/POST/DELETE | /api/analyses | Leaf/soil/water analyses |
| GET/POST/DELETE | /api/catalog | Product catalog |
| GET/POST | /api/settings/:key | App settings & calibration |

## Weather Sync
FieldClimate cron runs every hour at :00.
Manual trigger: restart the Railway service.

## URLs
- `your-app.railway.app/` — landing page
- `your-app.railway.app/vegetable` — SmartVegetable
- `your-app.railway.app/orchard` — SmartOrchard
