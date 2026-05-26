# MANEB Metrics Dashboard - Architecture Guide

## Overview
The MANEB Metrics Dashboard is a real-time monitoring application built with Next.js that displays system metrics and load test results from K6.

## Technology Stack
- **Frontend**: Next.js 16.2.3, React 19.2.4, TypeScript
- **Styling**: CSS Modules
- **Charts**: Chart.js + react-chartjs-2
- **Load Testing**: K6
- **State Management**: React Hooks (useState, useEffect)

## Project Structure

```
app/
├── components/              # Reusable React components
│   └── ErrorBoundary.tsx   # Global error boundary
├── hooks/                   # Custom React hooks
│   └── useMetricsStream.ts # EventSource metrics streaming
├── lib/                     # Utility functions and validators
│   └── validators.ts       # Form validation functions
├── login/                   # Login page
│   ├── page.tsx            # Login component
│   └── styles/
│       └── login.module.css # Login styles
├── adminDashBoard/          # Admin dashboard page
│   ├── page.tsx            # Dashboard component
│   └── style/
│       └── dashBoard.module.css # Dashboard styles
├── layout.tsx              # Root layout
├── page.tsx                # Home page
├── globals.css             # Global styles
└── middleware.ts           # Route protection middleware

public/                      # Static assets
├── maneb.png              # MANEB logo
└── ...

k6/                         # Load testing scripts
├── break-test.js
├── break-you.js
└── k6-populate-results.js
```

## Data Flow

### 1. Authentication Flow
```
User → Login Page → Validation → Dashboard
```
- User enters email and password
- Client-side validation checks format and length
- On submit, credentials are sent to backend (TODO: implement API)
- On success, user is redirected to dashboard
- TODO: Token stored in httpOnly cookie

### 2. Metrics Streaming Flow
```
Backend → EventSource → useMetricsStream Hook → State → Charts
```
1. Dashboard mounts and calls `useMetricsStream('/metrics/stream')`
2. Hook creates EventSource connection to backend
3. Backend sends metrics every second as JSON
4. Hook parses data and updates state
5. History is maintained (last 20 data points)
6. Charts re-render with new data
7. On connection error, auto-reconnect after 5 seconds

### 3. Error Handling Flow
```
Error → ErrorBoundary → User sees error message → Refresh option
```
- React errors caught by ErrorBoundary component
- EventSource errors caught in hook and displayed to user
- Validation errors shown inline on form fields

## Key Components

### LoginPage (`app/login/page.tsx`)
- Handles user authentication
- Real-time form validation
- Field-level error messages
- Loading state during submission

**Props**: None (page component)

**State**:
- `email`: User email input
- `password`: User password input
- `error`: General form error
- `fieldErrors`: Per-field validation errors
- `loading`: Submission loading state

### AdminDashboard (`app/adminDashBoard/page.tsx`)
- Displays real-time system metrics
- Shows K6 load test results
- Multiple chart visualizations
- System health status

**Props**: None (page component)

**State**: Managed by `useMetricsStream` hook

**Charts**:
- Trend chart: Latency, CPU, K6 success/failed VUs
- Error chart: Success vs failed requests (doughnut)
- Resource chart: CPU and memory usage (bar)
- K6 snapshot: Detailed metrics table

### useMetricsStream Hook (`app/hooks/useMetricsStream.ts`)
Custom hook for streaming metrics from server via EventSource.

**Parameters**:
- `url` (string): EventSource endpoint URL

**Returns**:
```typescript
{
  metrics: MetricsData | null,
  history: HistoryEntry[],
  loading: boolean,
  error: string | null
}
```

**Features**:
- Auto-reconnect on connection failure
- History limited to 20 entries (prevents memory bloat)
- Error logging and user feedback
- Proper cleanup on unmount

### ErrorBoundary (`app/components/ErrorBoundary.tsx`)
React Error Boundary component for catching and displaying errors.

**Features**:
- Catches React component errors
- Displays user-friendly error message
- Provides refresh button
- Logs errors to console (TODO: send to monitoring service)

## Validation System

### Email Validation
- Required field check
- RFC-compliant email format check
- Real-time validation on input change
- Validation on blur event

