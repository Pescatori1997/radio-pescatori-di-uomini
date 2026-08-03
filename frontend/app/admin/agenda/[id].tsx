import React, { useCallback, useRef, useState } from "react";
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, TextInput, Linking, Image } from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { api } from "@/src/api";
import AdminShell, { ADMIN } from "@/src/components/AdminShell";
import EventEditor from "@/src/components/agenda/EventEditor";
import TypingBubble from "@/src/components/agenda/TypingBubble";
import { pickImageAttachment, pickDocumentAttachment, openAttachment } from "@/src/utils/agendaAttach";
import { confirmAsync, alertMessage } from "@/src/utils/confirm";
import { colors, spacing, radius } from "@/src/theme";

const RSVP_OPTS = [
  { k: "yes", l: "Parteciperò", icon: "checkmark-circle", c: "#22C55E" },
  { k: "maybe", l: "Forse", icon: "help-circle", c: "#F59E0B" },
  { k: "no", l: "Non posso", icon: "close-circle", c: "#EF4444" },
];

function fmtTime(iso?: string) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
}

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ev, setEv] = useState<any>(null);
  const [me, setMe] = useState<any>(null);
  const [perms, setPerms] = useState<string[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [collabs, setCollabs] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editor, setEditor] = useState(false);
  const [comment, setComment] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [newTask, setNewTask] = useState("");
  const [typingUsers, setTypingUsers] = useState<any[]>([]);
  const lastPing = useRef(0);

  const can = (p: string) => isAdmin || perms.includes(`agenda.${p}`);

  const load = useCallback(async () => {
    try {
      const [e, m] = await Promise.all([api.agendaEvent(id), api.adminMe()]);
      setEv(e); setMe(m.user); setIsAdmin(m.role !== "collaborator"); setPerms(m.permissions || []);
    } catch { alertMessage("Errore", "Evento non trovato."); }
    finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => {
    load();
    api.agendaCollaborators().then(setCollabs).catch(() => {});
    api.agendaCategories().then(setCats).catch(() => {});
    // Near real-time discussion: refresh the event (comments/tasks) periodically
    // while the screen is focused, so messages from teammates appear live.
    const iv = setInterval(() => { api.agendaEvent(id).then(setEv).catch(() => {}); }, 4000);
    // Faster poll for the WhatsApp-style "is typing…" indicator.
    const tv = setInterval(() => { api.agendaTyping(id).then(setTypingUsers).catch(() => {}); }, 2000);
    return () => { clearInterval(iv); clearInterval(tv); };
  }, [load, id]));

  const reload = () => api.agendaEvent(id).then(setEv).catch(() => {});

  // Throttle "typing" pings to the server (max ~1 every 2.5s while typing).
  const onCommentChange = (v: string) => {
    setComment(v);
    const now = Date.now();
    if (v.trim() && now - lastPing.current > 2500) {
      lastPing.current = now;
      api.agendaTypingPing(id).catch(() => {});
    }
  };

  const doRsvp = async (status: string) => { try { await api.agendaRsvp(id, status); reload(); } catch (e: any) { alertMessage("Errore", e?.message || "Riprova."); } };
  const del = async () => { if (!(await confirmAsync("Eliminare l'evento?", "Questa azione è irreversibile."))) return; await api.agendaDelete(id); router.back(); };

  const addComment = async () => {
    const text = comment.trim();
    if (!text) return;
    const mts = mentions;
    setComment(""); setMentions([]);
    try {
      const created = await api.agendaCommentCreate(id, { text, mentions: mts });
      // Optimistic: show my message instantly without waiting for a reload.
      setEv((prev: any) => (prev ? { ...prev, comments: [...(prev.comments || []), created] } : prev));
    } catch (e: any) { setComment(text); setMentions(mts); alertMessage("Errore", e?.message || "Riprova."); }
  };
  const delComment = async (cid: string) => { await api.agendaCommentDelete(cid); reload(); };

  const addTask = async () => {
    if (!newTask.trim()) return;
    try { await api.agendaTaskCreate(id, { title: newTask.trim(), priority: "normal", status: "open" }); setNewTask(""); reload(); }
    catch (e: any) { alertMessage("Errore", e?.message || "Riprova."); }
  };
  const toggleTask = async (t: any) => { await api.agendaTaskUpdate(t.id, { title: t.title, assignee_id: t.assignee_id, priority: t.priority, due_date: t.due_date, status: t.status === "done" ? "open" : "done" }); reload(); };
  const delTask = async (tid: string) => { await api.agendaTaskDelete(tid); reload(); };
  const assignTask = async (t: any, uid: string) => { await api.agendaTaskUpdate(t.id, { title: t.title, assignee_id: uid, priority: t.priority, due_date: t.due_date, status: t.status }); reload(); };

  const [linkUrl, setLinkUrl] = useState("");
  const [linkName, setLinkName] = useState("");
  const saveLink = async () => {
    if (!linkUrl.trim()) return;
    await api.agendaAttachCreate(id, { name: linkName.trim() || linkUrl.trim(), kind: "link", url: linkUrl.trim() });
    setLinkUrl(""); setLinkName(""); reload();
  };
  const addImage = async () => { const a = await pickImageAttachment(); if (a) { await api.agendaAttachCreate(id, a); reload(); } };
  const addDoc = async () => { try { const a = await pickDocumentAttachment(); if (a) { await api.agendaAttachCreate(id, a); reload(); } } catch { alertMessage("Errore", "Impossibile caricare il file."); } };
  const delAttach = async (aid: string) => { await api.agendaAttachDelete(aid); reload(); };

  if (loading) return <AdminShell title="Evento" activeKey="agenda"><ActivityIndicator color={colors.white} style={{ marginTop: 50 }} /></AdminShell>;
  if (!ev) return <AdminShell title="Evento" activeKey="agenda"><Text style={styles.empty}>Evento non trovato</Text></AdminShell>;

  const progress = ev.task_progress?.total ? ev.task_progress.done / ev.task_progress.total : 0;
  const myRsvp = (ev.rsvp || []).find((r: any) => r.user_id === me?.id)?.status;

  return (
    <AdminShell title="Evento" activeKey="agenda">
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120 }}>
        {/* Header */}
        <View style={[styles.header, { borderLeftColor: ev.color || colors.brandPrimary }]}>
          <Text style={styles.title}>{ev.title}</Text>
          <View style={styles.metaRow}><Ionicons name="calendar" size={15} color={colors.brandSecondary} /><Text style={styles.meta}>{ev.date}{ev.start_time ? ` · ${ev.start_time}${ev.end_time ? `–${ev.end_time}` : ""}` : ""}</Text></View>
          {!!ev.location && <View style={styles.metaRow}><Ionicons name="location" size={15} color={colors.brandSecondary} /><Text style={styles.meta}>{ev.location}</Text></View>}
          {!!ev.link && <Pressable style={styles.metaRow} onPress={() => Linking.openURL(ev.link)}><Ionicons name="videocam" size={15} color={colors.brandSecondary} /><Text style={[styles.meta, styles.link]}>{ev.link}</Text></Pressable>}
          <View style={styles.metaRow}><Ionicons name="person" size={15} color={colors.brandSecondary} /><Text style={styles.meta}>Organizzatore: {ev.organizer_name}</Text></View>
          {!!(ev.tags || []).length && <View style={styles.tags}>{ev.tags.map((t: string) => <Text key={t} style={styles.tag}>#{t}</Text>)}</View>}
          {!!ev.description && <Text style={styles.desc}>{ev.description}</Text>}
          <View style={styles.actionRow}>
            {can("edit") && <Pressable testID="event-edit" onPress={() => setEditor(true)} style={styles.smallBtn}><Ionicons name="create" size={16} color="#fff" /><Text style={styles.smallBtnT}>Modifica</Text></Pressable>}
            {can("delete") && <Pressable testID="event-delete" onPress={del} style={[styles.smallBtn, { backgroundColor: "#7F1D1D" }]}><Ionicons name="trash" size={16} color="#fff" /><Text style={styles.smallBtnT}>Elimina</Text></Pressable>}
          </View>
        </View>

        {/* RSVP */}
        {can("rsvp") && (
          <Section title="La tua presenza">
            <View style={styles.rsvpRow}>
              {RSVP_OPTS.map((o) => (
                <Pressable key={o.k} testID={`rsvp-${o.k}`} onPress={() => doRsvp(o.k)} style={[styles.rsvpBtn, myRsvp === o.k && { backgroundColor: o.c, borderColor: o.c }]}>
                  <Ionicons name={o.icon as any} size={16} color={myRsvp === o.k ? "#fff" : o.c} />
                  <Text style={[styles.rsvpT, myRsvp === o.k && { color: "#fff" }]}>{o.l}</Text>
                </Pressable>
              ))}
            </View>
          </Section>
        )}

        {/* Participants */}
        <Section title={`Partecipanti · ✅ ${ev.rsvp_summary?.yes || 0}  🤔 ${ev.rsvp_summary?.maybe || 0}  ❌ ${ev.rsvp_summary?.no || 0}`}>
          {(ev.rsvp || []).length === 0 && (ev.invitees_named || []).length === 0 ? <Text style={styles.muted}>Nessun invitato</Text> : (
            <>
              {(ev.rsvp || []).map((r: any) => (
                <View key={r.user_id} style={styles.pRow}>
                  <Text style={styles.pName}>{r.name}</Text>
                  <Text style={{ fontSize: 13 }}>{r.status === "yes" ? "✅" : r.status === "maybe" ? "🤔" : "❌"}</Text>
                </View>
              ))}
              {(ev.invitees_named || []).filter((i: any) => !(ev.rsvp || []).some((r: any) => r.user_id === i.user_id)).map((i: any) => (
                <View key={i.user_id} style={styles.pRow}><Text style={styles.pName}>{i.name}</Text><Text style={styles.muted}>in attesa</Text></View>
              ))}
            </>
          )}
        </Section>

        {/* Tasks */}
        <Section title={`Attività${ev.task_progress?.total ? ` · ${ev.task_progress.done}/${ev.task_progress.total}` : ""}`}>
          {ev.task_progress?.total > 0 && <View style={styles.progressBg}><View style={[styles.progressFill, { width: `${progress * 100}%` }]} /></View>}
          {(ev.tasks || []).map((t: any) => (
            <View key={t.id} style={styles.taskRow}>
              <Pressable testID={`task-toggle-${t.id}`} onPress={() => can("tasks") && toggleTask(t)} hitSlop={8}>
                <Ionicons name={t.status === "done" ? "checkbox" : "square-outline"} size={22} color={t.status === "done" ? "#22C55E" : ADMIN.muted} />
              </Pressable>
              <View style={{ flex: 1 }}>
                <Text style={[styles.taskT, t.status === "done" && styles.taskDone]}>{t.title}</Text>
                <Text style={styles.taskMeta}>{t.assignee_name ? `👤 ${t.assignee_name}` : "Non assegnato"}{t.due_date ? ` · ⏰ ${t.due_date}` : ""}</Text>
              </View>
              {can("tasks") && <Pressable onPress={() => delTask(t.id)} hitSlop={8}><Ionicons name="close" size={18} color={ADMIN.muted} /></Pressable>}
            </View>
          ))}
          {can("tasks") && (
            <View style={styles.addRow}>
              <TextInput testID="task-input" value={newTask} onChangeText={setNewTask} placeholder="Nuova attività…" placeholderTextColor={ADMIN.muted} style={styles.addInput} onSubmitEditing={addTask} />
              <Pressable testID="task-add" onPress={addTask} style={styles.addBtn}><Ionicons name="add" size={20} color="#fff" /></Pressable>
            </View>
          )}
        </Section>

        {/* Attachments */}
        <Section title="Allegati">
          {(ev.attachments || []).map((a: any) => (
            <View key={a.id} style={styles.attRow}>
              <Ionicons name={a.kind === "image" ? "image" : a.kind === "pdf" ? "document" : a.kind === "link" ? "link" : "document-attach"} size={18} color={colors.brandSecondary} />
              {a.kind === "image" && !!a.url && <Image source={{ uri: a.url }} style={styles.thumb} />}
              <Pressable style={{ flex: 1 }} onPress={() => openAttachment(a)}><Text style={styles.attName} numberOfLines={1}>{a.name}</Text></Pressable>
              {can("attach") && <Pressable onPress={() => delAttach(a.id)} hitSlop={8}><Ionicons name="trash-outline" size={16} color={ADMIN.muted} /></Pressable>}
            </View>
          ))}
          {can("attach") && (
            <>
              <View style={styles.attBtns}>
                <Pressable testID="attach-image" onPress={addImage} style={styles.attBtn}><Ionicons name="image" size={16} color="#fff" /><Text style={styles.attBtnT}>Immagine</Text></Pressable>
                <Pressable testID="attach-doc" onPress={addDoc} style={styles.attBtn}><Ionicons name="document" size={16} color="#fff" /><Text style={styles.attBtnT}>PDF/File</Text></Pressable>
              </View>
              <View style={styles.addRow}>
                <TextInput value={linkName} onChangeText={setLinkName} placeholder="Nome link" placeholderTextColor={ADMIN.muted} style={[styles.addInput, { flex: 0.9 }]} />
                <TextInput value={linkUrl} onChangeText={setLinkUrl} placeholder="https://…" placeholderTextColor={ADMIN.muted} autoCapitalize="none" style={styles.addInput} />
                <Pressable testID="attach-link" onPress={saveLink} style={styles.addBtn}><Ionicons name="add" size={20} color="#fff" /></Pressable>
              </View>
            </>
          )}
        </Section>

        {/* Comments */}
        <Section title="Discussione">
          <View style={styles.chat}>
            {(() => {
              const seen = new Set<string>();
              const comments = (ev.comments || []).filter((c: any) => { if (seen.has(c.id)) return false; seen.add(c.id); return true; });
              return (
                <>
                  {comments.length === 0 && typingUsers.length === 0 && (
                    <Text style={styles.chatEmpty}>Nessun messaggio. Inizia la conversazione 👋</Text>
                  )}
                  {comments.map((c: any) => {
                    const own = c.user_id === me?.id;
                    return (
                      <View key={c.id} style={[styles.msgRow, own && styles.msgRowOwn]}>
                        {!own && <View style={styles.cAvatar}><Text style={styles.cInit}>{(c.user_name || "?")[0]?.toUpperCase()}</Text></View>}
                        <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleOther]}>
                          {!own && <Text style={styles.cName}>{c.user_name}</Text>}
                          <Text style={[styles.msgText, own && { color: "#fff" }]}>{c.text}</Text>
                          <Text style={[styles.msgTime, own && { color: "rgba(255,255,255,0.75)" }]}>{fmtTime(c.created_at)}</Text>
                        </View>
                        {(isAdmin || own) && <Pressable onPress={() => delComment(c.id)} hitSlop={8} style={{ paddingHorizontal: 2, alignSelf: "center" }}><Ionicons name="close" size={14} color={ADMIN.muted} /></Pressable>}
                      </View>
                    );
                  })}
                </>
              );
            })()}
            {typingUsers.map((t) => <TypingBubble key={t.user_id} name={t.name} />)}
          </View>
          {can("comment") && (
            <>
              {collabs.length > 0 && (
                <View style={styles.mentionRow}>
                  <Text style={styles.mentionLbl}>@</Text>
                  {collabs.slice(0, 8).map((c) => (
                    <Pressable key={c.user_id} onPress={() => setMentions((m) => m.includes(c.user_id) ? m.filter((x) => x !== c.user_id) : [...m, c.user_id])} style={[styles.mentionChip, mentions.includes(c.user_id) && styles.mentionOn]}>
                      <Text style={[styles.mentionT, mentions.includes(c.user_id) && { color: "#fff" }]}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
              <View style={styles.addRow}>
                <TextInput testID="comment-input" value={comment} onChangeText={onCommentChange} placeholder="Scrivi un messaggio…" placeholderTextColor={ADMIN.muted} style={styles.addInput} multiline />
                <Pressable testID="comment-add" onPress={addComment} style={styles.addBtn}><Ionicons name="send" size={18} color="#fff" /></Pressable>
              </View>
            </>
          )}
        </Section>
      </ScrollView>

      <EventEditor visible={editor} onClose={() => setEditor(false)} onSaved={reload} categories={cats} collaborators={collabs} event={ev} />
    </AdminShell>
  );
}

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{children}</View>
);

const styles = StyleSheet.create({
  empty: { color: ADMIN.muted, textAlign: "center", marginTop: 50 },
  header: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.lg, borderLeftWidth: 5, marginBottom: spacing.md },
  title: { color: colors.white, fontSize: 20, fontWeight: "800", marginBottom: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  meta: { color: ADMIN.muted, fontSize: 13, flex: 1 },
  link: { color: colors.brandSecondary, textDecorationLine: "underline" },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tag: { color: colors.brandSecondary, fontSize: 12, fontWeight: "700" },
  desc: { color: "#CBD5E1", fontSize: 14, lineHeight: 20, marginTop: spacing.sm },
  actionRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandPrimary, paddingHorizontal: 14, paddingVertical: 9, borderRadius: radius.md },
  smallBtnT: { color: "#fff", fontWeight: "700", fontSize: 13 },
  section: { backgroundColor: ADMIN.card, borderRadius: radius.lg, padding: spacing.md, marginBottom: spacing.md, borderWidth: 1, borderColor: ADMIN.border },
  sectionTitle: { color: colors.white, fontSize: 15, fontWeight: "800", marginBottom: spacing.sm },
  rsvpRow: { flexDirection: "row", gap: 8 },
  rsvpBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: ADMIN.border, backgroundColor: ADMIN.surface },
  rsvpT: { color: colors.white, fontSize: 12, fontWeight: "700" },
  pRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ADMIN.border },
  pName: { color: colors.white, fontSize: 14 },
  muted: { color: ADMIN.muted, fontSize: 12 },
  progressBg: { height: 8, backgroundColor: ADMIN.surface, borderRadius: 4, overflow: "hidden", marginBottom: spacing.sm },
  progressFill: { height: 8, backgroundColor: "#22C55E" },
  taskRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ADMIN.border },
  taskT: { color: colors.white, fontSize: 14 },
  taskDone: { textDecorationLine: "line-through", color: ADMIN.muted },
  taskMeta: { color: ADMIN.muted, fontSize: 11, marginTop: 2 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: spacing.sm },
  addInput: { flex: 1, backgroundColor: ADMIN.surface, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10, color: colors.white, fontSize: 14, borderWidth: 1, borderColor: ADMIN.border },
  addBtn: { width: 42, height: 42, borderRadius: radius.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  attRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: ADMIN.border },
  thumb: { width: 34, height: 34, borderRadius: 6 },
  attName: { color: colors.brandSecondary, fontSize: 13, textDecorationLine: "underline" },
  attBtns: { flexDirection: "row", gap: 8, marginTop: spacing.sm },
  attBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.brandPrimary, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.md },
  attBtnT: { color: "#fff", fontWeight: "700", fontSize: 12 },
  cRow: { flexDirection: "row", gap: 10, paddingVertical: 8, alignItems: "flex-start" },
  cAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  cInit: { color: "#fff", fontWeight: "800" },
  cName: { color: colors.brandSecondary, fontSize: 12, fontWeight: "800", marginBottom: 2 },
  chat: { gap: 2, marginBottom: spacing.md },
  chatEmpty: { color: ADMIN.muted, fontSize: 13, textAlign: "center", paddingVertical: spacing.lg, fontStyle: "italic" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8, maxWidth: "100%" },
  msgRowOwn: { justifyContent: "flex-end", flexDirection: "row-reverse" },
  bubble: { maxWidth: "78%", paddingHorizontal: 12, paddingVertical: 9, borderRadius: 16 },
  bubbleOther: { backgroundColor: "rgba(255,255,255,0.08)", borderBottomLeftRadius: 4 },
  bubbleOwn: { backgroundColor: colors.brandPrimary, borderBottomRightRadius: 4 },
  msgText: { color: "#E2E8F0", fontSize: 14.5, lineHeight: 20 },
  msgTime: { color: ADMIN.muted, fontSize: 10, marginTop: 4, alignSelf: "flex-end" },
  mentionRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: spacing.sm },
  mentionLbl: { color: ADMIN.muted, fontWeight: "800" },
  mentionChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.pill, backgroundColor: ADMIN.surface, borderWidth: 1, borderColor: ADMIN.border },
  mentionOn: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  mentionT: { color: ADMIN.muted, fontSize: 12, fontWeight: "600" },
});
