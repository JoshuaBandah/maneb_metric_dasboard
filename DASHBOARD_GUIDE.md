# Dashboard Navigation Guide

## Quick Start

### Access the Dashboards

**V1 Dashboard (Traditional Backend)**
```
http://localhost:3000/v1/dashboard
```

**V3 Dashboard (CDN-Based)**
```
http://localhost:3000/v3/dashboard
```

**Default Entry Point**
```
http://localhost:3000/adminDashBoard
→ Automatically redirects to V1 dashboard
```

---

## V1 Dashboard Overview

### Header
```
┌─────────────────────────────────────────────────────────┐
│ V1: Traditional Architecture                [Switch to V3]│
│ Backend-First Approach - Direct Database Queries         │
└─────────────────────────────────────────────────────────┘
```

### Architecture Info
```
┌──────────────────────────────────────────────────────────┐
│ Architecture Flow                                         │
│ User Request → Backend → Database → Response             │
│                                                           │
│ Characteristics                                           │
│ ✓ Every request hits backend server                      │
│ ✓ Backend queries database directly                      │
│ ✓ Results processed and returned                         │
│ ✗ High server load during peaks                          │
│ ✗ Slower response times (100-500ms+)                     │
└──────────────────────────────────────────────────────────┘
```

### Metrics Cards
```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ CPU      │ Memory   │ Avg      │ Requests│ Failed   │ Error    │
│ Usage    │ Usage    │ Latency  │         │ Requests │ Rate     │
│ 0.0%     │ 0.0%     │ 0.0 ms   │ 0       │ 0        │ 0.0%     │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

### Charts
- System + K6 Realtime Trends (Line chart)
- Request Success vs Failure (Doughnut chart)
- Resource Usage (Bar chart)
- K6 Live Snapshot (Table)

---

## V3 Dashboard Overview

### Header
```
┌─────────────────────────────────────────────────────────┐
│ V3: CDN Architecture                      [Switch to V1] │
│ Edge-Based Distribution - Ultra-Fast Frontend Search     │
└─────────────────────────────────────────────────────────┘
```

### Architecture Info
```
┌──────────────────────────────────────────────────────────┐
│ Architecture Flow                                         │
│ CSV Upload → Index → CDN → Frontend Search               │
│                                                           │
│ Characteristics                                           │
│ ✓ Results distributed to CDN edge servers                │
│ ✓ Frontend performs in-memory search                     │
│ ✓ Minimal backend hits                                   │
│ ✓ Ultra-fast response times (1-10ms)                     │
│ ✓ Excellent scalability                                  │
└──────────────────────────────────────────────────────────┘
```

### Tabs
```
┌─────────────────────────────────────────────────────────┐
│ [📊 Metrics & Performance] [📤 Upload Results]           │
└─────────────────────────────────────────────────────────┘
```

#### Tab 1: Metrics & Performance
Same as V1 but with CDN-specific metrics:
- CDN Response Time (instead of Avg Latency)
- CDN-focused performance trends
- K6 metrics for CDN testing

#### Tab 2: Upload Results
```
┌──────────────────────────────────────────────────────────┐
│ Upload School Results CSV                                │
│                                                           │
│ School Name: [________________]                          │
│ CSV File:    [Choose File]                               │
│                                                           │
│ [📤 Upload & Index]                                      │
│                                                           │
│ Status: ✓ CSV uploaded successfully and indexed for CDN  │
└──────────────────────────────────────────────────────────┘
```

---

## Switching Between Versions

### From V1 to V3
1. Click "Switch to V3 (CDN)" button in top right
2. Redirects to `/v3/dashboard`
3. V3 dashboard loads with blue theme

### From V3 to V1
1. Click "Switch to V1 (Backend)" button in top right
2. Redirects to `/v1/dashboard`
3. V1 dashboard loads with red theme

---

## Color Schemes

### V1 Dashboard (Red Theme)
- **Primary Color**: #FF6B6B (Red)
- **Header**: Red title
- **Cards**: Red top border
- **Buttons**: Red background
- **Flow Steps**: Red background
- **Accents**: Red throughout

### V3 Dashboard (Blue Theme)
- **Primary Color**: #45B7D1 (Blue)
- **Header**: Blue title
- **Cards**: Blue top border
- **Buttons**: Blue background
- **Flow Steps**: Blue background
- **Tabs**: Blue active indicator
- **Accents**: Blue throughout

---

## CSV Upload Format (V3 Only)

### File Format
```
regNumber,dob,name,subject1,grade1,subject2,grade2
MW1001,1990-05-15,John Banda,Math,A,English,B
MW1002,1991-03-20,Mary Phiri,Math,B,English,A
```

### Upload Steps
1. Go to V3 Dashboard
2. Click "📤 Upload Results" tab
3. Enter school name (e.g., "Zomba Secondary")
4. Select CSV file
5. Click "📤 Upload & Index"
6. Wait for success message

### Processing
- ✓ Parse CSV file
- ✓ Generate index for fast lookup
- ✓ Create links for each student
- ✓ Upload to CDN
- ✓ Show success/error message

---

## Metrics Explained

### V1 Metrics
- **CPU Usage**: Backend server CPU utilization
- **Memory Usage**: Backend server memory usage
- **Avg Latency**: Average response time from backend
- **Requests**: Total requests to backend
- **Failed Requests**: Requests that failed
- **Error Rate**: Percentage of failed requests
- **K6 Metrics**: Load testing metrics

### V3 Metrics
- **CPU Usage**: CDN edge server CPU utilization
- **Memory Usage**: CDN edge server memory usage
- **CDN Response Time**: Response time from CDN edge
- **Requests**: Total requests to CDN
- **Failed Requests**: Requests that failed
- **Error Rate**: Percentage of failed requests
- **K6 Metrics**: Load testing metrics for CDN

---

## Charts

### System + Realtime Trends
- **Line Chart** showing:
  - Latency over time
  - CPU usage over time
  - K6 Success VUs over time
  - K6 Failed VUs over time

### Request Success vs Failure
- **Doughnut Chart** showing:
  - Green: Successful requests
  - Red: Failed requests

### Resource Usage
- **Bar Chart** showing:
  - CPU usage percentage
  - Memory usage percentage

### K6 Live Snapshot
- **Table** showing:
  - Total VUs
  - Successful VUs
  - Failed VUs
  - Success rate
  - Average wait time
  - Event loop lag
  - P50, P90, P99 latencies
  - Last update time

---

## Responsive Behavior

### Desktop (1200px+)
- Full grid layout
- All charts visible
- Side-by-side cards
- Optimal spacing

### Tablet (768px - 1199px)
- Adjusted grid columns
- Charts stack vertically
- Cards in 2-column layout
- Optimized for touch

### Mobile (< 768px)
- Single column layout
- Charts full width
- Cards stacked
- Tabs vertical (V3)
- Touch-friendly buttons

---

## Troubleshooting

### Dashboard Not Loading
1. Check URL: `/v1/dashboard` or `/v3/dashboard`
2. Ensure backend VPS is running
3. Check `.env.local` for `NEXT_PUBLIC_API_URL`

### Metrics Not Showing
1. Backend VPS must be running
2. Check API endpoints are implemented
3. Verify metrics streaming is working

### CSV Upload Not Working (V3)
1. Check file format (CSV only)
2. Verify school name is entered
3. Check backend upload endpoint
4. Verify CDN is configured

### Switching Not Working
1. Check Next.js routing is working
2. Verify links are correct
3. Check browser console for errors

---

## API Endpoints

### V1 Endpoints
```
POST /api/v1/search
POST /api/v1/upload
GET /api/v1/metrics
```

### V3 Endpoints
```
POST /api/v3/search
POST /api/v3/upload
GET /api/v3/metrics
```

---

## Summary

✅ **Two separate dashboards** with different displays
✅ **Easy switching** with buttons
✅ **V1**: Red theme, backend-focused
✅ **V3**: Blue theme, CDN-focused with upload
✅ **Real-time metrics** for both versions
✅ **Responsive design** for all devices
✅ **CSV upload** for V3 only
✅ **Ready for backend integration**
