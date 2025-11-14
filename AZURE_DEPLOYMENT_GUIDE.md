# Azure App Service Deployment Guide

Complete step-by-step guide for deploying your Node.js API to Azure App Service.

## Prerequisites

- ✅ Azure App Service created
- ✅ Azure CLI installed and logged in (`az login`)
- ✅ Your server code ready

## Step-by-Step Deployment

### Step 1: Navigate to Your Server Folder

```bash
cd "/Users/alyx1412/Library/Mobile Documents/com~apple~CloudDocs/Projects/taracamp-api/server"
```

### Step 2: Create a ZIP File (Excluding node_modules)

```bash
zip -r ../deploy.zip . -x "node_modules/*" ".git/*" "*.log" ".env"
```

This creates `deploy.zip` in the parent directory, excluding:
- `node_modules/` (will be installed by Azure automatically)
- `.git/` (not needed for deployment)
- `*.log` (log files)
- `.env` (sensitive files - use Azure environment variables instead)

### Step 3: Deploy the ZIP to Azure

```bash
az webapp deploy source config-zip \
  --resource-group taracamp-rg \
  --name taracamp-api \
  --src ../deploy.zip
```

Wait for deployment to complete (usually 2-5 minutes).

### Step 4: Set the Startup Command

1. Go to **Azure Portal** → Your App Service → **Settings** → **Configuration**
2. Go to **General settings** tab
3. Find **Startup Command** field
4. Set it to:
   ```bash
   npm start
   ```
   *(No `npm install` needed - Azure handles it automatically)*
5. Click **Save** at the top
6. Click **Continue** when prompted to restart

### Step 5: Configure Environment Variables

1. In **Azure Portal** → **Settings** → **Configuration** → **Application settings**
2. Click **+ New application setting** for each variable:

#### Required Environment Variables:

- **`DB_CONN`** - Your MongoDB connection string
  - Example: `mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority`

- **`REDIS_URL`** - Your Redis connection string
  - Example: `redis://username:password@host:port` or `rediss://...` for SSL

- **`JWT_SECRET`** - Random secret for JWT tokens
  - Generate with: `openssl rand -base64 32`

- **`JWT_REFRESH_SECRET`** - Random secret for refresh tokens
  - Generate with: `openssl rand -base64 32`

- **`ALLOWED_ORIGINS`** - Comma-separated list of allowed frontend domains
  - Example: `https://yourdomain.com,https://www.yourdomain.com`
  - **Important:** Include all Azure Static Web App URLs (e.g., `https://kind-ground-0e4bc6700.3.azurestaticapps.net`)
  - If you have multiple frontend apps, separate them with commas: `https://app1.azurestaticapps.net,https://app2.azurestaticapps.net`

#### Optional Environment Variables:

- **`GOOGLE_APPLICATION_CREDENTIALS`** - Path to Google credentials file
  - Example: `/home/site/wwwroot/eighth-parity-474012-a2-e43b626c3437.json`
  - *(Make sure the file is included in your deployment)*

- **`BUCKET_NAME`** - Google Cloud Storage bucket name

- **`EMAIL_ADDRESS`** - Email for sending emails

- **`EMAIL_PASSWORD`** - Email password or app-specific password

- **`PAYMONGO_SECRET_KEY`** - For payment processing

- **`PAYMONGO_WEBHOOK_SECRET`** - For payment webhooks

- **`GOOGLE_CLIENT_ID`** - For Google OAuth login

- **`GOOGLE_CLIENT_SECRET`** - For Google OAuth login

- **`FACEBOOK_APP_ID`** - For Facebook OAuth login

- **`FACEBOOK_APP_SECRET`** - For Facebook OAuth login

3. Click **Save** at the top
4. Click **Continue** when prompted to restart

### Step 6: Verify Deployment

#### Check Log Stream

1. Go to **Azure Portal** → **Monitoring** → **Log stream**
2. Look for: `API listening at http://localhost:XXXX`
3. If you see errors, check:
   - Missing environment variables
   - Database connection issues
   - Redis connection issues

#### Test Your API

```bash
curl https://taracamp-api.azurewebsites.net/
```

Should return: `{"error":"Not found"}` (this means the server is running!)

### Step 7: Test Your Endpoints

Test the login endpoint:

