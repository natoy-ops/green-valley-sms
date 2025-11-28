import { NextRequest, NextResponse } from "next/server";
import QRCode from "qrcode";
import ExcelJS from "exceljs";
import {
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  WidthType,
  ImageRun,
  TextRun,
  AlignmentType,
  BorderStyle,
  VerticalAlign,
} from "docx";
import { getAdminSupabaseClient } from "@/core/db/supabase-client.admin";
import { ADMIN_ROLES } from "@/config/roles";
import { requireRoles } from "@/core/auth/server-role-guard";

function formatError(status: number, code: string, message: string, details?: unknown) {
  return NextResponse.json(
    {
      success: false,
      error: {
        code,
        message,
        details: details ?? null,
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    },
    { status }
  );
}

interface StudentRow {
  id: string;
  student_school_id: string;
  first_name: string;
  last_name: string;
  section_id: string;
  guardian_phone: string | null;
  guardian_email: string | null;
  qr_hash: string;
  is_active: boolean;
}

interface SectionRow {
  id: string;
  name: string;
  level_id: string | null;
}

interface LevelRow {
  id: string;
  name: string;
}

interface StudentExportData {
  id: string;
  name: string;
  lrn: string;
  level: string;
  section: string;
  qrHash: string;
}

async function generateQrCodeBuffer(data: string): Promise<Buffer> {
  return QRCode.toBuffer(data, {
    type: "png",
    width: 150,
    margin: 1,
    errorCorrectionLevel: "M",
  });
}

async function createExcelExport(students: StudentExportData[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "School Management System";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Student QR Codes", {
    properties: { defaultRowHeight: 100 },
  });

  // Define columns
  worksheet.columns = [
    { header: "LRN / ID", key: "lrn", width: 20 },
    { header: "Name", key: "name", width: 30 },
    { header: "Grade / Level", key: "level", width: 15 },
    { header: "Section", key: "section", width: 15 },
    { header: "QR Code", key: "qrCode", width: 22 },
  ];

  // Style header row
  const headerRow = worksheet.getRow(1);
  headerRow.height = 25;
  headerRow.font = { bold: true, size: 12 };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.font = { bold: true, size: 12, color: { argb: "FFFFFFFF" } };

  // Add student data with QR codes
  for (let i = 0; i < students.length; i++) {
    const student = students[i];
    const rowNumber = i + 2; // Account for header row

    // Add text data
    const row = worksheet.addRow({
      lrn: student.lrn,
      name: student.name,
      level: student.level,
      section: student.section,
      qrCode: "",
    });

    row.height = 110;
    row.alignment = { vertical: "middle", horizontal: "left" };

    // Generate QR code image
    const qrBuffer = await generateQrCodeBuffer(student.qrHash);
    
    // Add image to worksheet
    const imageId = workbook.addImage({
      buffer: qrBuffer as unknown as ExcelJS.Buffer,
      extension: "png",
    });

    worksheet.addImage(imageId, {
      tl: { col: 4, row: rowNumber - 1 },
      ext: { width: 100, height: 100 },
    });
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Uint8Array(buffer);
}

async function createWordExport(students: StudentExportData[]): Promise<Uint8Array> {
  const rows: TableRow[] = [];
  const cardsPerRow = 3;
  
  // Process students in groups of 3 (3 cards per row)
  for (let i = 0; i < students.length; i += cardsPerRow) {
    const rowStudents = students.slice(i, i + cardsPerRow);
    const cells: TableCell[] = [];

    for (const student of rowStudents) {
      const qrBuffer = await generateQrCodeBuffer(student.qrHash);

      cells.push(
        new TableCell({
          width: { size: 33, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          borders: {
            top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
            right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
          },
          margins: {
            top: 150,
            bottom: 150,
            left: 100,
            right: 100,
          },
          children: [
            // QR Code
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  data: qrBuffer,
                  transformation: { width: 80, height: 80 },
                  type: "png",
                }),
              ],
            }),
            // Student Name
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 100 },
              children: [
                new TextRun({
                  text: student.name,
                  bold: true,
                  size: 20,
                }),
              ],
            }),
            // LRN
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `LRN: ${student.lrn}`,
                  size: 16,
                }),
              ],
            }),
            // Level & Section
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: `${student.level} - ${student.section}`,
                  size: 16,
                  italics: true,
                }),
              ],
            }),
          ],
        })
      );
    }

    // Pad with empty cells if needed
    while (cells.length < cardsPerRow) {
      cells.push(
        new TableCell({
          width: { size: 33, type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NIL },
            bottom: { style: BorderStyle.NIL },
            left: { style: BorderStyle.NIL },
            right: { style: BorderStyle.NIL },
          },
          children: [new Paragraph({ children: [] })],
        })
      );
    }

    rows.push(new TableRow({ children: cells }));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 300 },
            children: [
              new TextRun({
                text: "Student ID Cards",
                bold: true,
                size: 32,
              }),
            ],
          }),
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows,
          }),
        ],
      },
    ],
  });

  const docBuffer = await Packer.toBuffer(doc);
  return new Uint8Array(docBuffer);
}

