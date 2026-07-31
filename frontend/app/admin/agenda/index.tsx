import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import MonthGrid, { ymd, todayStr, MONTHS } from "@/src/components/agenda/MonthGrid";
import EventEditor from "@/src/components/agenda/EventEditor";
import { colors, spacing, radius } from "@/src/theme";

const VIEWS = [{ k: "dash", l: "Dashboard" }, { k: "month", l: "Mese" }, { k: "week", l: "Settimana" }, { k: "day", l: "Giorno" }];
const PRIO: Record<string, { l: string; c: string }> = { high: { l: "Alta", c: "#EF4444" }, normal: { l: "Normale", c: "#3B82F6" }, low: { l: "Bassa", c: "#64748B" } };

function EventRow({ e, onPress }: { e: any; onPress: () => void }) {
  return (
    <Pressable testID={`event-${e.id}`} onPress={onPress} style={styles.evRow}>
      <View style={[styles.evBar, { backgroundColor: e.color || colors.brandPrimary }]} />
      <View style={{ flex: 1 }}>
        <Text style={styles.evTitle} numberOfLines={1}>{e.title}</Text>
        <Text style={styles.evMeta} numberOfLines={1}>
          {(e.start_time ? e.start_time + (e.end_time ? `–${e.end_time}` : "") + " · " : "")}{e.location || e.link ? (e.location || "Online") : ""}
        </Text>
        <View style={styles.evTags}>
          {e.rsvp_summary?.yes > 0 && <Text style={styles.pill}>✅ {e.rsvp_summary.yes}</Text>}
          {e.priority && e.priority !== "normal" && <Text style={[styles.pill, { color: PRIO[e.priority]?.c }]}>{PRIO[e.priority]?.l}</Text>}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color={ADMIN.muted} />
    </Pressable>
  );
}

