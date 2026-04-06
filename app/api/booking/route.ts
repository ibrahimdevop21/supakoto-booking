import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  addBooking,
  findAvailableDates,
  checkDuplicatePhone,
  logDuplicateAttempt,
  checkCapacity,
} from "@/lib/sheets";

export async function POST(req: NextRequest) {
  // Auth check
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isConfigured =
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID &&
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID !== "placeholder-spreadsheet-id" &&
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL.startsWith("placeholder");

  if (!isConfigured) {
    return NextResponse.json(
      { error: "Google Sheets not configured yet. Please complete the setup in SETUP.md." },
      { status: 503 }
    );
  }

  try {
    const body = await req.json();

    // Validate required fields
    const required = [
      "salesRep",
      "customer",
      "mobile",
      "branch",
      "car",
      "service",
      "appointmentDate",
    ];
    for (const field of required) {
      if (!body[field]?.trim()) {
        return NextResponse.json(
          { error: `Missing field: ${field}` },
          { status: 400 }
        );
      }
    }

    // Validate mobile
    if (!/^[0-9]{10,11}$/.test(body.mobile.trim())) {
      return NextResponse.json(
        { error: "Invalid mobile number" },
        { status: 400 }
      );
    }

    // Duplicate phone check — block if customer has any active future booking
    const dup = await checkDuplicatePhone(body.mobile.trim(), body.appointmentDate.trim());
    if (dup.isDuplicate) {
      await logDuplicateAttempt({
        agentName: body.salesRep.trim(),
        mobile: body.mobile.trim(),
        attemptedDate: body.appointmentDate.trim(),
        existingRep: dup.existingRep || "",
        existingBranch: dup.existingBranch || "",
        existingDate: dup.existingDate || "",
      });
      return NextResponse.json(
        {
          success: false,
          isDuplicate: true,
          message: `هذا العميل (${body.mobile}) عنده حجز بالفعل بتاريخ ${dup.existingDate} — مسجل على ${dup.existingRep}${dup.existingBranch ? " · " + dup.existingBranch : ""}`,
        },
        { status: 409 }
      );
    }

    // Fast capacity pre-check (same as first step inside addBooking)
    const preCap = await checkCapacity(body.branch.trim(), body.appointmentDate.trim());
    if (preCap.full) {
      const alternatives = await findAvailableDates(
        body.branch.trim(),
        body.appointmentDate.trim(),
        5
      );
      return NextResponse.json(
        {
          success: false,
          message: "Branch is full",
          capacity: preCap,
          alternatives,
        },
        { status: 409 }
      );
    }

    // Attempt booking
    const result = await addBooking({
      salesRep: body.salesRep.trim(),
      customer: body.customer.trim(),
      mobile: body.mobile.trim(),
      branch: body.branch.trim(),
      car: body.car.trim(),
      service: body.service.trim(),
      amount: body.amount?.trim() || "",
      appointmentDate: body.appointmentDate.trim(),
      notes: body.notes?.trim() || "",
    });

    if (!result.success) {
      // Branch full — find alternatives
      const alternatives = await findAvailableDates(
        body.branch,
        body.appointmentDate,
        5
      );
      return NextResponse.json(
        {
          success: false,
          message: result.message,
          capacity: result.capacity,
          alternatives,
        },
        { status: 409 }
      );
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Booking error:", error);
    return NextResponse.json(
      { error: "Server error: " + error.message },
      { status: 500 }
    );
  }
}
