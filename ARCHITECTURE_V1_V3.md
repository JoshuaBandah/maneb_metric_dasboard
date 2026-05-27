# V1 vs V3 Architecture - Complete Separation

## Project Structure

```
maneb_metric_dasboard/
├── app/
│   ├── components/
│   │   └── VersionSwitcher.tsx          # Main switcher (toggles between V1 and V3)
│   │
│   ├── v1/                              # V1 INDEPENDENT MODULE
│   │   ├── dashboard/
│   │   │   ├── page.tsx                 # V1 Dashboard UI
│   │   │   └── style/
│   │   │       └── v1-dashboard.module.css
│   │   ├── api/
│   │   │   ├── upload/
│   │   │   │   └── route.ts             # V1: Upload CSV per school
│   │   │   ├── search/
│   │   │   │   └── route.ts             # V1: Search in database
│   │   │   └── metrics/
│   │   │       └── route.ts             # V1: Performance metrics
│   │   └── lib/
│   │       ├── v1-service.ts            # V1 business logic
│   │       └── v1-types.ts              # V1 TypeScript types
│   │
│   ├── v3/                              # V3 INDEPENDENT MODULE
│   │   ├── dashboard/
│   │   │   ├── page.tsx                 # V3 Dashboard UI
│   │   │   └── style/
│   │   │       └── v3-dashboard.module.css
│   │   ├── api/
│   │   │   ├── upload/
│   │   │   │   └── route.ts             # V3: Upload CSV + generate index
│   │   │   ├── generate-index/
│   │   │   │   └── route.ts             # V3: Generate index + links
│   │   │   └── metrics/
│   │   │       └── route.ts             # V3: Performance metrics
│   │   └── lib/
│   │       ├── v3-service.ts            # V3 business logic
│   │       ├── v3-types.ts              # V3 TypeScript types
│   │       └── index-generator.ts       # V3: Index generation logic
│   │
│   ├── adminDashBoard/
│   │   ├── page.tsx                     # Main dashboard with switcher
│   │   └── style/
│   │       └── dashBoard.module.css
│   │
│   └── layout.tsx
│
├── student-portal/                      # SEPARATE PROJECT (Built independently)
│   ├── v1-portal/
│   │   ├── page.tsx                     # V1 Student Portal
│   │   └── api/
│   │       └── search/
│   │           └── route.ts             # V1: Search endpoint
│   │
│   └── v3-portal/
│       ├── page.tsx                     # V3 Student Portal
│       └── api/
│           └── search/
│               └── route.ts             # V3: Search endpoint
│
└── scripts/
    ├── v1-process-csv.py                # V1: Process CSV (store in DB)
    └── v3-process-csv.py                # V3: Process CSV + generate index
```

---

## V1 Flow (Traditional - Backend)

```
CSV Upload (zomba_secondary.csv)
    ↓
Backend stores in Database
    ↓
Student searches (reg number + DOB)
    ↓
Backend queries Database
    ↓
Returns results
    ↓
Display to student
```

**Files involved**: V1 API routes, V1 Dashboard, V1 Student Portal

---

## V3 Flow (CDN - Optimized)

```
CSV Upload (zomba_secondary.csv)
    ↓
Script processes CSV
    ↓
Generates index + links (within same school file)
    ↓
School file structure:
{
  "school": "Zomba Secondary",
  "students": [
    {
      "regNumber": "MW1001",
      "dob": "1990-05-15",
      "name": "John Banda",
      "link": "https://cdn.example.com/zomba_secondary/MW1001_1990-05-15.html",
      "subjects": [...]
    }
  ],
  "index": {
    "MW1001_1990-05-15": 0,  // Index in students array
    "MW1002_1991-03-20": 1
  }
}
    ↓
Upload to CDN
    ↓
Student searches (reg number + DOB)
    ↓
Frontend loads school file from CDN
    ↓
Uses index to find student
    ↓
Loads specific student link
    ↓
Display results
```

**Files involved**: V3 API routes, V3 Dashboard, V3 Student Portal

---

## Key Differences

| Aspect | V1 | V3 |
|--------|----|----|
| **Storage** | Database | CDN |
| **Processing** | Backend | Frontend |
| **Index** | Database query | JSON index in file |
| **Link** | Generated on request | Pre-generated in file |
| **Speed** | Slower (backend hit) | Faster (CDN + frontend) |
| **Scalability** | Limited | Excellent |

---

## Important Notes

1. **V1 and V3 are COMPLETELY SEPARATE**
   - Different API routes
   - Different dashboards
   - Different logic
   - No shared code (except types)

2. **Dashboard Switcher**
   - Only switches UI
   - Calls appropriate V1 or V3 API
   - No data mixing

3. **Student Portal**
   - Built separately
   - Will link to V1 or V3 later
   - Independent logic

4. **CSV Processing**
   - V1: Stores in database
   - V3: Generates index + links in same file

---

## No Confusion Guarantee

✅ Each version has its own folder
✅ Each version has its own API routes
✅ Each version has its own dashboard
✅ Each version has its own logic
✅ Switcher just toggles between them
✅ Student portal is separate

**Result**: Zero confusion, clear separation of concerns!
