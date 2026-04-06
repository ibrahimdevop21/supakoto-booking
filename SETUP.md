# SupaKoto Booking System — Setup Guide

## Architecture
- **Frontend + API**: Next.js on Vercel
- **Auth**: Name + PIN (no Google accounts needed)
- **Database**: Google Sheets via service account
- **Capacity**: Hard-blocked — reps can't submit if branch is full

---

## What You Need to Set Up

1. A Google Cloud service account (for Sheets API) — ~5 min
2. A Google Sheet — ~2 min
3. Deploy to Vercel — ~5 min
4. Assign PINs to your reps — ~2 min

**No Google OAuth, no cPanel integration, no email provider dependency.**

---

## Step 1: Google Cloud Service Account

This is what lets the app write to your Google Sheet.

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (name it "SupaKoto Booking" or whatever)
3. Go to **APIs & Services → Library** → search **Google Sheets API** → **Enable**
4. Go to **APIs & Services → Credentials** → **Create Credentials → Service Account**
   - Name: "supakoto-sheets"
   - Click through (no optional permissions needed)
5. Click the service account you just created → **Keys** tab → **Add Key → Create new key → JSON**
6. Download the JSON file. You need two values from it:
   - `client_email` (looks like `supakoto-sheets@project-id.iam.gserviceaccount.com`)
   - `private_key` (the long key starting with `-----BEGIN PRIVATE KEY-----`)

## Step 2: Create the Google Sheet

1. Go to [Google Sheets](https://sheets.google.com/) → create new spreadsheet
2. Name: **SupaKoto Master Bookings**
3. Rename the first tab to exactly: **Bookings**
4. In row 1, add these headers (A1 through K1):
   ```
   Timestamp | Sales Rep | العميل (Customer) | Mobile | الفرع (Branch) | نوع و موديل المركبة (Car) | الخدمة (Service) | المبلغ (Amount) | الموعد (Date) | ملاحظات (Notes) | Status
   ```
5. Click **Share** → paste your service account email (`client_email` from step 1) → give **Editor** access
6. Copy the Spreadsheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[THIS_PART_IS_THE_ID]/edit
   ```

## Step 3: Assign PINs

Pick a 4-digit PIN for each rep. Build the JSON array:

```json
[
  {"name":"Ahmed","pin":"1234"},
  {"name":"Amera","pin":"2345"},
  {"name":"Dr.Tarek","pin":"3456"},
  {"name":"Fatema","pin":"4567"},
  {"name":"Hamadto","pin":"5678"},
  {"name":"Hanady","pin":"6789"},
  {"name":"Henady","pin":"7890"},
  {"name":"Lama","pin":"8901"},
  {"name":"Malik","pin":"9012"},
  {"name":"Mo.Saloumi","pin":"0123"},
  {"name":"Rahma","pin":"1357"},
  {"name":"Shimaa","pin":"2468"},
  {"name":"Yara","pin":"3579"}
]
```

Change the PINs to whatever you want. Tell each rep their PIN privately.

## Step 4: Deploy to Vercel

### Option A: CLI (fast)
```bash
cd supakoto-booking
npm install

# Test locally first
cp .env.example .env.local
# Edit .env.local with your real values
npm run dev
# Open http://localhost:3000 — test it works

# Deploy
npx vercel --prod
```

### Option B: GitHub → Vercel
1. Push to GitHub
2. Go to [vercel.com](https://vercel.com) → Import → select repo → Deploy

## Step 5: Set Environment Variables in Vercel

Go to **Vercel → Project → Settings → Environment Variables**:

| Variable | Value |
|---|---|
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` in terminal |
| `NEXTAUTH_URL` | Your Vercel URL (e.g. `https://booking-supakoto.vercel.app`) |
| `AUTHORIZED_USERS` | The JSON array from Step 3 |
| `GOOGLE_SHEETS_SPREADSHEET_ID` | From Step 2 |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key file |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` from the JSON key file (include the BEGIN/END lines) |
| `BRANCH_CAPACITY` | `{"التجمع":8,"زايد":5,"المعادي":4}` |

After adding env vars → **Redeploy** (Deployments tab → latest → Redeploy).

## Step 6: Share with Reps

Send each rep:
1. The URL
2. Their PIN

They pick their name, enter PIN, and they're in. Session lasts 30 days so they won't need to log in every day.

---

## Daily Operations

### For Reps
1. Open URL → login (name + PIN)
2. Fill in booking → pick branch + date
3. See live capacity: 🟢 available / 🟡 almost full / 🔴 full (blocked)
4. Submit → confirmation
5. "حجز جديد" for next booking

### For You
- Open the Google Sheet — all bookings are there
- You do **nothing** daily

---

## Managing the System

### Change a Rep's PIN
Edit the `AUTHORIZED_USERS` env var in Vercel → Redeploy.

### Add/Remove a Rep
1. Update `AUTHORIZED_USERS` env var
2. Update the `SALES_REPS` array in `app/page.tsx` and `app/login/page.tsx`
3. Push to GitHub (or redeploy)

### Change Branch Capacity
Update `BRANCH_CAPACITY` env var in Vercel → Redeploy.

### Custom Domain
Vercel → Settings → Domains → add `booking.supakoto.com`
(Point your domain's DNS to Vercel — CNAME to `cname.vercel-dns.com`)

---

## Troubleshooting

**"PIN غلط" but it's correct:**
Check `AUTHORIZED_USERS` env var — make sure it's valid JSON and the name matches exactly (case-sensitive).

**Sheets not writing:**
- Is the sheet shared with the service account email? (Editor access)
- Is the tab named exactly "Bookings"?
- Is the `private_key` env var wrapped in double quotes and has `\n` for newlines?

**After changing env vars nothing changed:**
You need to **Redeploy** after changing env vars. Go to Deployments → Redeploy.
