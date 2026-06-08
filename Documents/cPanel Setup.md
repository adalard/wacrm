# cPanel Backend Deployment Guide for WACRM

This step-by-step guide explains how to deploy the WACRM Next.js App Router application onto a **cPanel Shared/VPS hosting environment** using the cPanel **Setup Node.js App** (Phusion Passenger) interface.

---

## 🛠️ Prerequisites & Server Requirements

Before you begin, ensure your cPanel hosting account supports:
*   **cPanel Setup Node.js App Manager** (enabled by default on Hostinger, Namecheap, A2 Hosting, etc.).
*   **Node.js version `>= 20.x`** (Node.js 20.11+ or 22.x is recommended).
*   **SSH Terminal Access** (optional but highly recommended for fast command execution).
*   **A Database Provider**: A live Supabase project is already configured for your WACRM backend.

---

## 🚀 Step-by-Step Deployment Strategy

Next.js is designed primarily for Vercel, which makes traditional node deployments heavy. To solve this, we have enabled **standalone output compilation** in your `next.config.ts`. 

The standalone output copies only the exact files and `node_modules` required to run in production, shrinking your deployment bundle size from **400MB+** down to a **20-40MB zip file**!

---

### Step 1: Compile the Next.js Standalone Build (Locally)

1. Open your local terminal in the project root.
2. Run the Next.js production build command:
   ```bash
   npm run build
   ```
3. Once compiled, Next.js will generate three key folders:
   *   `.next/standalone`: The self-contained production server.
   *   `.next/static`: The client-side compiled Javascript, CSS, and styling chunks.
   *   `public`: Your static assets (marketing icons, landing page images, etc.).

---

### Step 2: Prepare Standalone Assets for cPanel

Next.js does not copy the static `public` assets and `static` chunks into `.next/standalone` automatically because it assumes these will be served by a CDN. For cPanel shared hosting, we must copy them into the standalone directory manually.

Execute the following commands in your local terminal (Windows PowerShell):
```powershell
# Copy the public folder into standalone
xcopy /E /I public .next\standalone\public

# Copy the static folder into standalone's .next folder
xcopy /E /I .next\static .next\standalone\.next\static
```
*(If you are on Mac/Linux, run: `cp -r public .next/standalone/public` and `cp -r .next/static .next/standalone/.next/static`)*.

---

### Step 3: Create the cPanel Passenger Entrypoint (`app.js`)

cPanel uses **Phusion Passenger** to run and monitor Node.js applications, which expects a single startup file (like `app.js` or `index.js`) in the root directory. Next.js standalone runs its server from `.next/standalone/server.js`.

To bridge this, create a new file named `app.js` inside the **`.next/standalone/`** folder with the following redirect script:

```javascript
// .next/standalone/app.js
// Set Passenger's custom port or default to 3000
process.env.PORT = process.env.PORT || 3000;

// Execute the Next.js standalone server
require('./server.js');
```

---

### Step 4: Zip and Upload Assets to cPanel File Manager

1. Open the `.next/standalone/` folder on your computer.
2. Select **all contents** inside the `standalone` folder (including `app.js`, `server.js`, `public/`, `.next/`, `node_modules/`, etc.) and compress them into a **single zip file** (e.g. `wacrm-deploy.zip`).
   > [!IMPORTANT]
   > Do **not** zip the parent `standalone/` folder itself. Zip only the files and folders **directly inside** it.
3. Log into your cPanel dashboard.
4. Open the **File Manager** and navigate to your application root folder (e.g. `wacrm` or your domain directory under `/home/username/wacrm`).
5. Click **Upload** and upload your `wacrm-deploy.zip` file.
6. Once uploaded, right-click the zip file in cPanel File Manager and select **Extract**.

---

### Step 5: Configure the cPanel Node.js Application

1. In the cPanel dashboard, search for and open **"Setup Node.js App"**.
2. Click **Create Application**.
3. Configure the following parameters:
   *   **Node.js Version**: Select **`20.x`** or higher.
   *   **Application mode**: Select **Production**.
   *   **Application root**: Enter the absolute path to your files (e.g., `wacrm` if you extracted files inside `/home/username/wacrm`).
   *   **Application URL**: Select your primary domain or subdomain (e.g. `crm.yourdomain.com`).
   *   **Application startup file**: Enter **`app.js`** (this points Passenger directly to your custom redirect entrypoint).
4. Click **Create**. cPanel will initialize the app and automatically start it on a random internal port.

---

### Step 6: Configure Environment Variables in cPanel

Your WACRM instance requires environmental secrets (Supabase tokens, Stripe API keys) to connect.

1. Scroll down to the **Environment variables** section inside your newly created cPanel Node.js application dashboard.
2. Click **Add Variable** and input the following key variables:
   
   | Key | Example Value | Purpose |
   | :--- | :--- | :--- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://yourproj.supabase.co` | Supabase API connection endpoint |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5c...` | Supabase Client authorization key |
   | `SUPABASE_SECRET_KEY` | `eyJhbGciOiJIUzI1NiIsInR5c...` | Admin key to bypass RLS in stats routes |
   | `STRIPE_SECRET_KEY` | `sk_live_51P...` | Stripe payment gateway live key |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Stripe webhook verification key |
   | `NEXT_PUBLIC_APP_URL` | `https://crm.yourdomain.com` | Base URL of your cPanel website |
   | `PORT` | `3000` | Optional internal Passenger port |

3. Click **Save** and then click the **Update** button at the top of cPanel to reload configuration variables.

---

### Step 7: Finalize & Start the Application

1. At the top of your cPanel Node.js App dashboard, click **Restart**.
2. Open your web browser and navigate to your application domain (e.g. `https://crm.yourdomain.com`).
3. Your landing page, login panels, and dashboards are now live!

---

## 🔄 Updating Your App in the Future

When you make changes to your codebase (e.g. updating settings, pipelines, or inboxes):
1. Compile locally: `npm run build`
2. Run the copy script for `public/` and `.next/static/` folders.
3. Zip the standalone folder contents and upload to cPanel.
4. Extract, overwriting the old files in cPanel File Manager.
5. Open **Setup Node.js App** in cPanel and click **Restart**. No package installs or command line steps are needed on the server!
