import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { checkAllBranchCapacity } from "@/lib/sheets";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const date = req.nextUrl.searchParams.get("date");
  const branchesParam = req.nextUrl.searchParams.get("branches");
  if (!date || !branchesParam) {
    return NextResponse.json({ error: "Missing date or branches" }, { status: 400 });
  }

  const branches = branchesParam.split(",");

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
    const result: Record<string, any> = {};
    for (const b of branches) {
      const cap = capacityMap[b] ?? 0;
      result[b] = { branch: b, date, booked: 0, capacity: cap, available: cap, full: false, sheetsNotConfigured: true };
    }
    return NextResponse.json(result);
  }

  try {
    const result = await checkAllBranchCapacity(date, branches);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("All-capacity check error:", error);
    return NextResponse.json({ error: "Sheets error: " + error.message }, { status: 500 });
  }
}
