import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const BOOKINGS_SHEET = "Bookings";
const DUPLICATES_SHEET = "DuplicateAttempts";
const DEFAULT_BRANCH_CAPACITY: Record<string, number> = {
  التجمع: 10,
  زايد: 8,
  المعادي: 6,
};

function getAuth() {
  let privateKey = (process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY || "").trim();
  // Strip surrounding quotes if accidentally pasted with them (common Vercel mistake)
  if ((privateKey.startsWith('"') && privateKey.endsWith('"')) ||
      (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
    privateKey = privateKey.slice(1, -1);
  }
  // Replace literal \n sequences with actual newlines
  privateKey = privateKey.replace(/\\n/g, "\n");
  // Ensure -----END marker is on its own line (handles copy-paste without trailing newline)
  privateKey = privateKey.replace(/([^\n])(-----END )/, "$1\n$2");

  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim(),
      private_key: privateKey,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

export function getBranchCapacity(): Record<string, number> {
  try {
    const raw = JSON.parse(process.env.BRANCH_CAPACITY || "{}") as Record<string, unknown>;
    const sanitized: Record<string, number> = { ...DEFAULT_BRANCH_CAPACITY };

    for (const [branch, value] of Object.entries(raw)) {
      const n = typeof value === "number" ? value : Number(value);
      if (Number.isFinite(n) && n > 0) {
        sanitized[branch] = n;
      }
    }

    return sanitized;
  } catch {
    return { ...DEFAULT_BRANCH_CAPACITY };
  }
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Normalize for duplicate detection only; storage in the sheet stays as entered. */
function normalizeMobileForDuplicateKey(mobile: string): string {
  let d = mobile.replace(/\D/g, "");
  if (d.startsWith("20") && d.length === 12) {
    d = d.slice(2);
  }
  if (d.length === 11 && d.startsWith("0")) {
    d = d.slice(1);
  }
  return d;
}

function isCancelledStatus(status: string): boolean {
  return (status || "").toUpperCase().includes("CANCEL");
}

// Check if a phone number already has any active future booking
export async function checkDuplicatePhone(
  mobile: string,
  _date: string
): Promise<{ isDuplicate: boolean; existingRep?: string; existingBranch?: string; existingDate?: string }> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BOOKINGS_SHEET}!A2:K`,
  });

  const rows = res.data.values || [];
  const normalizedMobile = normalizeMobileForDuplicateKey(mobile.trim());
  const today = formatDate(new Date());

  for (const row of rows) {
    const rowMobile = normalizeMobileForDuplicateKey((row[3] || "").trim());
    const rowDate = row[8] || "";
    const rowStatus = row[10] || "";

    if (isCancelledStatus(rowStatus)) continue;

    let normalizedRowDate = rowDate;
    try { normalizedRowDate = formatDate(new Date(rowDate)); } catch {}

    if (rowMobile === normalizedMobile && normalizedRowDate >= today) {
      return {
        isDuplicate: true,
        existingRep: row[1] || "مندوب آخر",
        existingBranch: row[4] || "",
        existingDate: normalizedRowDate,
      };
    }
  }

  return { isDuplicate: false };
}

// Log a duplicate booking attempt to the DuplicateAttempts sheet
export async function logDuplicateAttempt(data: {
  agentName: string;
  mobile: string;
  attemptedDate: string;
  existingRep: string;
  existingBranch: string;
  existingDate: string;
}) {
  const sheets = getSheets();
  const timestamp = new Date().toISOString();

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${DUPLICATES_SHEET}!A:G`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          timestamp,
          data.agentName,
          data.mobile,
          data.attemptedDate,
          data.existingRep,
          data.existingBranch,
          data.existingDate,
        ]],
      },
    });
  } catch {
    // If the sheet doesn't exist yet, create it with headers then retry
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      requestBody: {
        requests: [{ addSheet: { properties: { title: DUPLICATES_SHEET } } }],
      },
    });
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${DUPLICATES_SHEET}!A1:G1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["Timestamp", "Agent", "Mobile (Attempted)", "Attempted Date", "Existing Rep", "Existing Branch", "Existing Booking Date"]],
      },
    });
    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: `${DUPLICATES_SHEET}!A:G`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [[
          timestamp,
          data.agentName,
          data.mobile,
          data.attemptedDate,
          data.existingRep,
          data.existingBranch,
          data.existingDate,
        ]],
      },
    });
  }
}