### Password Validation
- Required field check
- Minimum 6 characters
- Real-time validation on input change
- Validation on blur event

### Form Validation
- All fields must be valid
- Submit button disabled until form is valid
- Validation runs on submit as final check

## Environment Configuration

### Environment Variables
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

- `NEXT_PUBLIC_API_URL`: Backend API endpoint (must be public, exposed to client)

### Configuration Files
- `.env.local`: Local development environment variables
- `.env.example`: Template for environment variables
- `next.config.ts`: Next.js configuration
- `tsconfig.json`: TypeScript configuration
- `eslint.config.mjs`: ESLint configuration

## Security Considerations

### Current Implementation
- ✅ Form validation (client-side)
- ✅ Error boundary for crash prevention
- ✅ Environment variable separation

### TODO: Security Improvements
- [ ] Implement authentication API
- [ ] Add protected routes middleware
- [ ] Store auth token in httpOnly cookie
- [ ] Add CSRF protection
- [ ] Add security headers (CSP, X-Frame-Options, etc.)
- [ ] Implement rate limiting
- [ ] Add input sanitization
- [ ] Add HTTPS enforcement

## Performance Considerations

### Current Optimizations
- ✅ CSS Modules (prevents style conflicts)
- ✅ History limited to 20 entries
- ✅ EventSource for efficient streaming

### TODO: Performance Improvements
- [ ] Lazy load Chart.js components
- [ ] Memoize Card and Row components
- [ ] Extract inline styles to CSS
- [ ] Optimize logo image with Next.js Image component
- [ ] Implement code splitting
- [ ] Add caching strategy
- [ ] Batch history updates

## Testing Strategy

### Current Coverage
- ❌ No unit tests
- ❌ No integration tests
- ❌ No E2E tests

### TODO: Testing Implementation
- [ ] Add Vitest for unit tests
- [ ] Test validators (email, password)
- [ ] Test useMetricsStream hook
- [ ] Test form validation logic
- [ ] Add React Testing Library for component tests
- [ ] Add Cypress/Playwright for E2E tests
- [ ] Add K6 load tests to CI/CD

## Deployment

### Build Process
```bash
npm run build
npm run start
```

### Environment Setup
1. Copy `.env.example` to `.env.local`
2. Update `NEXT_PUBLIC_API_URL` to production backend URL
3. Run `npm run build`
4. Run `npm run start`

### Production Checklist
- [ ] Enable HTTPS
- [ ] Set secure cookies
- [ ] Configure CORS
- [ ] Enable rate limiting
- [ ] Set up error monitoring (Sentry, etc.)
- [ ] Set up performance monitoring
- [ ] Configure CDN for static assets
- [ ] Set up automated backups

## Future Enhancements

### Phase 1: Security & Auth
- Implement JWT authentication
- Add protected routes
- Add logout functionality
- Add password reset flow

### Phase 2: Testing & Quality
- Add comprehensive test suite
- Add E2E tests
- Add performance monitoring
- Add error tracking

### Phase 3: Features
- Add user management
- Add dashboard customization
- Add alert notifications
- Add data export functionality

### Phase 4: Infrastructure
- Add CI/CD pipeline
- Add automated deployments
- Add monitoring and alerting
- Add backup and recovery

## Troubleshooting

### Metrics not loading
1. Check if backend is running
2. Verify `NEXT_PUBLIC_API_URL` is correct
3. Check browser console for errors
4. Check network tab for EventSource connection

### Login not working
1. Check form validation errors
2. Verify backend API endpoint exists
3. Check browser console for errors
4. Verify credentials are correct

### Charts not displaying
1. Check if metrics data is being received
2. Verify Chart.js is loaded
3. Check browser console for errors
4. Verify chart data format is correct

## Contributing

### Code Style
- Use TypeScript for type safety
- Follow ESLint rules
- Use CSS Modules for styling
- Add JSDoc comments for functions
- Keep components small and focused

### Before Committing
1. Run `npm run lint`
2. Run `npm run build`
3. Test manually in browser
4. Update documentation if needed

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Chart.js Documentation](https://www.chartjs.org/docs/latest/)
- [K6 Documentation](https://k6.io/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
