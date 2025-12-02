import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { ADMIN_ROLES } from "@/config/roles";
import { requireRoles } from "@/core/auth/server-role-guard";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Students");

  worksheet.columns = [
    { header: "Full Name", key: "fullName", width: 30 },
    { header: "Email", key: "email", width: 30 },
  ];

  worksheet.addRow({ fullName: "Juan Dela Cruz", email: "juan.delacruz@example.edu.ph" });
  worksheet.addRow({});
  worksheet.addRow({});

  const buffer = (await workbook.xlsx.writeBuffer()) as ArrayBuffer;

  return new NextResponse(buffer as any, {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="student-import-template.xlsx"',
    },
  });
}