// Get count of bookings for a branch on a specific date
export async function getBookingCount(
  branch: string,
  date: string
): Promise<number> {
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BOOKINGS_SHEET}!A2:K`,
  });

  const rows = res.data.values || [];
  let count = 0;

  for (const row of rows) {
    const rowBranch = row[4] || "";
    const rowDate = row[8] || "";
    const rowStatus = row[10] || "";

    if (isCancelledStatus(rowStatus)) continue;

    // Normalize date comparison
    let normalizedRowDate = rowDate;
    try {
      normalizedRowDate = formatDate(new Date(rowDate));
    } catch {}

    if (rowBranch === branch && normalizedRowDate === date) {
      count++;
    }
  }

  return count;
}

// Check capacity for a branch on a date
export async function checkCapacity(branch: string, date: string) {
  const capacity = getBranchCapacity();
  const branchCap = capacity[branch] ?? DEFAULT_BRANCH_CAPACITY[branch] ?? 10;
  const booked = await getBookingCount(branch, date);

  return {
    branch,
    date,
    booked,
    capacity: branchCap,
    available: branchCap - booked,
    full: booked >= branchCap,
  };
}

// Check capacity for ALL branches on a date in a single sheet read
export async function checkAllBranchCapacity(date: string, branches: string[]) {
  const capacity = getBranchCapacity();
  const sheets = getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BOOKINGS_SHEET}!A2:K`,
  });

  const rows = res.data.values || [];
  const counts: Record<string, number> = {};
  for (const b of branches) counts[b] = 0;

  for (const row of rows) {
    const rowBranch = row[4] || "";
    const rowDate = row[8] || "";
    const rowStatus = row[10] || "";
    if (isCancelledStatus(rowStatus)) continue;
    if (!(rowBranch in counts)) continue;

    let normalizedRowDate = rowDate;
    try { normalizedRowDate = formatDate(new Date(rowDate)); } catch {}
    if (normalizedRowDate === date) counts[rowBranch]++;
  }

  const result: Record<string, any> = {};
  for (const b of branches) {
    const cap = capacity[b] ?? DEFAULT_BRANCH_CAPACITY[b] ?? 10;
    const booked = counts[b];
    result[b] = { branch: b, date, booked, capacity: cap, available: cap - booked, full: booked >= cap };
  }
  return result;
}

