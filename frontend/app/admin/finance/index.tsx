import React, { useCallback, useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import PressableScale from "@/src/components/PressableScale";
import EntryModal from "@/src/components/finance/EntryModal";
import DecisionModal from "@/src/components/finance/DecisionModal";
import MonthlyChart from "@/src/components/finance/MonthlyChart";
import { euro, dateLabel } from "@/src/utils/euro";
import { exportCsv, exportPdf } from "@/src/utils/financeExport";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

const CAT_ALL = "Tutte";

export default function FinanceScreen() {
  const [access, setAccess] = useState({ canWrite: false, canAudit: false });
  const [tab, setTab] = useState<"dashboard" | "income" | "expense" | "ledger" | "decisions" | "audit">("dashboard");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState<any>(null);
  const [cats, setCats] = useState<{ income: string[]; expense: string[]; payment_methods: string[] }>({ income: [], expense: [], payment_methods: [] });
  const [rows, setRows] = useState<any[]>([]);
  const [decisions, setDecisions] = useState<any[]>([]);
  const [audit, setAudit] = useState<any[]>([]);

  // filters
  const [q, setQ] = useState("");
  const [category, setCategory] = useState(CAT_ALL);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");

  // modals
  const [entryModal, setEntryModal] = useState<{ open: boolean; entry: any; type: "income" | "expense" }>({ open: false, entry: null, type: "income" });
  const [decisionModal, setDecisionModal] = useState<{ open: boolean; decision: any }>({ open: false, decision: null });

  useEffect(() => {
    api.adminMe().then((r: any) => setAccess({ canWrite: !!r.is_admin, canAudit: !!r.is_super })).catch(() => {});
    api.financeCategories().then(setCats).catch(() => {});
  }, []);

  const filterParams = useCallback(() => {
    const p: any = {};
    if (q) p.q = q;
    if (category && category !== CAT_ALL) p.category = category;
    if (month) p.month = month;
    if (year) p.year = year;
    return p;
  }, [q, category, month, year]);

  const load = useCallback(async () => {
    try {
      if (tab === "dashboard") setSummary(await api.financeSummary());
      else if (tab === "income") setRows(await api.financeEntries({ ...filterParams(), type: "income" }));
      else if (tab === "expense") setRows(await api.financeEntries({ ...filterParams(), type: "expense" }));
      else if (tab === "ledger") setRows(await api.financeLedger(filterParams()));
      else if (tab === "decisions") setDecisions(await api.financeDecisions());
      else if (tab === "audit") setAudit(await api.financeAudit());
    } catch (e: any) { /* ignore */ } finally { setLoading(false); setRefreshing(false); }
  }, [tab, filterParams]);

  useFocusEffect(useCallback(() => { setLoading(true); load(); }, [load]));
  useEffect(() => { setLoading(true); load(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const reloadAfterMutation = () => load();

  const deleteEntry = async (id: string) => {
    if (!(await confirmAsync("Elimina movimento", "Vuoi eliminare questo movimento? L'operazione sarà registrata nell'Audit Log.", "Elimina", true))) return;
    try { await api.financeDeleteEntry(id); load(); } catch (e: any) { alertMessage("Errore", e?.message); }
  };
  const deleteDecision = async (id: string) => {
    if (!(await confirmAsync("Elimina decisione", "Vuoi eliminare questa decisione?", "Elimina", true))) return;
    try { await api.financeDeleteDecision(id); load(); } catch (e: any) { alertMessage("Errore", e?.message); }
  };

  const doExport = async (fmt: "csv" | "pdf") => {
    const isLedger = tab === "ledger";
    const data = rows;
    if (!data.length) return alertMessage("Nessun dato", "Non ci sono movimenti da esportare con i filtri attuali.");
    const period = `${month ? `mese ${month} ` : ""}${year ? year : "tutti gli anni"}`.trim();
    if (fmt === "csv") {
      const cols = isLedger
        ? [{ label: "Data", get: (r: any) => r.date }, { label: "Tipo", get: (r: any) => r.type === "income" ? "Entrata" : "Uscita" }, { label: "Descrizione", get: (r: any) => r.description }, { label: "Categoria", get: (r: any) => r.category }, { label: "Importo", get: (r: any) => r.amount }, { label: "Saldo", get: (r: any) => r.balance }]
        : [{ label: "Data", get: (r: any) => r.date }, { label: "Descrizione", get: (r: any) => r.description }, { label: "Categoria", get: (r: any) => r.category }, { label: "Importo", get: (r: any) => r.amount }, { label: "Metodo/Pagato da", get: (r: any) => r.payment_method || r.paid_by || "" }, { label: "Provenienza", get: (r: any) => r.source || "" }, { label: "Inserito da", get: (r: any) => r.created_by_name || "" }, { label: "Note", get: (r: any) => r.notes || "" }];
      await exportCsv(data, cols, `trasparenza-${tab}.csv`);
    } else {
      const income = data.filter((r) => r.type === "income").reduce((s, r) => s + r.amount, 0);
      const expense = data.filter((r) => r.type === "expense").reduce((s, r) => s + r.amount, 0);
      const final = isLedger && data[0] ? data[0].balance : income - expense;
      const initial = final - (income - expense);
      await exportPdf({
        title: tab === "income" ? "Registro Entrate" : tab === "expense" ? "Registro Uscite" : "Registro Cronologico",
        period, summary: { initial, income, expense, final },
        rows: data.map((r) => ({ date: r.date, type: r.type, description: r.description, category: r.category, amount: r.amount, balance: isLedger ? r.balance : undefined })),
      });
    }
  };

  const TABS: { key: any; label: string; icon: any }[] = [
    { key: "dashboard", label: "Dashboard", icon: "view-dashboard" },
    { key: "income", label: "Entrate", icon: "arrow-down-bold-circle" },
    { key: "expense", label: "Uscite", icon: "arrow-up-bold-circle" },
    { key: "ledger", label: "Registro", icon: "format-list-numbered" },
    { key: "decisions", label: "Decisioni", icon: "gavel" },
    ...(access.canAudit ? [{ key: "audit" as const, label: "Audit Log", icon: "shield-lock" }] : []),
  ];

  return (
    <AdminShell title="Trasparenza Economica" activeKey="finance">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsWrap} contentContainerStyle={styles.tabs}>
        {TABS.map((t) => (
          <Pressable key={t.key} testID={`fin-tab-${t.key}`} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <MaterialCommunityIcons name={t.icon} size={16} color={tab === t.key ? colors.navy : ADMIN.muted} />
            <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading ? <View style={styles.center}><ActivityIndicator color={colors.brandPrimary} size="large" /></View> : (
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.brandPrimary} />}>

          {tab === "dashboard" && summary && (
            <>
              <View style={styles.cardsGrid}>
                <SummaryCard label="Saldo attuale" value={euro(summary.balance)} icon="wallet" color={colors.brandPrimary} />
                <SummaryCard label="Entrate del mese" value={euro(summary.month_income)} icon="trending-up" color={colors.success} />
                <SummaryCard label="Uscite del mese" value={euro(summary.month_expense)} icon="trending-down" color={colors.error} />
                <SummaryCard label="Totale offerte ricevute" value={euro(summary.total_offerings)} icon="heart" color="#EC4899" />
              </View>
              <Text style={styles.sectionTitle}>Andamento mensile</Text>
              <MonthlyChart data={summary.monthly} />
              <View style={styles.totalsRow}>
                <Text style={styles.totalText}>Totale entrate: <Text style={{ color: colors.success }}>{euro(summary.total_income)}</Text></Text>
                <Text style={styles.totalText}>Totale uscite: <Text style={{ color: colors.error }}>{euro(summary.total_expense)}</Text></Text>
              </View>
            </>
          )}

          {(tab === "income" || tab === "expense" || tab === "ledger") && (
            <>
              <Filters q={q} setQ={setQ} month={month} setMonth={setMonth} year={year} setYear={setYear}
                category={category} setCategory={setCategory}
                categories={tab === "expense" ? cats.expense : tab === "income" ? cats.income : [...cats.income, ...cats.expense]}
                onApply={() => { setLoading(true); load(); }} />

              <View style={styles.actionsRow}>
                {access.canWrite && tab !== "ledger" && (
                  <PressableScale testID="fin-add" style={styles.addBtn} onPress={() => setEntryModal({ open: true, entry: null, type: tab as any })}>
                    <Ionicons name="add" size={18} color="#fff" /><Text style={styles.addText}>Aggiungi</Text>
                  </PressableScale>
                )}
                {access.canWrite && (
                  <>
                    <PressableScale testID="fin-export-pdf" style={styles.exportBtn} onPress={() => doExport("pdf")}><Ionicons name="document-text-outline" size={16} color={colors.white} /><Text style={styles.exportText}>PDF</Text></PressableScale>
                    <PressableScale testID="fin-export-csv" style={styles.exportBtn} onPress={() => doExport("csv")}><Ionicons name="grid-outline" size={16} color={colors.white} /><Text style={styles.exportText}>Excel</Text></PressableScale>
                  </>
                )}
              </View>

              {rows.length === 0 ? <Text style={styles.empty}>Nessun movimento.</Text> : rows.map((r) => (
                <PressableScale key={r.id} testID={`fin-row-${r.id}`} style={styles.row}
                  onPress={() => { if (tab !== "ledger") setEntryModal({ open: true, entry: r, type: r.type }); }}>
                  <View style={[styles.typeDot, { backgroundColor: r.type === "income" ? colors.success : colors.error }]}>
                    <Ionicons name={r.type === "income" ? "arrow-down" : "arrow-up"} size={16} color="#fff" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{r.description}</Text>
                    <View style={styles.rowMetaWrap}>
                      <View style={styles.catBadge}><Text style={styles.catText}>{r.category}</Text></View>
                      {r.auto && <View style={[styles.catBadge, { backgroundColor: "#0EA5E922" }]}><Text style={[styles.catText, { color: "#38BDF8" }]}>Auto</Text></View>}
                      {r.has_attachment && <Ionicons name="attach" size={13} color={ADMIN.muted} />}
                    </View>
                    <Text style={styles.rowMeta}>{dateLabel(r.date)}{r.created_by_name ? ` · ${r.created_by_name}` : ""}</Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.amount, { color: r.type === "income" ? colors.success : colors.error }]}>{r.type === "income" ? "+" : "−"} {euro(r.amount)}</Text>
                    {tab === "ledger" && <Text style={styles.balance}>Saldo: {euro(r.balance)}</Text>}
                    {access.canWrite && tab !== "ledger" && (
                      <Pressable testID={`fin-del-${r.id}`} onPress={() => deleteEntry(r.id)} hitSlop={8}><Ionicons name="trash-outline" size={16} color={colors.error} /></Pressable>
                    )}
                  </View>
                </PressableScale>
              ))}
            </>
          )}

          {tab === "decisions" && (
            <>
              {access.canWrite && (
                <PressableScale testID="dec-add" style={[styles.addBtn, { alignSelf: "flex-start", marginBottom: spacing.md }]} onPress={() => setDecisionModal({ open: true, decision: null })}>
                  <Ionicons name="add" size={18} color="#fff" /><Text style={styles.addText}>Nuova decisione</Text>
                </PressableScale>
              )}
              {decisions.length === 0 ? <Text style={styles.empty}>Nessuna decisione registrata.</Text> : decisions.map((d) => (
                <PressableScale key={d.id} testID={`dec-row-${d.id}`} style={styles.decCard} onPress={() => { if (access.canWrite) setDecisionModal({ open: true, decision: d }); }}>
                  <View style={styles.decHeader}>
                    <MaterialCommunityIcons name="gavel" size={18} color={colors.brandPrimary} />
                    <Text style={styles.decTitle} numberOfLines={1}>{d.title}</Text>
                    {access.canWrite && <Pressable testID={`dec-del-${d.id}`} onPress={() => deleteDecision(d.id)} hitSlop={8}><Ionicons name="trash-outline" size={16} color={colors.error} /></Pressable>}
                  </View>
                  {!!d.description && <Text style={styles.decDesc}>{d.description}</Text>}
                  <Text style={styles.decMeta}>{dateLabel(d.date)} · {d.author_name}</Text>
                </PressableScale>
              ))}
            </>
          )}

          {tab === "audit" && (
            <>
              <View style={styles.auditNote}><Ionicons name="lock-closed" size={14} color={ADMIN.muted} /><Text style={styles.auditNoteText}>Registro immutabile — sola consultazione (Amministratore Principale)</Text></View>
              {audit.length === 0 ? <Text style={styles.empty}>Nessuna operazione registrata.</Text> : audit.map((a) => (
                <View key={a.id} style={styles.auditRow}>
                  <View style={[styles.opBadge, { backgroundColor: a.operation === "create" ? colors.success + "22" : a.operation === "delete" ? colors.error + "22" : "#F59E0B22" }]}>
                    <Text style={[styles.opText, { color: a.operation === "create" ? colors.success : a.operation === "delete" ? colors.error : "#F59E0B" }]}>
                      {a.operation === "create" ? "Creazione" : a.operation === "delete" ? "Eliminazione" : "Modifica"}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.auditTitle}>{a.section === "entry" ? "Movimento" : "Decisione"} · {a.after?.description || a.after?.title || a.before?.description || a.before?.title || a.record_id}</Text>
                    <Text style={styles.auditMeta}>{new Date(a.at).toLocaleString("it-IT")} · {a.user_name}{a.ip ? ` · IP ${a.ip}` : ""}</Text>
                    {a.operation === "update" && a.before && a.after && (
                      <Text style={styles.auditDiff}>Importo: {euro(a.before.amount)} → {euro(a.after.amount)}</Text>
                    )}
                  </View>
                </View>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <EntryModal visible={entryModal.open} type={entryModal.type} entry={entryModal.entry}
        categories={entryModal.type === "income" ? cats.income : cats.expense} paymentMethods={cats.payment_methods}
        readOnly={!access.canWrite}
        onClose={() => setEntryModal((s) => ({ ...s, open: false }))} onSaved={reloadAfterMutation} />
      <DecisionModal visible={decisionModal.open} decision={decisionModal.decision}
        onClose={() => setDecisionModal({ open: false, decision: null })} onSaved={reloadAfterMutation} />
    </AdminShell>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string; icon: any; color: string }) {
  return (
    <View style={styles.sumCard}>
      <View style={[styles.sumIcon, { backgroundColor: color + "22" }]}><Ionicons name={icon} size={18} color={color} /></View>
      <Text style={styles.sumValue}>{value}</Text>
      <Text style={styles.sumLabel}>{label}</Text>
    </View>
  );
}

function Filters({ q, setQ, month, setMonth, year, setYear, category, setCategory, categories, onApply }: any) {
  const MONTHS = ["", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
  return (
    <View style={styles.filters}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={ADMIN.muted} />
        <TextInput testID="fin-search" value={q} onChangeText={setQ} onSubmitEditing={onApply} placeholder="Ricerca..." placeholderTextColor={ADMIN.muted} style={styles.searchInput} returnKeyType="search" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
        <FilterChip label={category} options={[CAT_ALL, ...categories]} onChange={(v: string) => { setCategory(v); }} />
        <FilterChip label={month ? `Mese ${month}` : "Mese"} options={MONTHS.map((m) => m || "Tutti")} values={MONTHS} onChange={(v: string) => setMonth(v)} />
        <FilterChip label={year ? year : "Anno"} options={["Tutti", "2024", "2025", "2026", "2027"]} values={["", "2024", "2025", "2026", "2027"]} onChange={(v: string) => setYear(v)} />
        <PressableScale testID="fin-apply" style={styles.applyBtn} onPress={onApply}><Text style={styles.applyText}>Applica</Text></PressableScale>
      </ScrollView>
    </View>
  );
}

function FilterChip({ label, options, values, onChange }: { label: string; options: string[]; values?: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale style={styles.filterChip} onPress={() => setOpen(true)}><Text style={styles.filterChipText}>{label}</Text><Ionicons name="chevron-down" size={13} color={ADMIN.muted} /></PressableScale>
      {open && (
        <View style={styles.chipDropdown}>
          <ScrollView>
            {options.map((o, i) => (
              <Pressable key={o + i} style={styles.chipOpt} onPress={() => { onChange(values ? values[i] : (o === CAT_ALL ? CAT_ALL : o)); setOpen(false); }}>
                <Text style={styles.chipOptText}>{o}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  center: { padding: spacing["2xl"], alignItems: "center" },
  tabsWrap: { maxHeight: 52, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  tabs: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  tab: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  tabActive: { backgroundColor: colors.white, borderColor: colors.white },
  tabText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  tabTextActive: { color: colors.navy },
  cardsGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  sumCard: { flexGrow: 1, minWidth: 150, flexBasis: "45%", backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.lg, borderWidth: 1, borderColor: ADMIN.border },
  sumIcon: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center", marginBottom: spacing.sm },
  sumValue: { color: colors.white, fontSize: 20, fontWeight: "800" },
  sumLabel: { color: ADMIN.muted, fontSize: 12, marginTop: 2 },
  sectionTitle: { color: colors.white, fontSize: 16, fontWeight: "800", marginTop: spacing.xl, marginBottom: spacing.md },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", marginTop: spacing.lg, flexWrap: "wrap", gap: spacing.sm },
  totalText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  filters: { marginBottom: spacing.md },
  searchBox: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.card, borderRadius: radius.md, paddingHorizontal: spacing.md, height: 42, borderWidth: 1, borderColor: ADMIN.border },
  searchInput: { flex: 1, color: colors.white, fontSize: 14 },
  filterChip: { flexDirection: "row", alignItems: "center", gap: 4, height: 34, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: ADMIN.card, borderWidth: 1, borderColor: ADMIN.border },
  filterChipText: { color: colors.white, fontSize: 12.5, fontWeight: "600" },
  chipDropdown: { position: "absolute", top: 44, left: 0, backgroundColor: ADMIN.card, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, maxHeight: 200, minWidth: 120, zIndex: 50 },
  chipOpt: { paddingVertical: 10, paddingHorizontal: spacing.md, borderBottomWidth: 1, borderBottomColor: ADMIN.border },
  chipOptText: { color: colors.white, fontSize: 13 },
  applyBtn: { height: 34, paddingHorizontal: spacing.lg, borderRadius: radius.pill, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  applyText: { color: "#fff", fontSize: 12.5, fontWeight: "800" },
  actionsRow: { flexDirection: "row", gap: spacing.sm, marginBottom: spacing.md, flexWrap: "wrap" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandPrimary, paddingHorizontal: spacing.lg, height: 40, borderRadius: radius.pill },
  addText: { color: "#fff", fontSize: 14, fontWeight: "800" },
  exportBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: ADMIN.card, paddingHorizontal: spacing.md, height: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: ADMIN.border },
  exportText: { color: colors.white, fontSize: 13, fontWeight: "700" },
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: spacing.xl, fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  typeDot: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  rowTitle: { color: colors.white, fontSize: 14.5, fontWeight: "700" },
  rowMetaWrap: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 },
  catBadge: { backgroundColor: colors.brandPrimary + "22", paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.sm },
  catText: { color: colors.brandPrimary, fontSize: 10, fontWeight: "800" },
  rowMeta: { color: ADMIN.muted, fontSize: 11.5, marginTop: 3 },
  amount: { fontSize: 15, fontWeight: "800" },
  balance: { color: ADMIN.muted, fontSize: 11, marginTop: 2 },
  decCard: { backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.lg, marginBottom: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  decHeader: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  decTitle: { flex: 1, color: colors.white, fontSize: 15, fontWeight: "800" },
  decDesc: { color: "#CBD5E1", fontSize: 13.5, lineHeight: 20, marginTop: spacing.sm },
  decMeta: { color: ADMIN.muted, fontSize: 11.5, marginTop: spacing.sm },
  auditNote: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: spacing.md },
  auditNoteText: { color: ADMIN.muted, fontSize: 12, fontStyle: "italic" },
  auditRow: { flexDirection: "row", gap: spacing.md, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.md, marginBottom: spacing.sm, borderWidth: 1, borderColor: ADMIN.border },
  opBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.sm, alignSelf: "flex-start" },
  opText: { fontSize: 10, fontWeight: "800" },
  auditTitle: { color: colors.white, fontSize: 13.5, fontWeight: "700" },
  auditMeta: { color: ADMIN.muted, fontSize: 11, marginTop: 3 },
  auditDiff: { color: colors.brandSecondary, fontSize: 11.5, marginTop: 3 },
});
