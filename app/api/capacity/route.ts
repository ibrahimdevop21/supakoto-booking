import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkCapacity } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const branch = req.nextUrl.searchParams.get("branch");
  const date = req.nextUrl.searchParams.get("date");

  if (!branch || !date) {
    return NextResponse.json(
      { error: "Missing branch or date" },
      { status: 400 }
    );
  }

  // If Google Sheets isn't configured, return a neutral "unknown" state
  const isConfigured =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID !== "placeholder-spreadsheet-id" &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.startsWith("placeholder");

  if (!isConfigured) {
    const capacityMap: Record<string, number> = (() => {
      try { return JSON.parse(process.env.BRANCH_CAPACITY || "{}"); }
      catch { return { التجمع: 10, زايد: 8, المعادي: 6 }; }
    })();
    const cap = capacityMap[branch] ?? 0;
    return NextResponse.json({
      branch,
      date,
      booked: 0,
      capacity: cap,
      available: cap,
      full: false,
      sheetsNotConfigured: true,
    });
  }

  try {
    const result = await checkCapacity(branch, date);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Capacity check error:", error);
    return NextResponse.json(
      { error: "Sheets error: " + error.message, sheetsNotConfigured: true },
      { status: 500 }
    );
  }
}