function parseAppendRowNumber(updatedRange: string | null | undefined): number | null {
  if (!updatedRange) return null;
  const m = updatedRange.match(/![A-Za-z]+(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

async function getBookingsSheetId(sheets: ReturnType<typeof getSheets>): Promise<number> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheet = meta.data.sheets?.find((s) => s.properties?.title === BOOKINGS_SHEET);
  const id = sheet?.properties?.sheetId;
  if (id === undefined || id === null) {
    throw new Error(`Sheet "${BOOKINGS_SHEET}" not found`);
  }
  return id;
}

/** Count rows for branch+date where status does not indicate cancelled. */
function countBranchDateNonCancelled(
  rows: string[][],
  branch: string,
  date: string
): number {
  let count = 0;
  for (const row of rows) {
    const rowBranch = row[4] || "";
    const rowDate = row[8] || "";
    const rowStatus = row[10] || "";
    if (isCancelledStatus(rowStatus)) continue;

    let normalizedRowDate = rowDate;
    try {
      normalizedRowDate = formatDate(new Date(rowDate));
    } catch {}

    if (rowBranch === branch && normalizedRowDate === date) {
      count++;
    }
  }
  return count;
}

// Add a booking row
export async function addBooking(data: {
  salesRep: string;
  customer: string;
  mobile: string;
  branch: string;
  car: string;
  service: string;
  amount: string;
  appointmentDate: string;
  notes: string;
}) {
  // UI-facing early return (kept for fast alternatives path)
  const cap = await checkCapacity(data.branch, data.appointmentDate);
  if (cap.full) {
    return { success: false, message: "Branch is full", capacity: cap };
  }

  const sheets = getSheets();
  const timestamp = new Date().toISOString();
  const pendingStatus = "⏳ PENDING";

  const appendRes = await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BOOKINGS_SHEET}!A:K`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [
        [
          timestamp,
          data.salesRep,
          data.customer,
          data.mobile,
          data.branch,
          data.car,
          data.service,
          data.amount,
          data.appointmentDate,
          data.notes,
          pendingStatus,
        ],
      ],
    },
  });

  const rowNumber = parseAppendRowNumber(appendRes.data.updates?.updatedRange ?? null);
  if (rowNumber === null) {
    throw new Error("Append did not return updatedRange; cannot finalize booking");
  }

  const fresh = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: `${BOOKINGS_SHEET}!A2:K`,
  });
  const rows = fresh.data.values || [];

  const capacityMap = getBranchCapacity();
  const branchCap = capacityMap[data.branch] ?? DEFAULT_BRANCH_CAPACITY[data.branch] ?? 10;

  const totalForSlot = countBranchDateNonCancelled(rows, data.branch, data.appointmentDate);

  if (totalForSlot <= branchCap) {
    const status = `✅ Confirmed (${totalForSlot}/${branchCap})`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BOOKINGS_SHEET}!K${rowNumber}`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [[status]] },
    });

    return {
      success: true,
      message: `Booking confirmed (${totalForSlot}/${branchCap})`,
      capacity: {
        branch: data.branch,
        date: data.appointmentDate,
        booked: totalForSlot,
        capacity: branchCap,
        available: branchCap - totalForSlot,
        full: false,
      },
    };
  }

  const sheetId = await getBookingsSheetId(sheets);
  const startIndex = rowNumber - 1;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: "ROWS",
              startIndex,
              endIndex: startIndex + 1,
            },
          },
        },
      ],
    },
  });

  const capAfterRollback = await checkCapacity(data.branch, data.appointmentDate);
  return { success: false, message: "Branch is full", capacity: capAfterRollback };
}

// Find next available dates for a branch
export async function findAvailableDates(
  branch: string,
  fromDate: string,
  count: number = 5
): Promise<Array<{ date: string; available: number }>> {
  const capacity = getBranchCapacity();
  const branchCap = capacity[branch] ?? DEFAULT_BRANCH_CAPACITY[branch] ?? 10;
  const results: Array<{ date: string; available: number }> = [];

  const checkDate = new Date(fromDate);

  for (let i = 0; i < 14 && results.length < count; i++) {
    checkDate.setDate(checkDate.getDate() + 1);
    // Skip Fridays
    if (checkDate.getDay() === 5) continue;

    const dateStr = formatDate(checkDate);
    const booked = await getBookingCount(branch, dateStr);

    if (booked < branchCap) {
      results.push({ date: dateStr, available: branchCap - booked });
    }
  }

  return results;
}

// Initialize the sheet with headers if empty
export async function initSheet() {
  const sheets = getSheets();

  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${BOOKINGS_SHEET}!A1:K1`,
    });

    if (!res.data.values || res.data.values.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${BOOKINGS_SHEET}!A1:K1`,
        valueInputOption: "RAW",
        requestBody: {
          values: [
            [
              "Timestamp",
              "Sales Rep",
              "العميل (Customer)",
              "Mobile",
              "الفرع (Branch)",
              "نوع و موديل المركبة (Car)",
              "الخدمة (Service)",
              "المبلغ (Amount)",
              "الموعد (Date)",
              "ملاحظات (Notes)",
              "Status",
            ],
          ],
        },
      });
    }
  } catch (error) {
    // Sheet might not exist yet — that's fine, append will create it
    console.error("initSheet error:", error);
  }
}
