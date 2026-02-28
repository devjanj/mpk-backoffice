import * as xlsx from 'xlsx';
import fs from 'fs';

let rows = [
    ["Date", "Income", "Outcome", "Balance"],
    ["01.01.2026", 100, 0, 100],
    ["02.01.2026", 0, 20, { f: "D2+B3-C3" }] 
];

const ws = xlsx.utils.aoa_to_sheet(rows);
const wb = xlsx.utils.book_new();
xlsx.utils.book_append_sheet(wb, ws, "Sheet1");
xlsx.writeFile(wb, "test_formula.xlsx");
console.log("Written test_formula.xlsx");
