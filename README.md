# SupaKoto Booking System

Internal appointment booking system for SupaKoto sales reps. Built with Next.js 14, NextAuth, and Google Sheets as the database.

---

## Features

- **Name + PIN login** — each sales rep has their own credentials, no email required
- **Two-column layout** — booking form on the right, interactive calendar on the left
- **Live capacity** — click any date to see available slots per branch in real time
- **Duplicate prevention** — blocks booking the same customer (by phone) if they already have an active future appointment
- **Audit log** — every failed duplicate attempt is logged to a separate sheet with agent name and timestamp
- **Branch capacity limits** — التجمع (10/day), زايد (8/day), المعادي (6/day)
- **Alternative dates** — when a branch is full, suggests the next available dates automatically
- **RTL Arabic-first UI** — dark theme, SupaKoto branding, mobile-friendly

---

## Tech Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 14 (App Router) |
| Auth | NextAuth v4 — Credentials Provider (JWT) |
| Database | Google Sheets via Service Account |
| Language | TypeScript |
| Styling | Inline styles + global CSS (no Tailwind) |
| Deployment | Vercel |

---

## Google Sheets Structure

The app writes to a spreadsheet with two tabs:

**`Bookings`** — one row per booking:
| A | B | C | D | E | F | G | H | I | J | K |
|---|---|---|---|---|---|---|---|---|---|---|
| Timestamp | Sales Rep | Customer | Mobile | Branch | Car | Service | Amount | Date | Notes | Status |

**`DuplicateAttempts`** — auto-created on first blocked attempt:
| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Timestamp | Agent | Mobile | Attempted Date | Existing Rep | Existing Branch | Existing Booking Date |

---

## Local Development

### 1. Clone & install

```bash
git clone git@github.com:ibrahimdevop21/supakoto-booking.git
cd supakoto-booking
npm install
```

### 2. Configure environment

Copy the example and fill in your values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
NEXTAUTH_SECRET=generate-with-openssl-rand-base64-32
NEXTAUTH_URL=http://localhost:3000

# JSON array of sales reps
AUTHORIZED_USERS=[{"name":"Ahmed","pin":"1234"},{"name":"Lama","pin":"5678"}]

# Google Sheets
GOOGLE_SHEETS_SPREADSHEET_ID=your-spreadsheet-id
GOOGLE_SERVICE_ACCOUNT_EMAIL=your-service-account@project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"

# Daily capacity per branch
BRANCH_CAPACITY={"التجمع":10,"زايد":8,"المعادي":6}
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Google Sheets Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com) → create a project
2. Enable **Google Sheets API**
3. Go to **IAM & Admin → Service Accounts** → create a service account → download JSON key
4. Create a Google Sheet, rename the first tab to `Bookings`
5. Share the sheet with the service account email (Editor role)
6. Copy the spreadsheet ID from the URL and paste into `.env.local`
7. Copy `client_email` and `private_key` from the JSON key into `.env.local`

---

## Managing Sales Reps

### Add / remove / change PIN

Edit `AUTHORIZED_USERS` in `.env.local` (locally) or in Vercel environment variables (production):

```json
[
  {"name":"Ahmed","pin":"5586"},
  {"name":"Lama","pin":"8134"}
]
```

Also update the `SALES_REPS` array in [`app/login/page.tsx`](app/login/page.tsx) to match — this controls the dropdown on the login screen.

> Name must match exactly (same spelling, same capitalization) between `AUTHORIZED_USERS` and `SALES_REPS`.

---

## Deployment (Vercel)

1. Push to GitHub
2. Import repo at [vercel.com](https://vercel.com) → framework auto-detects as Next.js
3. Add all environment variables from `.env.local` in Vercel's **Settings → Environment Variables**
4. Set `NEXTAUTH_URL` to your Vercel URL (e.g. `https://supakoto-booking.vercel.app`)
5. Deploy

After first deploy, update `NEXTAUTH_URL` if the URL changed, then redeploy.

---

## Cancelling a Booking

Open the Google Sheet → find the booking row → edit the **Status** column (column K) and add the word `CANCELLED`. The system will then allow that customer's phone number to be rebooked.

---

## Branch Capacity

Capacity is set per branch via the `BRANCH_CAPACITY` env var:

```env
BRANCH_CAPACITY={"التجمع":10,"زايد":8,"المعادي":6}
```

Change a value and redeploy (Vercel) or restart the dev server (local) to apply.
