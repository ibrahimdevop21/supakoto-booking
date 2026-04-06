import { google } from "googleapis";

const SPREADSHEET_ID = process.env.GOOGLE_SHEETS_SPREADSHEET_ID!;
const BOOKINGS_SHEET = "Bookings";
const DUPLICATES_SHEET = "DuplicateAttempts";

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(
        /\\n/g,
        "\n"
      ),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

function getSheets() {
  return google.sheets({ version: "v4", auth: getAuth() });
}

function getBranchCapacity(): Record<string, number> {
  try {
    return JSON.parse(process.env.BRANCH_CAPACITY || "{}");
  } catch {
    return { التجمع: 8, زايد: 5, المعادي: 4 };
  }
}

// Format date as YYYY-MM-DD
function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
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
  const normalizedMobile = mobile.trim();
  const today = formatDate(new Date());

  for (const row of rows) {
    const rowMobile = (row[3] || "").trim();
    const rowDate = row[8] || "";
    const rowStatus = (row[10] || "").toUpperCase();

    if (rowStatus.includes("CANCEL")) continue;

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

    if (rowStatus.includes("CANCELLED")) continue;

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
  const branchCap = capacity[branch] || 999;
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
    if (rowStatus.includes("CANCELLED")) continue;
    if (!(rowBranch in counts)) continue;

    let normalizedRowDate = rowDate;
    try { normalizedRowDate = formatDate(new Date(rowDate)); } catch {}
    if (normalizedRowDate === date) counts[rowBranch]++;
  }

  const result: Record<string, any> = {};
  for (const b of branches) {
    const cap = capacity[b] || 999;
    const booked = counts[b];
    result[b] = { branch: b, date, booked, capacity: cap, available: cap - booked, full: booked >= cap };
  }
  return result;
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
  // Double-check capacity before writing
  const cap = await checkCapacity(data.branch, data.appointmentDate);
  if (cap.full) {
    return { success: false, message: "Branch is full", capacity: cap };
  }

  const sheets = getSheets();
  const timestamp = new Date().toISOString();
  const status = `✅ Confirmed (${cap.booked + 1}/${cap.capacity})`;

  await sheets.spreadsheets.values.append({
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
          status,
        ],
      ],
    },
  });

  return {
    success: true,
    message: `Booking confirmed (${cap.booked + 1}/${cap.capacity})`,
    capacity: { ...cap, booked: cap.booked + 1, available: cap.available - 1 },
  };
}

// Find next available dates for a branch
export async function findAvailableDates(
  branch: string,
  fromDate: string,
  count: number = 5
): Promise<Array<{ date: string; available: number }>> {
  const capacity = getBranchCapacity();
  const branchCap = capacity[branch] || 999;
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