export default function AgendaScreen() {
  const router = useRouter();
  const [perms, setPerms] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [view, setView] = useState("dash");
  const [ref, setRef] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [selected, setSelected] = useState(todayStr());
  const [cats, setCats] = useState<any[]>([]);
  const [collabs, setCollabs] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [dash, setDash] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editor, setEditor] = useState(false);

  const canCreate = isAdmin || perms.includes("agenda.create");

  const loadMeta = useCallback(async () => {
    try {
      const me = await api.adminMe();
      setIsAdmin(me.role !== "collaborator");
      setPerms(me.permissions || []);
    } catch { /* ignore */ }
    try { setCats(await api.agendaCategories()); } catch { /* ignore */ }
    try { setCollabs(await api.agendaCollaborators()); } catch { /* ignore */ }
  }, []);

  // Data loader keyed on the visible month via PRIMITIVE deps (no object identity
  // churn) to avoid any re-render loops.
  const loadData = useCallback(async () => {
    const start = ymd(ref.y, ref.m, 1);
    const end = ymd(ref.y, ref.m, new Date(ref.y, ref.m + 1, 0).getDate());
    try {
      const [ev, db] = await Promise.all([
        api.agendaEvents({ start, end }),
        api.agendaDashboard(),
      ]);
      setEvents(ev || []);
      setDash(db);
    } catch { /* ignore */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [ref.y, ref.m]);

  // Meta loads once; data reloads on focus and when the month changes.
  useEffect(() => { loadMeta(); }, [loadMeta]);
  useFocusEffect(useCallback(() => { loadData(); }, [loadData]));

  const eventsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const e of events) { (map[e.date] = map[e.date] || []).push(e); }
    return map;
  }, [events]);

  const goEvent = (id: string) => router.push(`/admin/agenda/${id}` as any);
  const prevMonth = () => setRef((r) => r.m === 0 ? { y: r.y - 1, m: 11 } : { y: r.y, m: r.m - 1 });
  const nextMonth = () => setRef((r) => r.m === 11 ? { y: r.y + 1, m: 0 } : { y: r.y, m: r.m + 1 });

  const weekDays = useMemo(() => {
    const base = new Date(selected + "T00:00:00");
    const dow = (base.getDay() + 6) % 7;
    const mon = new Date(base); mon.setDate(base.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return ymd(d.getFullYear(), d.getMonth(), d.getDate()); });
  }, [selected]);

  const dayEvents = (ds: string) => (events.filter((e) => e.date === ds)).sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  const fmtDay = (ds: string) => { const d = new Date(ds + "T00:00:00"); return `${["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"][d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`; };

  return (
    <AdminShell title="Agenda" activeKey="agenda">
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadData(); }} tintColor={colors.white} />}
      >
        {/* view switch */}
        <View style={styles.tabs}>
          {VIEWS.map((v) => (
            <Pressable key={v.k} testID={`agenda-view-${v.k}`} onPress={() => setView(v.k)} style={[styles.tab, view === v.k && styles.tabOn]}>
              <Text style={[styles.tabText, view === v.k && styles.tabTextOn]}>{v.l}</Text>
            </Pressable>
          ))}
        </View>

        {canCreate && (
          <Pressable testID="agenda-new" onPress={() => { setSelected(view === "dash" ? todayStr() : selected); setEditor(true); }} style={styles.newBtn}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.newText}>Nuovo Evento</Text>
          </Pressable>
        )}

        {loading ? <ActivityIndicator color={colors.white} style={{ marginTop: 40 }} /> : (
          <>
            {view === "dash" && dash && (
              <View style={{ gap: spacing.md }}>
                <View style={styles.statsRow}>
                  <Stat n={dash.stats.events_today} l="Eventi oggi" icon="calendar-today" />
                  <Stat n={dash.stats.events_month} l="Eventi mese" icon="calendar-month" />
                  <Stat n={dash.stats.tasks_open} l="Task aperti" icon="clipboard-list-outline" />
                  <Stat n={dash.stats.tasks_done} l="Task fatti" icon="check-circle-outline" />
                </View>

                <Card title="📅 Eventi di oggi">
                  {dash.today.length === 0 ? <Empty t="Nessun evento oggi" /> : dash.today.map((e: any) => <EventRow key={e.id} e={e} onPress={() => goEvent(e.id)} />)}
                </Card>
                <Card title="⏭️ Prossimi eventi (7 giorni)">
                  {dash.upcoming.length === 0 ? <Empty t="Nessun evento in arrivo" /> : dash.upcoming.map((e: any) => (
                    <View key={e.id}>
                      <Text style={styles.dayHdr}>{fmtDay(e.date)}</Text>
                      <EventRow e={e} onPress={() => goEvent(e.id)} />
                    </View>
                  ))}
                </Card>
                <Card title="⚠️ Attività in scadenza">
                  {dash.due_tasks.length === 0 ? <Empty t="Nessuna scadenza" /> : dash.due_tasks.map((t: any) => (
                    <View key={t.id} style={styles.taskLine}>
                      <MaterialCommunityIcons name="clock-alert-outline" size={16} color="#F59E0B" />
                      <Text style={styles.taskText} numberOfLines={1}>{t.title}</Text>
                      <Text style={styles.taskDue}>{t.due_date}</Text>
                    </View>
                  ))}
                </Card>
              </View>
            )}

            {view === "month" && (
              <>
                <MonthGrid year={ref.y} month={ref.m} eventsByDate={eventsByDate} selected={selected} onSelectDay={setSelected} onPrev={prevMonth} onNext={nextMonth} />
                <Text style={styles.sectionTitle}>{fmtDay(selected)}</Text>
                {dayEvents(selected).length === 0 ? <Empty t="Nessun evento in questa data" /> : dayEvents(selected).map((e) => <EventRow key={e.id} e={e} onPress={() => goEvent(e.id)} />)}
              </>
            )}

            {view === "week" && (
              <View style={{ gap: spacing.sm }}>
                {weekDays.map((ds) => (
                  <Card key={ds} title={fmtDay(ds)} highlight={ds === todayStr()}>
                    {dayEvents(ds).length === 0 ? <Text style={styles.weekEmpty}>—</Text> : dayEvents(ds).map((e) => <EventRow key={e.id} e={e} onPress={() => goEvent(e.id)} />)}
                  </Card>
                ))}
              </View>
            )}

            {view === "day" && (
              <>
                <View style={styles.dayNav}>
                  <Pressable onPress={() => { const d = new Date(selected + "T00:00:00"); d.setDate(d.getDate() - 1); setSelected(ymd(d.getFullYear(), d.getMonth(), d.getDate())); }} style={styles.navBtn}><Ionicons name="chevron-back" size={20} color={colors.white} /></Pressable>
                  <Text style={styles.dayNavText}>{fmtDay(selected)}</Text>
                  <Pressable onPress={() => { const d = new Date(selected + "T00:00:00"); d.setDate(d.getDate() + 1); setSelected(ymd(d.getFullYear(), d.getMonth(), d.getDate())); }} style={styles.navBtn}><Ionicons name="chevron-forward" size={20} color={colors.white} /></Pressable>
                </View>
                {dayEvents(selected).length === 0 ? <Empty t="Nessun evento in questa data" /> : dayEvents(selected).map((e) => <EventRow key={e.id} e={e} onPress={() => goEvent(e.id)} />)}
              </>
            )}
          </>
        )}
      </ScrollView>

      <EventEditor
        visible={editor}
        onClose={() => setEditor(false)}
        onSaved={loadData}
        categories={cats}
        collaborators={collabs}
        defaultDate={selected}
      />
    </AdminShell>
  );
}

