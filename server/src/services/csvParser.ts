import fs from "fs";
import csvParser from "csv-parser";
import * as XLSX from "xlsx";
import path from "path";

interface ParsedInvoice {
    invoiceNo: string;
    supplierGstin: string;
    invoiceDate?: string;
    gstAmount: number;
}

/**
 * Normalize CSV/Excel header names to our internal field names.
 * Handles common variations of column headers.
 */
function normalizeHeader(header: string): string {
    const h = header.trim().toLowerCase().replace(/[^a-z0-9]/g, "");

    // Invoice number variations
    if (
        h.includes("invoiceno") ||
        h.includes("invoicenumber") ||
        h.includes("invno") ||
        h.includes("billno")
    ) {
        return "invoiceNo";
    }

    // GSTIN variations
    if (
        h.includes("gstin") ||
        h.includes("suppliergstin") ||
        h.includes("vendorgstin") ||
        h.includes("gstno")
    ) {
        return "supplierGstin";
    }

    // Invoice date variations
    if (h.includes("invoicedate") || h.includes("invdate") || h.includes("billdate")) {
        return "invoiceDate";
    }

    // GST amount variations
    if (
        h.includes("gstamount") ||
        h.includes("gst") ||
        h.includes("taxamount") ||
        h.includes("igst") ||
        h.includes("totalgsttax") ||
        h.includes("totaltax")
    ) {
        return "gstAmount";
    }

    return header;
}

/**
 * Parse a CSV file and return structured invoice data.
 */
export function parseCSV(filePath: string): Promise<ParsedInvoice[]> {
    return new Promise((resolve, reject) => {
        const results: ParsedInvoice[] = [];

        fs.createReadStream(filePath)
            .pipe(
                csvParser({
                    mapHeaders: ({ header }) => normalizeHeader(header),
                })
            )
            .on("data", (row: Record<string, string>) => {
                const invoiceNo = row["invoiceNo"]?.trim();
                const supplierGstin = row["supplierGstin"]?.trim();
                const gstAmount = parseFloat(row["gstAmount"]);

                if (invoiceNo && supplierGstin && !isNaN(gstAmount)) {
                    results.push({
                        invoiceNo,
                        supplierGstin,
                        invoiceDate: row["invoiceDate"]?.trim() || undefined,
                        gstAmount,
                    });
                }
            })
            .on("end", () => resolve(results))
            .on("error", (err) => reject(err));
    });
}

/**
 * Parse an Excel file (.xlsx / .xls) and return structured invoice data.
 */
export function parseExcel(filePath: string): ParsedInvoice[] {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData: Record<string, string>[] = XLSX.utils.sheet_to_json(sheet);

    const results: ParsedInvoice[] = [];

    for (const row of rawData) {
        // Normalize all keys in the row
        const normalized: Record<string, string> = {};
        for (const [key, value] of Object.entries(row)) {
            normalized[normalizeHeader(key)] = String(value);
        }

        const invoiceNo = normalized["invoiceNo"]?.trim();
        const supplierGstin = normalized["supplierGstin"]?.trim();
        const gstAmount = parseFloat(normalized["gstAmount"]);

        if (invoiceNo && supplierGstin && !isNaN(gstAmount)) {
            results.push({
                invoiceNo,
                supplierGstin,
                invoiceDate: normalized["invoiceDate"]?.trim() || undefined,
                gstAmount,
            });
        }
    }

    return results;
}

/**
 * Auto-detect file format and parse accordingly.
 */
export async function parseFile(filePath: string): Promise<ParsedInvoice[]> {
    const ext = path.extname(filePath).toLowerCase();

    if (ext === ".csv") {
        return parseCSV(filePath);
    } else if (ext === ".xlsx" || ext === ".xls") {
        return parseExcel(filePath);
    } else {
        throw new Error(`Unsupported file format: ${ext}`);
    }
}