export async function GET(request: NextRequest) {
  const authResult = await requireRoles(request, Array.from(ADMIN_ROLES));
  if ("error" in authResult) {
    return authResult.error;
  }

  const supabase = getAdminSupabaseClient();

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "excel";
  const studentIds = searchParams.get("ids")?.split(",").filter(Boolean) || [];
  const levelId = searchParams.get("levelId");
  const sectionId = searchParams.get("sectionId");

  // Build query
  let query = supabase
    .from("students")
    .select("id, student_school_id, first_name, last_name, section_id, guardian_phone, guardian_email, qr_hash, is_active")
    .eq("is_active", true);

  // Filter by specific student IDs if provided
  if (studentIds.length > 0) {
    query = query.in("id", studentIds);
  }

  // Filter by section if provided
  if (sectionId) {
    query = query.eq("section_id", sectionId);
  }

  const { data: studentsData, error: studentsError } = await query;

  if (studentsError || !studentsData) {
    return formatError(500, "STUDENT_FETCH_FAILED", "Failed to fetch students for export.", studentsError);
  }

  const students = studentsData as StudentRow[];

  if (students.length === 0) {
    return formatError(404, "NO_STUDENTS", "No students found for export.");
  }

  // Get unique section IDs
  const sectionIds = [...new Set(students.map((s) => s.section_id))];

  // Fetch sections
  const { data: sectionsData } = await supabase
    .from("sections")
    .select("id, name, level_id")
    .in("id", sectionIds);

  const sections = (sectionsData as SectionRow[]) || [];
  const sectionMap = new Map(sections.map((s) => [s.id, s]));

  // Get unique level IDs
  const levelIds = [...new Set(sections.map((s) => s.level_id).filter(Boolean))] as string[];

  // Fetch levels
  const { data: levelsData } = await supabase.from("levels").select("id, name").in("id", levelIds);

  const levels = (levelsData as LevelRow[]) || [];
  const levelMap = new Map(levels.map((l) => [l.id, l]));

  // Filter by level if provided (after we have section data)
  let filteredStudents = students;
  if (levelId) {
    filteredStudents = students.filter((s) => {
      const section = sectionMap.get(s.section_id);
      return section?.level_id === levelId;
    });
  }

  // Build export data
  const exportData: StudentExportData[] = filteredStudents.map((student) => {
    const section = sectionMap.get(student.section_id);
    const level = section?.level_id ? levelMap.get(section.level_id) : null;

    return {
      id: student.id,
      name: `${student.first_name} ${student.last_name}`.trim(),
      lrn: student.student_school_id,
      level: level?.name || "Unknown",
      section: section?.name || "Unknown",
      qrHash: student.qr_hash,
    };
  });

  try {
    if (format === "word" || format === "docx") {
      const buffer = await createWordExport(exportData);
      const filename = `student_qr_cards_${Date.now()}.docx`;

      return new Response(buffer.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    } else {
      const buffer = await createExcelExport(exportData);
      const filename = `student_qr_codes_${Date.now()}.xlsx`;

      return new Response(buffer.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${filename}"`,
        },
      });
    }
  } catch (err) {
    console.error("Export error:", err);
    return formatError(500, "EXPORT_FAILED", "Failed to generate export");
  }
}