```bash
curl -X POST https://taracamp-api.azurewebsites.net/api/v1/user/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

Expected responses:
- **400 Bad Request** - Endpoint is working, but request validation failed (expected)
- **401 Unauthorized** - Endpoint is working, but credentials are invalid (expected)
- **500 Internal Server Error** - Check Log Stream for details

## Quick Reference Commands

### Create and Deploy ZIP

```bash
cd "/Users/alyx1412/Library/Mobile Documents/com~apple~CloudDocs/Projects/taracamp-api/server"
zip -r ../deploy.zip . -x "node_modules/*" ".git/*" "*.log" ".env"
az webapp deployment source config-zip \
  --resource-group taracamp-rg \
  --name taracamp-api \
  --src ../deploy.zip
```

### Startup Command

```bash
npm start
```

### Your App URL

```
https://taracamp-api.azurewebsites.net
```

## Important Notes

- ✅ **Always exclude `node_modules`** from deployment - Azure will install dependencies automatically
- ✅ **Use Azure environment variables** instead of `.env` files for security
- ✅ **Check Log Stream** if the app doesn't start - it shows detailed error messages
- ✅ **First deployment takes 2-5 minutes** - Azure needs to install all npm packages
- ✅ **Restart the app** after changing environment variables or startup command

## Troubleshooting

### App Won't Start

1. Check **Log Stream** in Azure Portal for error messages
2. Verify all required environment variables are set
3. Check database and Redis connection strings are correct
4. Ensure MongoDB and Redis allow connections from Azure IPs

### Permission Errors

If you see `EACCES: permission denied` errors:
- Redeploy without `node_modules` (as shown in this guide)
- Use startup command: `npm start` (not `npm install && npm start`)

### "Cannot POST" Errors

- Verify the route path is correct: `/api/v1/[resource]/[endpoint]`
- Check Log Stream to see if the app started successfully
- Ensure environment variables are set correctly

### CORS Errors

If you see errors like `"Origin https://your-frontend.azurestaticapps.net is not allowed by Access-Control-Allow-Origin"`:

1. **Check the origin URL** in the error message (e.g., `https://kind-ground-0e4bc6700.3.azurestaticapps.net`)
2. **Go to Azure Portal** → Your App Service → **Configuration** → **Application settings**
3. **Find or create `ALLOWED_ORIGINS`** environment variable
4. **Add the origin URL** to the comma-separated list:
   - If `ALLOWED_ORIGINS` doesn't exist, create it with: `https://kind-ground-0e4bc6700.3.azurestaticapps.net`
   - If it exists, append the new origin: `existing-origin.com,https://kind-ground-0e4bc6700.3.azurestaticapps.net`
5. **Save** and **restart** the app
6. **Verify** by checking the Log Stream - you should see: `CORS: Origin https://kind-ground-0e4bc6700.3.azurestaticapps.net is allowed`

**Using Azure CLI:**
```bash
# Add or update ALLOWED_ORIGINS (replace with your actual origins)
az webapp config appsettings set \
  --resource-group taracamp-rg \
  --name taracamp-api \
  --settings ALLOWED_ORIGINS="https://kind-ground-0e4bc6700.3.azurestaticapps.net"
```

### Database Connection Errors

- Verify MongoDB connection string format
- Check MongoDB firewall allows Azure IPs
- Test connection string locally first

## Next Steps

After successful deployment:

- [ ] Update frontend applications to point to the new Azure URL
- [ ] Configure custom domain (optional) in Azure Portal
- [ ] Set up SSL certificate for custom domain
- [ ] Configure auto-scaling if needed
- [ ] Set up monitoring and alerts
- [ ] Configure backup strategies

## Updating Your Deployment

When you make code changes:

1. Navigate to server folder
2. Create new ZIP (excluding node_modules)
3. Deploy using `az webapp deployment source config-zip`
4. Azure will automatically restart the app

```bash
cd "/Users/alyx1412/Library/Mobile Documents/com~apple~CloudDocs/Projects/taracamp-api/server"
zip -r ../deploy.zip . -x "node_modules/*" ".git/*" "*.log" ".env"
az webapp deployment source config-zip \
  --resource-group taracamp-rg \
  --name taracamp-api \
  --src ../deploy.zip
```

## API Endpoint Structure

All API endpoints follow this pattern:

```
https://taracamp-api.azurewebsites.net/api/v1/[resource]/[endpoint]
```

Examples:
- Login: `/api/v1/user/login`
- Register: `/api/v1/user/register`
- Facilities: `/api/v1/facility/...`
- Reservations: `/api/v1/reservation/...`
- Payments: `/api/v1/payment/...`

## Support

If you encounter issues:
1. Check **Log Stream** for detailed error messages
2. Verify **Deployment Center** shows successful deployment
3. Check **Application Insights** for performance issues
4. Review **Diagnose and solve problems** in Azure Portal

---

**Last Updated:** November 13, 2025

