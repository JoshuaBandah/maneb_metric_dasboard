# Vercel Deployment Guide - MANEB Metrics Dashboard

**Estimated Time**: 15-20 minutes  
**Difficulty**: Easy  
**Cost**: Free (with paid options available)

---

## Prerequisites

Before you start, make sure you have:

- ✅ GitHub account (free at https://github.com)
- ✅ Vercel account (free at https://vercel.com)
- ✅ Git installed on your computer
- ✅ Your project code ready

---

## Step 1: Create a GitHub Repository

### 1.1 Create GitHub Account (if you don't have one)
1. Go to https://github.com
2. Click "Sign up"
3. Enter email, password, username
4. Verify email
5. Done!

### 1.2 Create a New Repository

1. Go to https://github.com/new
2. Fill in the form:
   - **Repository name**: `maneb-dashboard` (or any name you like)
   - **Description**: `MANEB Metrics Dashboard - Real-time monitoring`
   - **Visibility**: Public (or Private if you prefer)
   - **Initialize with README**: Leave unchecked
3. Click "Create repository"

You'll see a page with instructions. Copy the HTTPS URL (looks like `https://github.com/YOUR_USERNAME/maneb-dashboard.git`)

---

## Step 2: Push Your Code to GitHub

Open your terminal/command prompt and run these commands:

### 2.1 Navigate to Your Project
```bash
cd c:\Users\bsc_inf_01_21\Desktop\dashboard\maneb_metric_dasboard
```

### 2.2 Initialize Git (if not already done)
```bash
git init
```

### 2.3 Add All Files
```bash
git add .
```

### 2.4 Create First Commit
```bash
git commit -m "Initial commit: MANEB dashboard with API layer and error monitoring"
```

### 2.5 Add Remote Repository
Replace `YOUR_USERNAME` with your GitHub username:
```bash
git remote add origin https://github.com/YOUR_USERNAME/maneb-dashboard.git
```

### 2.6 Push to GitHub
```bash
git branch -M main
git push -u origin main
```

**What to expect**: It will ask for your GitHub credentials. Enter your username and password (or personal access token).

**Verify**: Go to your GitHub repository URL and you should see all your files there!

---

## Step 3: Deploy on Vercel

### 3.1 Create Vercel Account

1. Go to https://vercel.com
2. Click "Sign Up"
3. Choose "Continue with GitHub"
4. Authorize Vercel to access your GitHub account
5. Done!

### 3.2 Import Your Project

1. After signing in, you'll see the dashboard
2. Click "Add New..." → "Project"
3. Click "Import Git Repository"
4. Search for your repository name (`maneb-dashboard`)
5. Click "Import"

### 3.3 Configure Project

You'll see a configuration page:

**Framework Preset**: Should auto-detect "Next.js" ✅

**Root Directory**: Leave as `.` (default)

**Build and Output Settings**: Leave as default

**Environment Variables**: Add these:

```
NEXT_PUBLIC_API_URL=https://your-backend-url.com
```

(If you don't have a backend yet, you can skip this or use `http://localhost:3000`)

### 3.4 Deploy

1. Click "Deploy"
2. Wait 2-3 minutes for the build to complete
3. You'll see a success message with your live URL!

**Your app is now live!** 🎉

---

## Step 4: Access Your Deployed App

After deployment completes, you'll get a URL like:
```
https://maneb-dashboard.vercel.app
```

Click the link to visit your live dashboard!

### Test It

1. Go to `/login`
2. Try logging in with:
   - Email: `admin@maneb.com`
   - Password: `password123`
3. You should be redirected to the dashboard

---

## Step 5: Configure Environment Variables (Optional)

If you have a real backend, update environment variables:

1. Go to your Vercel project dashboard
2. Click "Settings"
3. Click "Environment Variables"
4. Add your variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-real-backend.com
   ```
5. Click "Save"
6. Vercel will automatically redeploy with new variables

---

## Step 6: Set Up Automatic Deployments

Great news! Vercel automatically deploys when you push to GitHub.

### How It Works

1. You make changes locally
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "Your message"
   git push
   ```
3. Vercel automatically detects the push
4. Vercel rebuilds and deploys your app
5. Your live site updates automatically!

### Monitor Deployments

1. Go to your Vercel project
2. Click "Deployments"
3. You'll see all your deployments with status
4. Click any deployment to see logs

---

## Troubleshooting

### Build Failed

**Problem**: Deployment shows "Build failed"

**Solution**:
1. Click the failed deployment
2. Scroll to "Build Logs"
3. Look for error messages
4. Common issues:
   - Missing environment variables
   - TypeScript errors
   - Missing dependencies

**Fix**: Fix the error locally, commit, and push again.

### App Shows Blank Page

**Problem**: App deploys but shows nothing

**Solution**:
1. Open browser console (F12)
2. Look for errors
3. Check that API endpoints are correct
4. Verify environment variables are set

### Login Not Working

**Problem**: Login button doesn't work

**Solution**:
1. Check that `NEXT_PUBLIC_API_URL` is set correctly
2. Verify backend is running (if you have one)
3. Check browser console for errors
4. Try with test credentials: `admin@maneb.com` / `password123`

### Metrics Not Loading

**Problem**: Dashboard shows "Failed to connect to metrics stream"

**Solution**: This is expected if you don't have a `/metrics/stream` endpoint. You need to:
1. Implement the metrics endpoint on your backend
2. Make sure it returns Server-Sent Events (SSE)
3. Update `NEXT_PUBLIC_API_URL` to point to your backend

---

## Useful Vercel Features

### 1. Preview Deployments

Every time you push to GitHub, Vercel creates a preview deployment:
- Test changes before merging to main
- Share preview URL with team
- Automatic cleanup after merge

### 2. Analytics

View performance metrics:
1. Go to your Vercel project
2. Click "Analytics"
3. See page load times, traffic, etc.

### 3. Logs

View real-time logs:
1. Go to your Vercel project
2. Click "Logs"
3. See API calls, errors, etc.

### 4. Domains

Add a custom domain:
1. Go to "Settings" → "Domains"
2. Add your domain (e.g., `dashboard.maneb.com`)
3. Follow DNS setup instructions
4. Your app is now at your custom domain!

---

## Next Steps After Deployment

### 1. Set Up Custom Domain (Optional)
```
1. Buy domain (GoDaddy, Namecheap, etc.)
2. Go to Vercel project → Settings → Domains
3. Add your domain
4. Update DNS records
5. Done!
```

### 2. Connect Real Backend
```
1. Deploy your backend (Node.js, Python, etc.)
2. Get backend URL
3. Update NEXT_PUBLIC_API_URL in Vercel
4. Redeploy
```

### 3. Set Up Monitoring
```
1. Create Sentry account
2. Get DSN
3. Add to environment variables
4. Errors now tracked automatically
```

### 4. Enable HTTPS (Automatic)
Vercel automatically provides free SSL/HTTPS certificates!

---

## Deployment Checklist

Before deploying, make sure:

- ✅ Code is committed to GitHub
- ✅ No sensitive data in code (use environment variables)
- ✅ Build passes locally: `npm run build`
- ✅ No console errors
- ✅ Environment variables configured in Vercel
- ✅ Backend URL is correct (if applicable)

---

## Common Commands

### Push Changes to GitHub
```bash
git add .
git commit -m "Your message"
git push
```

### View Deployment Status
Go to: `https://vercel.com/dashboard`

### View Live App
Go to: `https://your-project.vercel.app`

### View Logs
Go to: Vercel Dashboard → Deployments → Click deployment → Logs

---

## Pricing

### Free Tier (Perfect for Getting Started)
- ✅ Unlimited deployments
- ✅ Automatic HTTPS
- ✅ Serverless functions (API routes)
- ✅ 100GB bandwidth/month
- ✅ 1GB function execution timeout

### Pro Tier ($20/month)
- ✅ Everything in Free
- ✅ Priority support
- ✅ Advanced analytics
- ✅ Team collaboration

**For your dashboard**: Free tier is more than enough!

---

## Security Best Practices

### 1. Never Commit Secrets
❌ Don't do this:
```javascript
const API_KEY = "sk_live_abc123";
```

✅ Do this instead:
```javascript
const API_KEY = process.env.API_KEY;
```

### 2. Use Environment Variables
1. Add secrets in Vercel dashboard
2. Reference with `process.env.VARIABLE_NAME`
3. Vercel keeps them secure

### 3. Enable Branch Protection
1. Go to GitHub repo → Settings
2. Click "Branches"
3. Add rule for `main` branch
4. Require pull request reviews before merge

### 4. Use HTTPS (Automatic)
Vercel provides free SSL certificates automatically!

---

## Support & Resources

### Vercel Documentation
- https://vercel.com/docs
- https://vercel.com/docs/frameworks/nextjs

### Next.js Documentation
- https://nextjs.org/docs

### GitHub Help
- https://docs.github.com

### Troubleshooting
1. Check Vercel deployment logs
2. Check browser console (F12)
3. Check GitHub Actions (if enabled)
4. Read error messages carefully

---

## Summary

You now have:

✅ Code on GitHub  
✅ App deployed on Vercel  
✅ Live URL to share  
✅ Automatic deployments on every push  
✅ Free HTTPS  
✅ Scalable infrastructure  

**Your dashboard is now live and accessible to anyone!** 🚀

---

## Next Phase: Connect Real Backend

Once you have a backend running, update:

1. **Environment Variable**:
   ```
   NEXT_PUBLIC_API_URL=https://your-backend.com
   ```

2. **Implement Endpoints**:
   - `/api/login` - Real authentication
   - `/metrics/stream` - Real metrics
   - `/api/errors` - Real error tracking

3. **Redeploy**:
   ```bash
   git push
   ```

---

**Deployment Complete!** 🎉

Your MANEB dashboard is now live on Vercel. Share the URL with your team and start monitoring!

For questions or issues, check the troubleshooting section or visit Vercel's documentation.

---

**Last Updated**: May 26, 2026  
**Status**: Ready for Production  
**Next**: Connect Real Backend
