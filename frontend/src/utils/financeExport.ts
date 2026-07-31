import { Platform, Image } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system/legacy";
import { euro, dateLabel, monthLabel } from "@/src/utils/euro";

const LOGO = require("@/assets/images/logo.png");

async function logoDataUri(): Promise<string> {
  try {
    const src = Image.resolveAssetSource(LOGO);
    const resp = await fetch(src.uri);
    const blob = await resp.blob();
    return await new Promise((res) => {
      const r = new FileReader();
      r.onloadend = () => res(String(r.result || ""));
      r.readAsDataURL(blob);
    });
  } catch {
    return "";
  }
}

function webDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

function csvCell(v: any): string {
  const s = v === null || v === undefined ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

/** Export rows to a CSV file (opens in Excel). columns: [{label, get}]. */
export async function exportCsv(rows: any[], columns: { label: string; get: (r: any) => any }[], filename: string) {
  const header = columns.map((c) => csvCell(c.label)).join(";");
  const body = rows.map((r) => columns.map((c) => csvCell(c.get(r))).join(";")).join("\n");
  const csv = "\uFEFF" + header + "\n" + body; // BOM so Excel reads UTF-8
  if (Platform.OS === "web") {
    webDownload(csv, filename, "text/csv;charset=utf-8;");
    return;
  }
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, csv, { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "text/csv", dialogTitle: "Esporta Excel/CSV" });
  }
}

type PdfOpts = {
  title: string;
  period: string;
  summary: { initial: number; income: number; expense: number; final: number };
  rows: { date: string; type: string; description: string; category: string; amount: number; balance?: number }[];
};

/** Export a formatted PDF report with logo, period, generation date and summary. */
export async function exportPdf(opts: PdfOpts) {
  const logo = await logoDataUri();
  const now = new Date().toLocaleString("it-IT");
  const rowsHtml = opts.rows.map((r) => `
    <tr>
      <td>${dateLabel(r.date)}</td>
      <td><span class="pill ${r.type === "income" ? "in" : "out"}">${r.type === "income" ? "Entrata" : "Uscita"}</span></td>
      <td>${escapeHtml(r.description || "")}</td>
      <td>${escapeHtml(r.category || "")}</td>
      <td class="amt ${r.type === "income" ? "in" : "out"}">${r.type === "income" ? "+" : "−"} ${euro(r.amount)}</td>
      ${r.balance !== undefined ? `<td class="amt">${euro(r.balance)}</td>` : ""}
    </tr>`).join("");
  const hasBalance = opts.rows.some((r) => r.balance !== undefined);
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color:#0A1128; padding:28px; }
    .header { display:flex; align-items:center; gap:14px; border-bottom:3px solid #0EA5E9; padding-bottom:14px; }
    .header img { width:54px; height:54px; }
    .brand { font-size:20px; font-weight:800; }
    .sub { color:#475569; font-size:12px; margin-top:2px; }
    h1 { font-size:18px; margin:22px 0 4px; }
    .meta { color:#475569; font-size:12px; margin-bottom:16px; }
    .cards { display:flex; gap:10px; margin:14px 0 20px; flex-wrap:wrap; }
    .card { flex:1; min-width:120px; border:1px solid #E2E8F0; border-radius:10px; padding:12px; }
    .card .l { color:#64748B; font-size:11px; text-transform:uppercase; letter-spacing:.5px; }
    .card .v { font-size:18px; font-weight:800; margin-top:4px; }
    table { width:100%; border-collapse:collapse; font-size:12px; margin-top:8px; }
    th { text-align:left; background:#0A1128; color:#fff; padding:8px; font-size:11px; }
    td { padding:8px; border-bottom:1px solid #E2E8F0; }
    .amt { text-align:right; font-variant-numeric:tabular-nums; font-weight:700; }
    .in { color:#059669; } .out { color:#DC2626; }
    .pill { padding:2px 8px; border-radius:10px; font-size:10px; font-weight:800; }
    .pill.in { background:#D1FAE5; color:#059669; } .pill.out { background:#FEE2E2; color:#DC2626; }
    .footer { margin-top:18px; color:#94A3B8; font-size:10px; text-align:center; }
  </style></head><body>
    <div class="header">
      ${logo ? `<img src="${logo}"/>` : ""}
      <div><div class="brand">Pescatori di Uomini</div><div class="sub">Trasparenza Economica</div></div>
    </div>
    <h1>${escapeHtml(opts.title)}</h1>
    <div class="meta">Periodo: ${escapeHtml(opts.period)} · Generato il ${now}</div>
    <div class="cards">
      <div class="card"><div class="l">Saldo iniziale</div><div class="v">${euro(opts.summary.initial)}</div></div>
      <div class="card"><div class="l">Totale entrate</div><div class="v in">${euro(opts.summary.income)}</div></div>
      <div class="card"><div class="l">Totale uscite</div><div class="v out">${euro(opts.summary.expense)}</div></div>
      <div class="card"><div class="l">Saldo finale</div><div class="v">${euro(opts.summary.final)}</div></div>
    </div>
    <table>
      <thead><tr><th>Data</th><th>Tipo</th><th>Descrizione</th><th>Categoria</th><th style="text-align:right">Importo</th>${hasBalance ? "<th style='text-align:right'>Saldo</th>" : ""}</tr></thead>
      <tbody>${rowsHtml || `<tr><td colspan="6">Nessun movimento nel periodo.</td></tr>`}</tbody>
    </table>
    <div class="footer">Documento generato automaticamente da Radio Pescatori di Uomini — testimonianza di una gestione trasparente.</div>
  </body></html>`;

  if (Platform.OS === "web") {
    await Print.printAsync({ html });
    return;
  }
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Esporta PDF" });
  }
}

function escapeHtml(s: string): string {
  return (s || "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));
}

export { monthLabel };