const Stat = ({ n, l, icon }: { n: number; l: string; icon: string }) => (
  <View style={styles.stat}>
    <MaterialCommunityIcons name={icon as any} size={20} color={colors.brandSecondary} />
    <Text style={styles.statN}>{n ?? 0}</Text>
    <Text style={styles.statL}>{l}</Text>
  </View>
);
const Card = ({ title, children, highlight }: { title: string; children: React.ReactNode; highlight?: boolean }) => (
  <View style={[styles.card, highlight && { borderColor: colors.brandPrimary }]}>
    <Text style={styles.cardTitle}>{title}</Text>
    {children}
  </View>
);
const Empty = ({ t }: { t: string }) => <Text style={styles.emptyT}>{t}</Text>;

const styles = StyleSheet.create({
  tabs: { flexDirection: "row", gap: 6, backgroundColor: ADMIN.card, borderRadius: radius.pill, padding: 4, marginBottom: spacing.md },
  tab: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: radius.pill },
  tabOn: { backgroundColor: colors.brandPrimary },
  tabText: { color: ADMIN.muted, fontSize: 13, fontWeight: "700" },
  tabTextOn: { color: "#fff" },
  newBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: colors.brandPrimary, borderRadius: radius.lg, paddingVertical: 13, marginBottom: spacing.md },
  newText: { color: "#fff", fontWeight: "800", fontSize: 15 },
  statsRow: { flexDirection: "row", gap: spacing.sm },
  stat: { flex: 1, backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.sm, alignItems: "center", borderWidth: 1, borderColor: ADMIN.border },
  statN: { color: colors.white, fontSize: 20, fontWeight: "800", marginTop: 2 },
  statL: { color: ADMIN.muted, fontSize: 10, fontWeight: "600", textAlign: "center" },
  card: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  cardTitle: { color: colors.white, fontSize: 15, fontWeight: "800", marginBottom: spacing.sm },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: "800", marginTop: spacing.lg, marginBottom: spacing.sm },
  evRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm, backgroundColor: ADMIN.surface, borderRadius: radius.md, padding: spacing.sm, marginBottom: 6 },
  evBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  evTitle: { color: colors.white, fontSize: 14, fontWeight: "700" },
  evMeta: { color: ADMIN.muted, fontSize: 12, marginTop: 1 },
  evTags: { flexDirection: "row", gap: 8, marginTop: 3 },
  pill: { color: ADMIN.muted, fontSize: 11, fontWeight: "700" },
  dayHdr: { color: colors.brandSecondary, fontSize: 11, fontWeight: "800", marginTop: 6, marginBottom: 2 },
  taskLine: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  taskText: { color: colors.white, fontSize: 13, flex: 1 },
  taskDue: { color: "#F59E0B", fontSize: 12, fontWeight: "700" },
  weekEmpty: { color: ADMIN.muted, fontSize: 13 },
  dayNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: ADMIN.card, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md },
  dayNavText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  navBtn: { padding: 6 },
  emptyT: { color: ADMIN.muted, fontSize: 13, paddingVertical: spacing.sm },
});
