/**
 * CSV Utility Functions
 *
 * Reusable utilities for generating and downloading CSV files from the browser.
 * Extracted pattern from SIS page for consistency across the application.
 */

/**
 * Escapes a string value for safe inclusion in a CSV file.
 * Wraps values containing commas, quotes, or newlines in double quotes,
 * and escapes existing double quotes by doubling them.
 *
 * @param value - The string value to escape
 * @returns The escaped CSV-safe string
 *
 * @example
 * escapeCsv("John Doe") // "John Doe"
 * escapeCsv("Doe, John") // "\"Doe, John\""
 * escapeCsv('Say "Hello"') // "\"Say \"\"Hello\"\"\""
 */
export function escapeCsv(value: string): string {
  // Escape values that contain commas, quotes, or newlines
  if (value.includes(",") || value.includes("\"") || value.includes("\n")) {
    return `"${value.replace(/\"/g, '""')}"`;
  }
  return value;
}

/**
 * Triggers a browser download of CSV content as a file.
 * Creates a temporary Blob and anchor element to initiate the download.
 *
 * @param filename - The name of the file to download (should include .csv extension)
 * @param content - The CSV content as a complete string
 *
 * @example
 * const csv = "Name,Age\nJohn,25\nJane,30";
 * downloadCsvFile("users.csv", csv);
 */
export function downloadCsvFile(filename: string, content: string): void {
  if (typeof window === "undefined" || !content) {
    return;
  }

  // Create a Blob from the CSV content
  const blob = new Blob([content], {
    type: "text/csv;charset=utf-8;",
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
