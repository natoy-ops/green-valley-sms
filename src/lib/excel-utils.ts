/**
 * Excel Utility Functions
 *
 * Utilities for generating and downloading Excel files with multiple sheets using ExcelJS.
 */

import ExcelJS from "exceljs";

/**
 * Triggers a browser download of Excel content as a file.
 * Creates a temporary Blob and anchor element to initiate the download.
 *
 * @param filename - The name of the file to download (should include .xlsx extension)
 * @param workbook - The ExcelJS workbook to download
 *
 * @example
 * const workbook = new ExcelJS.Workbook();
 * const sheet = workbook.addWorksheet('Data');
 * await downloadExcelFile("report.xlsx", workbook);
 */
export async function downloadExcelFile(filename: string, workbook: ExcelJS.Workbook): Promise<void> {
  if (typeof window === "undefined") {
    return;
  }

  // Generate Excel file buffer
  const buffer = await workbook.xlsx.writeBuffer();

  // Create a Blob from the buffer
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });

  // Create a temporary download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.setAttribute("download", filename);

  // Trigger the download
  document.body.appendChild(link);
  link.click();

  // Clean up
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
