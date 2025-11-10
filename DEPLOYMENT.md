# Azure Free Tier Deployment Guide

This guide will walk you through deploying the TaraCamp API to Microsoft Azure using free tier services with best practices.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Azure Account Setup](#azure-account-setup)
4. [Backend Deployment (Azure App Service)](#backend-deployment-azure-app-service)
5. [Frontend Deployment (Azure Static Web Apps)](#frontend-deployment-azure-static-web-apps)
6. [Environment Variables Configuration](#environment-variables-configuration)
7. [Google Cloud Storage Credentials Setup](#google-cloud-storage-credentials-setup)
8. [Post-Deployment Configuration](#post-deployment-configuration)
9. [GitHub Actions Setup](#github-actions-setup)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

Before starting, ensure you have:

- An Azure account (sign up at [azure.microsoft.com](https://azure.microsoft.com))
- Azure CLI installed ([Installation guide](https://docs.microsoft.com/cli/azure/install-azure-cli))
- Node.js 20+ installed locally
- Git installed and repository pushed to GitHub
- MongoDB Atlas account and cluster
- Redis Cloud account
- Google Cloud Platform account with Storage bucket
- PayMongo account

## Architecture Overview

- **Backend API**: Azure App Service (Free tier) - Node.js/Express with WebSocket support
- **Guest Frontend**: Azure Static Web Apps (Free tier) - React/Vite SPA
- **Admin Frontend**: Azure Static Web Apps (Free tier) - React/Vite SPA
- **Database**: MongoDB Atlas (external)
- **Cache**: Redis Cloud (external)
- **Storage**: Google Cloud Storage (external)
- **Payment**: PayMongo (external)

### Free Tier Limitations

- **Azure App Service Free Tier**:
  - 1 GB storage
  - 60 minutes/day compute time
  - Shared infrastructure

- **Azure Static Web Apps Free Tier**:
  - 100 GB bandwidth/month
  - Custom domains supported
  - SSL certificates included
  - GitHub Actions integration

## Azure Account Setup

1. Sign in to [Azure Portal](https://portal.azure.com)
2. Create a new Resource Group:
   - Click "Resource groups" → "Create"
   - Name: `taracamp-rg`
   - Region: Choose closest to your users
   - Click "Review + create" → "Create"

3. Install and login to Azure CLI:
   ```bash
   az login
   az account set --subscription "Your Subscription Name"
   ```

4. Register required resource providers:
   ```bash
   az provider register --namespace Microsoft.Web
   ```
   Note: Registration may take a few minutes. You can check status with:
   ```bash
   az provider show -n Microsoft.Web
   ```

## Backend Deployment (Azure App Service)

### Create App Service via Azure CLI

1. **Create App Service Plan (Free tier)**:
   ```bash
   az appservice plan create \
     --name taracamp-plan \
     --resource-group taracamp-rg \
     --sku FREE \
     --is-linux
   ```

2. **Create Web App**:
   ```bash
   az webapp create \
     --resource-group taracamp-rg \
     --plan taracamp-plan \
     --name taracamp-api \
     --runtime "NODE:20-lts"
   ```

3. **Configure Node.js version and startup command**:
   ```bash
   az webapp config set \
     --resource-group taracamp-rg \
     --name taracamp-api \
     --startup-file "node main.js" \
     --linux-fx-version "NODE|20-lts"
   ```

4. **Deploy via GitHub Actions** (recommended - see [GitHub Actions Setup](#github-actions-setup))

## Frontend Deployment (Azure Static Web Apps)

### Deploy Guest Frontend

1. **Create Static Web App via Azure Portal** (recommended for GitHub integration):
   - Go to Azure Portal → Static Web Apps → Create
   - Resource Group: `taracamp-rg`
   - Name: `taracamp-guest`
   - Plan type: Free
   - Region: Choose closest region
   - Source: GitHub
   - Sign in to GitHub and select your repository
   - Build details:
     - Build Presets: Custom
     - App location: `/client/Guest/my-auth-app`
     - Api location: (leave empty)
     - Output location: `dist`
     - Build command: `npm run build`
   - Click "Review + create" → "Create"

### Deploy Admin Frontend

Repeat the same steps as Guest frontend:

1. **Create Static Web App**:
   - Go to Azure Portal → Static Web Apps → Create
   - Resource Group: `taracamp-rg`
   - Name: `taracamp-admin`
   - Plan type: Free
   - Region: Choose closest region
   - Source: GitHub
   - Sign in to GitHub and select your repository
   - Build details:
     - Build Presets: Custom
     - App location: `/client/Admin`
     - Api location: (leave empty)
     - Output location: `dist`
     - Build command: `npm run build`
   - Click "Review + create" → "Create"

## Environment Variables Configuration

### Backend Environment Variables

Follow these steps to configure all backend environment variables:

#### Step 1: Upload Google Cloud Storage Service Account JSON File

1. **Prepare the service account JSON file**:
   - Download your GCP service account JSON key from Google Cloud Console
   - Rename it to `gcp-service-account.json`

2. **Get deployment credentials**:
   - Get your deployment credentials using Azure CLI:
     ```bash
     az webapp deployment list-publishing-profiles --name taracamp-api --resource-group taracamp-rg --xml
     ```
   - Look for the `userName` and `userPWD` values in the output
   - Alternatively, get them from Azure Portal → App Service → Deployment Center → Local Git/FTPS credentials

3. **Upload via Kudu REST API** (using `curl` - built-in on macOS):
   - Open Terminal on your Mac
   - Navigate to the directory containing `gcp-service-account.json`:
     ```bash
     cd /path/to/your/directory
     ```
   - Upload the file using Kudu REST API:
     ```bash
     PUBLISH_USERNAME=$(az webapp deployment list-publishing-profiles --name taracamp-api --resource-group taracamp-rg --xml | grep -A 1 "FTP" | grep "userName" | sed 's/.*userName="\([^"]*\)".*/\1/')
     PUBLISH_PASSWORD=$(az webapp deployment list-publishing-profiles --name taracamp-api --resource-group taracamp-rg --xml | grep -A 1 "FTP" | grep "userPWD" | sed 's/.*userPWD="\([^"]*\)".*/\1/')
     curl -X PUT -u "$PUBLISH_USERNAME:$PUBLISH_PASSWORD" \
       -T gcp-service-account.json \
       "https://taracamp-api.scm.azurewebsites.net/api/vfs/site/wwwroot/modules/gcp-service-account.json"
     ```
   
   **Note**: 
   - Replace `taracamp-api` with your actual App Service name if different
   - Replace `taracamp-rg` with your actual resource group name if different
   - Replace `gcp-service-account.json` with the actual path to your file if it's in a different location
   - The Kudu API uses HTTPS and is more reliable than FTP
   - You should see a successful response (100% uploaded) if the upload succeeds
   
   **Alternative: Manual upload with explicit credentials**:
     ```bash
     curl -X PUT -u "USERNAME:PASSWORD" \
       -T /full/path/to/gcp-service-account.json \
       "https://taracamp-api.scm.azurewebsites.net/api/vfs/site/wwwroot/modules/gcp-service-account.json"
     ```
     Replace `USERNAME` and `PASSWORD` with your deployment credentials from step 2

4. **Verify the upload**:
   - **Option 1: Via Azure Portal (Kudu Console)**:
     - Go to Azure Portal → App Service (`taracamp-api`) → Development Tools → Advanced Tools (Kudu)
     - Click "Go" to open Kudu
     - Click "Debug console" → "Bash"
     - Navigate to: `cd site/wwwroot/modules`
     - List files: `ls -la`
     - Verify `gcp-service-account.json` is listed
   
   - **Option 2: Via command line**:
     ```bash
     PUBLISH_USERNAME=$(az webapp deployment list-publishing-profiles --name taracamp-api --resource-group taracamp-rg --xml | grep -A 1 "FTP" | grep "userName" | sed 's/.*userName="\([^"]*\)".*/\1/')
     PUBLISH_PASSWORD=$(az webapp deployment list-publishing-profiles --name taracamp-api --resource-group taracamp-rg --xml | grep -A 1 "FTP" | grep "userPWD" | sed 's/.*userPWD="\([^"]*\)".*/\1/')
     curl -s -u "$PUBLISH_USERNAME:$PUBLISH_PASSWORD" \
       "https://taracamp-api.scm.azurewebsites.net/api/vfs/site/wwwroot/modules/" | grep -i "gcp-service-account.json"
     ```

#### Step 2: Set All Environment Variables

Set all environment variables using Azure CLI (recommended):

```bash
az webapp config appsettings set \
  --resource-group taracamp-rg \
  --name taracamp-api \
  --settings \
    NODE_ENV=production \
    DB_CONN="your_mongodb_connection_string" \
    REDIS_URL="your_redis_connection_string" \
    ALLOWED_ORIGINS="https://taracamp-guest.azurestaticapps.net,https://taracamp-admin.azurestaticapps.net" \
    JWT_SECRET="your_jwt_secret_minimum_32_characters" \
    JWT_REFRESH_SECRET="your_jwt_refresh_secret_minimum_32_characters" \
    PAYMONGO_SECRET_KEY="your_paymongo_secret_key" \
    PAYMONGO_WEBHOOK_SECRET="your_webhook_secret" \
    PAYMONGO_BASE_URL="https://api.paymongo.com/v1" \
    BUCKET_NAME="your_gcs_bucket_name" \
    FACILITY_IMAGE_PREFIX="facility_images/" \
    GOOGLE_APPLICATION_CREDENTIALS="/home/site/wwwroot/modules/gcp-service-account.json" \
    EMAIL_ADDRESS="your_email@gmail.com" \
    EMAIL_PASSWORD="your_email_app_password" \
    GOOGLE_CLIENT_ID="your_google_client_id" \
    GOOGLE_CLIENT_SECRET="your_google_client_secret" \
    FACEBOOK_APP_ID="your_facebook_app_id" \
    FACEBOOK_APP_SECRET="your_facebook_app_secret"
```

**Important Notes**:
- The Kudu REST API method (Step 1, section 3) uses HTTPS and is more reliable than FTP - no need to enable/disable FTP
- Complete Step 1 (upload JSON file) before running Step 2, otherwise `GOOGLE_APPLICATION_CREDENTIALS` will point to a non-existent file
- Verify the upload (Step 1, section 4) to ensure the file exists before setting environment variables
- Update `ALLOWED_ORIGINS` after deploying frontends with the actual Static Web Apps URLs (no trailing slashes)

### Frontend Environment Variables

Set environment variables via Azure Portal:

1. Go to Static Web App → Configuration → Application settings
2. Add: `VITE_API_BASE_URL` = `https://taracamp-api.azurewebsites.net`
3. Click "Save"
4. Repeat for both Guest and Admin frontends

## Post-Deployment Configuration

### 1. Update CORS Origins

After deploying frontends, update the backend `ALLOWED_ORIGINS` with actual URLs:

```bash
az webapp config appsettings set \
  --resource-group taracamp-rg \
  --name taracamp-api \
  --settings ALLOWED_ORIGINS="https://taracamp-guest.azurestaticapps.net,https://taracamp-admin.azurestaticapps.net"
```

### 2. Configure PayMongo Webhook

1. Go to PayMongo Dashboard → Webhooks
2. Add webhook URL: `https://taracamp-api.azurewebsites.net/api/v1/payment/webhook`
3. Select events to listen to
4. Copy the webhook secret and update `PAYMONGO_WEBHOOK_SECRET` in Azure:
   ```bash
   az webapp config appsettings set \
     --resource-group taracamp-rg \
     --name taracamp-api \
     --settings PAYMONGO_WEBHOOK_SECRET="your_webhook_secret"
   ```

### 3. Update OAuth Redirect URIs

1. **Google OAuth**:
   - Go to Google Cloud Console → APIs & Services → Credentials
   - Add authorized redirect URI: `https://taracamp-api.azurewebsites.net/api/v1/user/auth/google/callback`

2. **Facebook OAuth**:
   - Go to Facebook Developers → Settings → Basic
   - Add Valid OAuth Redirect URI: `https://taracamp-api.azurewebsites.net/api/v1/user/auth/facebook/callback`

### 4. Test the Deployment

1. **Test Backend**:
   ```bash
   curl https://taracamp-api.azurewebsites.net/api/v1
   # Should return 404 (expected for root API path)
   ```

2. **Test Frontends**:
   - Visit: `https://taracamp-guest.azurestaticapps.net`
   - Visit: `https://taracamp-admin.azurestaticapps.net`
   - Check browser console for API connection errors

3. **Test WebSocket**:
   - Use a WebSocket client to connect to: `wss://taracamp-api.azurewebsites.net/socket?token=YOUR_TOKEN`

## GitHub Actions Setup

The repository includes a GitHub Actions workflow (`.github/workflows/azure-deploy.yml`) for automated deployment.

### Setup GitHub Actions

1. **Get Azure Publish Profile** (for backend):
   - Go to Azure Portal → App Service → Get publish profile
   - Download the `.PublishSettings` file
   - Copy the entire contents

2. **Get Static Web Apps API Tokens**:
   - Go to Azure Portal → Static Web App → Manage deployment token
   - Copy the token for Guest frontend
   - Copy the token for Admin frontend

3. **Add GitHub Secrets**:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Add the following secrets:
     - `AZURE_WEBAPP_PUBLISH_PROFILE`: Paste the publish profile content
     - `AZURE_STATIC_WEB_APPS_API_TOKEN_GUEST`: Guest frontend deployment token
     - `AZURE_STATIC_WEB_APPS_API_TOKEN_ADMIN`: Admin frontend deployment token
     - `VITE_API_BASE_URL`: Your backend API URL (e.g., `https://taracamp-api.azurewebsites.net`)

4. **Workflow Behavior**:
   - The workflow runs automatically on push to `main` or `master` branch
   - You can also trigger it manually via GitHub Actions → Run workflow
   - Jobs: `deploy-backend`, `deploy-guest-frontend`, `deploy-admin-frontend`

## Troubleshooting

### Backend Issues

**App won't start**:
```bash
az webapp log tail --name taracamp-api --resource-group taracamp-rg
```
- Verify environment variables are set correctly
- Check startup command: `node main.js`

**Database connection errors**:
- Verify MongoDB Atlas connection string
- Check IP whitelist in MongoDB Atlas (add `0.0.0.0/0` for Azure App Service)

**Redis connection errors**:
- Verify Redis Cloud connection string
- Check Redis Cloud allowlist

**CORS errors**:
- Verify `ALLOWED_ORIGINS` includes frontend URLs (no trailing slashes)
- Check browser console for exact origin being blocked

### Frontend Issues

**Build fails**:
- Check build logs in Static Web App → Deployment history
- Verify build command: `npm run build` and output location: `dist`

**API connection errors**:
- Verify `VITE_API_BASE_URL` is set correctly
- Check CORS configuration in backend
- Verify backend is running

**Routing issues**:
- Verify `staticwebapp.config.json` is in the correct location
- Ensure all routes fallback to `index.html`

### Common Commands

**Restart App Service**:
```bash
az webapp restart --name taracamp-api --resource-group taracamp-rg
```

**View real-time logs**:
```bash
az webapp log tail --name taracamp-api --resource-group taracamp-rg
```

**Check application settings**:
```bash
az webapp config appsettings list --name taracamp-api --resource-group taracamp-rg
```

## Additional Resources

- [Azure App Service Documentation](https://docs.microsoft.com/azure/app-service/)
- [Azure Static Web Apps Documentation](https://docs.microsoft.com/azure/static-web-apps/)
- [Azure CLI Reference](https://docs.microsoft.com/cli/azure/)
- [MongoDB Atlas Documentation](https://docs.atlas.mongodb.com/)
- [Redis Cloud Documentation](https://docs.redislabs.com/)
