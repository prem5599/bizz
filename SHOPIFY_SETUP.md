# Shopify Integration Setup Guide

## 🚀 Quick Start

### Method 1: Private App (Recommended for Testing)

1. **Create a Private App in Shopify:**
   - Go to your Shopify admin → Settings → Apps and sales channels
   - Click "Develop apps" → "Create an app"
   - Give it a name (e.g., "BizInsights Integration")
   - Click "Configure Admin API scopes"
   - Enable these scopes:
     - `read_orders` - Read orders
     - `read_customers` - Read customers
     - `read_products` - Read products
     - `read_analytics` - Read analytics
   - Click "Save" → "Install app"
   - Copy the "Admin API access token" (starts with `shpat_`)

2. **Test the Connection:**
   - Open the test file: `test-shopify-integration.js`
   - Replace `your-store-name` with your actual store name
   - Replace `shpat_your_access_token_here` with your token
   - Run: `node test-shopify-integration.js`

3. **Connect in the App:**
   - Start your dev server: `npm run dev`
   - Go to the integrations page
   - Click "Connect Shopify"
   - Choose "Private App"
   - Enter your store domain and access token

### Method 2: OAuth App (For Production)

1. **Create a Shopify App:**
   - Go to [Shopify Partner Dashboard](https://partners.shopify.com)
   - Create a new app
   - Configure app settings:
     - App URL: `http://localhost:3000` (or your domain)
     - Allowed redirection URL: `http://localhost:3000/api/integrations/shopify/callback`
   - Note down your API key and API secret

2. **Update Environment Variables:**
   ```env
   SHOPIFY_CLIENT_ID="your_actual_api_key"
   SHOPIFY_CLIENT_SECRET="your_actual_api_secret"
   SHOPIFY_WEBHOOK_SECRET="your_webhook_secret"
   ```

## 🔧 Current Issues and Fixes

### Issues Found:
1. ❌ **Mock OAuth tokens**: The OAuth route was creating fake tokens
2. ❌ **No data sync**: Connected integrations weren't syncing data
3. ❌ **Missing credentials**: Placeholder values in .env file
4. ❌ **No webhook handling**: Webhooks weren't properly configured

### Fixes Applied:
1. ✅ **Real OAuth flow**: OAuth route now generates proper authorization URLs
2. ✅ **Auto data sync**: Private app connections now sync historical data
3. ✅ **Better error handling**: Clear error messages for configuration issues
4. ✅ **Comprehensive testing**: Test script to verify all functionality

## 📊 Testing Your Integration

### 1. Basic Connection Test
```bash
node test-shopify-integration.js
```

### 2. Manual API Test
```bash
curl -X GET "https://your-store.myshopify.com/admin/api/2023-10/shop.json" \
  -H "X-Shopify-Access-Token: shpat_your_token"
```

### 3. Integration Test in App
1. Go to `http://localhost:3000/dashboard/integrations`
2. Click "Add Integration" → "Shopify"
3. Follow the connection flow
4. Check that data appears in your dashboard

## 🔄 Data Sync Process

When you connect via Private App:
1. **Immediate sync**: Last 30 days of historical data
2. **Data types synced**:
   - Orders → Revenue and order count metrics
   - Customers → Customer creation metrics
   - Products → Product metrics
3. **Webhook setup**: Automatic real-time updates (if webhooks configured)

## 🐛 Troubleshooting

### Common Issues:

1. **"Invalid access token"**
   - Verify token starts with `shpat_`
   - Check token hasn't expired
   - Ensure app is installed in your store

2. **"Store not found"**
   - Verify store domain is correct
   - Don't include `.myshopify.com` in the domain field
   - Check store is active

3. **"OAuth not configured"**
   - Update SHOPIFY_CLIENT_ID and SHOPIFY_CLIENT_SECRET in .env
   - Restart your dev server after updating .env

4. **"No data syncing"**
   - Check console logs for sync errors
   - Verify API permissions are correct
   - Check database for synced data points

### Debug Steps:
1. Check browser console for errors
2. Check server console for API logs
3. Test direct API calls with curl
4. Verify database entries in `Integration` and `DataPoint` tables

## 📈 Next Steps

1. **Test the integration** using the provided test script
2. **Connect your real store** using Private App method
3. **Verify data sync** by checking your dashboard
4. **Set up webhooks** for real-time updates (optional)
5. **Configure OAuth** for production use (optional)

## 🎯 Quick Fix Checklist

- [ ] Run the test script with real credentials
- [ ] Connect via Private App method
- [ ] Check dashboard for synced data
- [ ] Verify integration status shows "active"
- [ ] Test data refresh functionality

Need help? Check the console logs for detailed error messages!