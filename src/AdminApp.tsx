import { useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { loadArchive, loadCurrentModerator, loadInternalEpisodes, saveDraft as persistDraft } from "./radio-data";
import type { ArchiveData, Draft, Episode, Guest, InternalEpisode, Language } from "./radio-data";
import { moderatorEmail, supabase } from "./supabase";

type Baseline = ArchiveData;
type Moderator = { display_name: string; email: string; role: string; active: boolean };

const logos: Record<string, string> = {
  "garasho-wadaag": "logos/garasho-wadaag.png",
  hiloow: "logos/hiloow.png",
};

const copy = {
  so: {
    editor: "Maamulka kaydka", internal: "Goobta shaqada ee gudaha", back: "Eeg kaydka", all: "Dhammaan", missing: "Wax ka dhiman", complete: "Dhammaystiran",
    episodes: "Qaybaha", needsWork: "U baahan xog", titleGaps: "Cinwaanno maqan", guestGaps: "Xogta martida oo maqan", saved: "Kaydsan", saving: "Waa la kaydinayaa…", save: "Kaydi isbeddellada", savedBy: "Waxaa kaydiyey", search: "Raadi qayb, cinwaan ama marti", noEpisodes: "Qaybo lama helin.", episode: "Taxanaha", overview: "Xogta qaybta", programme: "Barnaamij", number: "Lambarka", date: "Taariikhda baahinta", station: "Idaacad", status: "Xaaladda daabacaadda", ready: "Diyaar", incomplete: "Aan dhammaystirnayn", somaliTitle: "Cinwaanka Soomaaliga", englishTitle: "Cinwaanka Ingiriisiga", media: "Warbaahinta", cover: "Sawirka qaybta", audio: "Codka", video: "Fiidiyowga", urlOptional: "Xiriiriye, haddii uu jiro", drama: "Riwaayadda", dramaType: "Nooca riwaayadda", newDrama: "Cusub", repeatedDrama: "Soo noqotay", episodeNumber: "Taxanaha #", internalHelp: "Dooro ama qor lambarka qaybtii riwaayaddu markii hore ka baxday. Gudaha oo keliya.", synopsisSo: "Dulucda riwaayadda, Soomaali", synopsisEn: "Dulucda riwaayadda, Ingiriisi", guests: "Martida", addGuest: "Ku dar marti", addEpisode: "Ku dar qayb", newEpisode: "Qayb cusub", remove: "Ka saar", guestName: "Magaca", roleSo: "Doorka, Soomaali", roleEn: "Doorka, Ingiriisi", gender: "Jinsi", man: "Nin", woman: "Haweeney", unknown: "Lama hubo", youth: "Dhallinyaro", yes: "Haa", no: "Maya", crossSection: "Qaybta bulshada", civilSociety: "Bulshada rayidka", governmentAdmin: "Dowladda / maamulka", elder: "Oday", religiousLeader: "Hoggaamiye diimeed", ipn: "Xubin IPN", notIpn: "Maya", participation: "Ka qaybgal", live: "Toos", recorded: "La duubay", export: "Soo dejiso xogta dadweynaha", exportHelp: "Waxay ka saartaa tixraaca riwaayadda ee gudaha.", selectEpisode: "Ka dooro qayb liisaska kore ama liiska bidix si aad u bilowdo.", allComplete: "Dhammaan waa dhammaystiran yihiin.", chooseProgramme: "Dooro barnaamij", episodeRequired: "Dooro barnaamij oo geli lambarka qaybta.", episodeExists: "Lambarkan qaybta mar hore ayuu uga jiraa barnaamijkan.", unsaved: "Waxaad leedahay isbeddello aan la kaydin. Ma sii socotaa?", saveFailed: "Kaydintu way fashilantay. Mar kale isku day.", loadFailed: "Xogta maamulka lama furi karin.", loading: "Xogta waa la furayaa…", fieldsMissing: "meelood ayaa ka maqan",
  },
  en: {
    editor: "Archive editor", internal: "Private team workspace", back: "View archive", all: "All", missing: "Needs work", complete: "Complete",
    episodes: "Episodes", needsWork: "Need information", titleGaps: "Missing titles", guestGaps: "Missing guest info", saved: "Saved", saving: "Saving…", save: "Save changes", savedBy: "Last saved by", search: "Search episode, title or guest", noEpisodes: "No episodes found.", episode: "Episode", overview: "Episode details", programme: "Programme", number: "Number", date: "Broadcast date", station: "Station", status: "Publication status", ready: "Ready", incomplete: "Incomplete", somaliTitle: "Somali title", englishTitle: "English title", media: "Media", cover: "Episode cover", audio: "Audio", video: "Video", urlOptional: "Link, if available", drama: "Drama", dramaType: "Drama type", newDrama: "New", repeatedDrama: "Repeated", episodeNumber: "Episode #", internalHelp: "Select or type the episode number where this drama first appeared. Internal only.", synopsisSo: "Drama synopsis, Somali", synopsisEn: "Drama synopsis, English", guests: "Guests", addGuest: "Add guest", addEpisode: "Add episode", newEpisode: "New episode", remove: "Remove", guestName: "Name", roleSo: "Role, Somali", roleEn: "Role, English", gender: "Gender", man: "Man", woman: "Woman", unknown: "Unknown", youth: "Youth", yes: "Yes", no: "No", crossSection: "Cross-section", civilSociety: "Civil society", governmentAdmin: "Government / administration", elder: "Elder", religiousLeader: "Religious leader", ipn: "IPN membership", notIpn: "No", participation: "Participation", live: "Live", recorded: "Recorded", export: "Download public data", exportHelp: "The internal repeat reference is removed.", selectEpisode: "Choose an episode from the attention lists or the episode browser.", allComplete: "Everything is complete.", chooseProgramme: "Choose programme", episodeRequired: "Choose a programme and enter an episode number.", episodeExists: "That episode number already exists in this programme.", unsaved: "You have unsaved changes. Continue?", saveFailed: "Saving failed. Please try again.", loadFailed: "The admin data could not be opened.", loading: "Loading the workspace…", fieldsMissing: "fields missing",
  },
} as const;

function missing(value: string | null | undefined) {
  return !value || value.trim() === "?";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function draftFor(episode: Episode, data: Baseline, internalByEpisode: Map<string, InternalEpisode>): Draft {
  const internal = internalByEpisode.get(episode.id);
  const sourceEpisodeId = internal?.repeat_source_episode_id || episode.drama.source_episode_id;
  const drama = data.dramas.find((item) => item.id === episode.drama.id) || {
    id: episode.drama.id,
    programme_id: episode.programme_id,
    source_episode_id: episode.drama.source_episode_id,
    title: { so: "?", en: "?" },
    synopsis: { so: "?", en: "?" },
    data_status: "incomplete" as const,
    missing_fields: ["synopsis.so", "synopsis.en"],
  };
  return {
    episode: { ...clone(episode), drama: { ...clone(episode.drama), source_episode_id: sourceEpisodeId || null } },
    drama: clone(drama),
    guests: clone(data.guests.filter((guest) => guest.episode_id === episode.id)),
    repeat_drama_internal: episode.drama.relation === "repeated" && sourceEpisodeId
      ? String(data.episodes.find((item) => item.id === sourceEpisodeId)?.episode_number || internal?.repeat_drama_raw || "")
      : "",
  };
}

function gaps(draft: Draft) {
  const result: string[] = [];
  if (missing(draft.episode.title.so)) result.push("title.so");
  if (missing(draft.episode.title.en)) result.push("title.en");
  if (missing(draft.episode.broadcast_date)) result.push("broadcast_date");
  if (!draft.episode.station_id) result.push("station");
  if (draft.episode.drama.relation === "unresolved") result.push("drama.reference");
  if (draft.episode.drama.relation === "repeated" && !draft.episode.drama.source_episode_id) result.push("drama.source");
  draft.guests.forEach((guest, index) => {
    if (missing(guest.guest_name)) result.push(`guest.${index}.name`);
    if (missing(guest.role.so)) result.push(`guest.${index}.role.so`);
    if (missing(guest.role.en)) result.push(`guest.${index}.role.en`);
  });
  return result;
}

function titleNeedsAttention(draft: Draft) {
  return missing(draft.episode.title.so) || missing(draft.episode.title.en);
}

function guestNeedsAttention(draft: Draft) {
  return draft.guests.length === 0 || draft.guests.some((guest) =>
    missing(guest.guest_name) || missing(guest.role.so) || missing(guest.role.en) ||
    guest.gender === "unknown" || guest.is_youth === null || !guest.cross_section
  );
}

function displayTitle(draft: Draft, language: Language) {
  const preferred = draft.episode.title[language];
  const fallback = draft.episode.title[language === "so" ? "en" : "so"];
  return !missing(preferred) ? preferred : !missing(fallback) ? fallback : `#${draft.episode.episode_number}`;
}

function episodeLabel(number: number, language: Language) {
  return language === "so" ? `Taxanaha ${number}-aad` : `Episode ${number}`;
}

export default function AdminApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [moderator, setModerator] = useState<Moderator | null>(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setChecking(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession) setModerator(null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) return;
    loadCurrentModerator().then((profile) => {
      if (!profile.active) throw new Error("This moderator account is inactive.");
      setModerator(profile);
    }).catch(async () => {
      await supabase.auth.signOut();
      setModerator(null);
    });
  }, [session]);

  if (checking || (session && !moderator)) return <main className="admin-state"><span />Loading the workspace…</main>;
  if (!session || !moderator) return <LoginScreen />;
  return <AdminWorkspace moderator={moderator} />;
}

function LoginScreen() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email: moderatorEmail(username), password });
    if (authError) setError("The username or password is incorrect.");
    setBusy(false);
  };

  return <main className="admin-login">
    <section>
      <a href="#">← View archive</a>
      <span className="admin-brand-mark"><i /><i /><i /></span>
      <p>Private team workspace</p>
      <h1>Archive editor</h1>
      <form onSubmit={signIn}>
        <label><span>Username</span><input autoComplete="username" autoCapitalize="none" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
        <label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
        {error && <p className="login-error">{error}</p>}
        <button disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
      </form>
    </section>
  </main>;
}

function AdminWorkspace({ moderator }: { moderator: Moderator }) {
  const [language, setLanguage] = useState<Language>("so");
  const [baseline, setBaseline] = useState<Baseline | null>(null);
  const [internalEpisodes, setInternalEpisodes] = useState<InternalEpisode[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [programmeFilter, setProgrammeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("missing");
  const [query, setQuery] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const t = copy[language];

  useEffect(() => {
    Promise.all([loadArchive(), loadInternalEpisodes()]).then(([archive, internal]) => {
      setBaseline(archive);
      setInternalEpisodes(internal);
    }).catch(() => setLoadError(true));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        document.getElementById("save-episode")?.click();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const effectiveEpisodes = useMemo(() => baseline?.episodes || [] as Episode[], [baseline]);

  const internalByEpisode = useMemo(() => new Map(internalEpisodes.map((item) => [item.episode_id, item])), [internalEpisodes]);

  const allDrafts = useMemo(() => {
    if (!baseline) return new Map<string, Draft>();
    return new Map(effectiveEpisodes.map((episode) => [episode.id, draftFor(episode, baseline, internalByEpisode)]));
  }, [baseline, effectiveEpisodes, internalByEpisode]);

  if (loadError) return <main className="admin-state">{t.loadFailed}</main>;
  if (!baseline) return <main className="admin-state"><span />{t.loading}</main>;

  const programmeMap = new Map(baseline.programmes.map((item) => [item.id, item]));
  const guestNames = Array.from(new Set(baseline.guests.map((guest) => guest.guest_name).filter((name) => !missing(name)))).sort();
  const attentionSort = (a: Draft, b: Draft) => b.episode.broadcast_date.localeCompare(a.episode.broadcast_date) || b.episode.episode_number - a.episode.episode_number;
  const titleAttention = [...allDrafts.values()].filter(titleNeedsAttention).sort(attentionSort);
  const guestAttention = [...allDrafts.values()].filter(guestNeedsAttention).sort(attentionSort);
  const loweredQuery = query.trim().toLocaleLowerCase();
  const filteredEpisodes = effectiveEpisodes.filter((episode) => {
    const item = allDrafts.get(episode.id)!;
    const hasGaps = gaps(item).length > 0;
    if (programmeFilter !== "all" && episode.programme_id !== programmeFilter) return false;
    if (statusFilter === "missing" && !hasGaps) return false;
    if (statusFilter === "complete" && hasGaps) return false;
    if (!loweredQuery) return true;
    return `${episode.episode_number} ${item.episode.title.so} ${item.episode.title.en} ${item.guests.map((guest) => guest.guest_name).join(" ")}`.toLocaleLowerCase().includes(loweredQuery);
  }).sort((a, b) => {
    const gapDelta = gaps(allDrafts.get(b.id)!).length - gaps(allDrafts.get(a.id)!).length;
    return gapDelta || b.broadcast_date.localeCompare(a.broadcast_date) || b.episode_number - a.episode_number;
  });

  const selectEpisode = (id: string) => {
    if (dirty && !window.confirm(t.unsaved)) return;
    const episode = effectiveEpisodes.find((item) => item.id === id)!;
    setSelectedId(id);
    setDraft(clone(draftFor(episode, baseline, internalByEpisode)));
    setLastSavedAt(null);
    setDirty(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const addEpisode = () => {
    if (dirty && !window.confirm(t.unsaved)) return;
    const id = `new-${Date.now()}`;
    setSelectedId(id);
    setDraft({
      episode: {
        id,
        programme_id: "",
        episode_number: 0,
        title: { so: "", en: "" },
        broadcast_date: "",
        station_id: null,
        publication_status: "incomplete",
        availability: { image: false, audio: false, video: false },
        media: { cover_image_url: null, audio_url: null, video_url: null },
        drama: { id: `${id}-drama`, relation: "unresolved", source_episode_id: null },
        missing_fields: [],
      },
      drama: { id: `${id}-drama`, programme_id: "", source_episode_id: null, title: { so: "", en: "" }, synopsis: { so: "", en: "" }, data_status: "incomplete", missing_fields: [] },
      guests: [],
      repeat_drama_internal: "",
    });
    setDirty(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const updateDraft = (updater: (current: Draft) => Draft) => {
    setDraft((current) => current ? updater(clone(current)) : current);
    setDirty(true);
  };

  const saveDraft = async () => {
    if (!draft || saving) return;
    setSaving(true);
    const next = clone(draft);
    const adding = next.episode.id.startsWith("new-");
    if (!next.episode.programme_id || next.episode.episode_number < 1) {
      window.alert(t.episodeRequired);
      setSaving(false);
      return;
    }
    const canonicalId = `${next.episode.programme_id}-${String(next.episode.episode_number).padStart(3, "0")}`;
    if (adding && allDrafts.has(canonicalId)) {
      window.alert(t.episodeExists);
      setSaving(false);
      return;
    }
    if (adding) {
      const temporaryId = next.episode.id;
      next.episode.id = canonicalId;
      next.guests = next.guests.map((guest, index) => ({ ...guest, id: `${canonicalId}-g-${index + 1}`, episode_id: canonicalId }));
      if (next.episode.drama.source_episode_id === temporaryId || next.episode.drama.relation === "new") {
        next.episode.drama.source_episode_id = canonicalId;
      }
      if (next.episode.drama.id === `${temporaryId}-drama` || next.episode.drama.relation === "new") {
        next.episode.drama.id = `${next.episode.programme_id}-drama-${String(next.episode.episode_number).padStart(3, "0")}`;
        next.drama.id = next.episode.drama.id;
      }
      next.drama.programme_id = next.episode.programme_id;
      next.drama.source_episode_id = next.episode.drama.source_episode_id;
    }
    const missingFields = gaps(next);
    next.episode.missing_fields = missingFields;
    next.episode.publication_status = missingFields.length ? "incomplete" : next.episode.publication_status;
    const sourceDraft = next.episode.drama.source_episode_id ? allDrafts.get(next.episode.drama.source_episode_id) : undefined;
    next.drama.title = clone(next.episode.drama.source_episode_id === next.episode.id ? next.episode.title : sourceDraft?.episode.title || next.episode.title);
    next.drama.missing_fields = [missing(next.drama.synopsis.so) ? "synopsis.so" : "", missing(next.drama.synopsis.en) ? "synopsis.en" : ""].filter(Boolean);
    next.drama.data_status = next.drama.missing_fields.length ? "incomplete" : "ready";
    next.guests = next.guests.map((guest) => {
      const guestMissing = [missing(guest.guest_name) ? "guest_name" : "", missing(guest.role.so) ? "role.so" : "", missing(guest.role.en) ? "role.en" : ""].filter(Boolean);
      return { ...guest, data_status: guestMissing.length ? "incomplete" : "ready", missing_fields: guestMissing };
    });
    try {
      await persistDraft(next);
      const [archive, internal] = await Promise.all([loadArchive(), loadInternalEpisodes()]);
      setBaseline(archive);
      setInternalEpisodes(internal);
      setSelectedId(next.episode.id);
      const refreshed = archive.episodes.find((episode) => episode.id === next.episode.id);
      const refreshedInternal = new Map(internal.map((item) => [item.episode_id, item]));
      setDraft(refreshed ? draftFor(refreshed, archive, refreshedInternal) : next);
      setLastSavedAt(new Date().toISOString());
      setDirty(false);
    } catch (error) {
      window.alert(`${t.saveFailed}\n${error instanceof Error ? error.message : ""}`);
    } finally {
      setSaving(false);
    }
  };

  const currentProgramme = draft ? programmeMap.get(draft.episode.programme_id) : undefined;
  const stationOptions = currentProgramme ? baseline.stations.filter((station) => currentProgramme.station_ids.includes(station.id)) : [];
  const sourceEpisodes = draft ? effectiveEpisodes.filter((episode) => episode.programme_id === draft.episode.programme_id && episode.id !== draft.episode.id).sort((a, b) => a.episode_number - b.episode_number) : [];

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand"><span className="admin-brand-mark"><i /><i /><i /></span><div><strong>{t.editor}</strong><small>{t.internal}</small></div></div>
        <div className="admin-actions"><a href="#">← {t.back}</a><span className="moderator-name">{moderator.display_name}</span><button className="sign-out" onClick={() => supabase.auth.signOut()}>Sign out</button><div className="admin-language"><button className={language === "so" ? "active" : ""} onClick={() => setLanguage("so")}>SO</button><button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button></div></div>
      </header>

      <main className="admin-main">
        <section className="admin-intro">
          <div><p>{t.internal}</p><h1>{t.editor}</h1></div>
          <div className="intro-actions">
            <button className="add-episode-button" onClick={addEpisode}><span>＋</span>{t.addEpisode}</button>
          </div>
        </section>

        <section className="attention-dashboard">
          {([{ title: t.titleGaps, items: titleAttention }, { title: t.guestGaps, items: guestAttention }] as const).map((group) => <article className="attention-card" key={group.title}>
            <header><div><span>{t.needsWork}</span><h2>{group.title}</h2></div><strong>{group.items.length}</strong></header>
            <div className="attention-list">
              {group.items.map((item) => {
                const programme = programmeMap.get(item.episode.programme_id);
                return <button onClick={() => selectEpisode(item.episode.id)} key={item.episode.id}><img src={logos[item.episode.programme_id]} alt="" /><span><small>{programme?.name[language]} · {episodeLabel(item.episode.episode_number, language)}</small><b>{displayTitle(item, language)}</b></span><i>→</i></button>;
              })}
              {!group.items.length && <p>{t.allComplete}</p>}
            </div>
          </article>)}
        </section>

        <section className="admin-workspace">
          <aside className="episode-browser">
            <div className="programme-tabs"><button className={programmeFilter === "all" ? "active" : ""} onClick={() => setProgrammeFilter("all")}>{t.all}</button>{baseline.programmes.map((programme) => <button className={programmeFilter === programme.id ? "active" : ""} onClick={() => setProgrammeFilter(programme.id)} key={programme.id}><img src={logos[programme.id]} alt="" />{programme.name[language]}</button>)}</div>
            <label className="admin-search"><span>⌕</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} /></label>
            <div className="status-tabs"><button className={statusFilter === "missing" ? "active" : ""} onClick={() => setStatusFilter("missing")}>{t.missing}</button><button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>{t.all}</button><button className={statusFilter === "complete" ? "active" : ""} onClick={() => setStatusFilter("complete")}>{t.complete}</button></div>
            <div className="episode-list">
              {filteredEpisodes.map((episode) => {
                const item = allDrafts.get(episode.id)!;
                const itemGaps = gaps(item);
                const programme = programmeMap.get(episode.programme_id)!;
                return <button className={`${selectedId === episode.id ? "active" : ""} ${itemGaps.length ? "incomplete" : "complete"}`} onClick={() => selectEpisode(episode.id)} key={episode.id}><img src={logos[episode.programme_id]} alt="" /><span><small>{programme.name[language]} · {episodeLabel(episode.episode_number, language)}</small><strong>{displayTitle(item, language)}</strong><em>{itemGaps.length ? `${itemGaps.length} ${t.fieldsMissing}` : t.complete}</em></span><i>{itemGaps.length || "✓"}</i></button>;
              })}
              {!filteredEpisodes.length && <p className="browser-empty">{t.noEpisodes}</p>}
            </div>
          </aside>

          <section className="episode-editor">
            {!draft ? <div className="editor-empty">{t.selectEpisode}</div> : <>
              <div className={`editor-banner ${draft.episode.programme_id || "new"}`}><div>{draft.episode.programme_id && <img src={logos[draft.episode.programme_id]} alt="" />}<span><small>{programmeMap.get(draft.episode.programme_id)?.name[language] || t.newEpisode}</small><strong>{draft.episode.episode_number ? episodeLabel(draft.episode.episode_number, language) : t.newEpisode}</strong></span></div><span className={gaps(draft).length ? "gap-count" : "gap-count complete"}>{gaps(draft).length ? `${gaps(draft).length} ${t.fieldsMissing}` : t.complete}</span></div>

              <EditorSection title={t.overview} number="01">
                <div className="form-grid four">
                  <Field label={t.programme} missing={!draft.episode.programme_id}><select value={draft.episode.programme_id} onChange={(event) => updateDraft((current) => { current.episode.programme_id = event.target.value; current.episode.station_id = null; current.drama.programme_id = event.target.value; return current; })}><option value="">{t.chooseProgramme}</option>{baseline.programmes.map((programme) => <option value={programme.id} key={programme.id}>{programme.name[language]}</option>)}</select></Field>
                  <Field label={t.number} missing={!draft.episode.episode_number}><input type="number" min="1" value={draft.episode.episode_number || ""} onChange={(event) => updateDraft((current) => { current.episode.episode_number = Number(event.target.value); return current; })} /></Field>
                  <Field label={t.date} missing={missing(draft.episode.broadcast_date)}><input type="date" value={draft.episode.broadcast_date === "?" ? "" : draft.episode.broadcast_date} onChange={(event) => updateDraft((current) => { current.episode.broadcast_date = event.target.value; return current; })} /></Field>
                  <Field label={t.station} missing={!draft.episode.station_id}><select value={draft.episode.station_id || ""} onChange={(event) => updateDraft((current) => { current.episode.station_id = event.target.value || null; return current; })}><option value="">?</option>{stationOptions.map((station) => <option value={station.id} key={station.id}>{station.name[language]}</option>)}</select></Field>
                </div>
                <div className="form-grid two">
                  <Field label={t.somaliTitle} missing={missing(draft.episode.title.so)}><input value={draft.episode.title.so === "?" ? "" : draft.episode.title.so} onChange={(event) => updateDraft((current) => { current.episode.title.so = event.target.value; return current; })} /></Field>
                  <Field label={t.englishTitle} missing={missing(draft.episode.title.en)}><input value={draft.episode.title.en === "?" ? "" : draft.episode.title.en} onChange={(event) => updateDraft((current) => { current.episode.title.en = event.target.value; return current; })} /></Field>
                </div>
                <Field label={t.status}><div className="segmented"><button className={draft.episode.publication_status === "incomplete" ? "active" : ""} onClick={() => updateDraft((current) => { current.episode.publication_status = "incomplete"; return current; })}>{t.incomplete}</button><button className={draft.episode.publication_status === "ready" ? "active" : ""} onClick={() => updateDraft((current) => { current.episode.publication_status = "ready"; return current; })}>{t.ready}</button></div></Field>
              </EditorSection>

              <EditorSection title={t.drama} number="02" tone="dark">
                <div className={`admin-field ${draft.episode.drama.relation === "unresolved" ? "missing" : ""}`}><span>{t.dramaType}{draft.episode.drama.relation === "unresolved" && <i>!</i>}</span><div className="radio-choice">{(["new", "repeated"] as const).map((relation) => <label key={relation}><input type="radio" name="drama-relation" value={relation} checked={draft.episode.drama.relation === relation} onChange={() => updateDraft((current) => { current.episode.drama.relation = relation; if (relation === "new") { current.repeat_drama_internal = ""; current.episode.drama.source_episode_id = current.episode.id; current.episode.drama.id = `${current.episode.programme_id}-drama-${String(current.episode.episode_number).padStart(3, "0")}`; current.drama.id = current.episode.drama.id; current.drama.source_episode_id = current.episode.id; current.drama.title = clone(current.episode.title); } else { current.episode.drama.source_episode_id = null; } return current; })} /><span>{relation === "new" ? t.newDrama : t.repeatedDrama}</span></label>)}</div></div>
                {draft.episode.drama.relation === "repeated" && <Field label={t.episodeNumber} missing={!draft.episode.drama.source_episode_id}><input className="internal-input" list={`source-episodes-${draft.episode.programme_id}`} inputMode="numeric" value={draft.repeat_drama_internal} onChange={(event) => updateDraft((current) => { const typed = event.target.value; const episodeNumber = typed.trim().match(/^#?(\d+)/)?.[1]; const source = sourceEpisodes.find((item) => String(item.episode_number) === episodeNumber); current.repeat_drama_internal = typed; current.episode.drama.source_episode_id = source?.id || null; if (source) { current.episode.drama.id = source.drama.id; const sourceDraft = allDrafts.get(source.id); if (sourceDraft) current.drama = clone(sourceDraft.drama); current.drama.title = clone(source.title); } return current; })} placeholder="#" /><small className="field-help">🔒 {t.internalHelp}</small><datalist id={`source-episodes-${draft.episode.programme_id}`}>{sourceEpisodes.map((episode) => <option value={`${episode.episode_number}. ${displayTitle(allDrafts.get(episode.id)!, language)}`} key={episode.id} />)}</datalist></Field>}
                <div className="form-grid two"><Field label={t.synopsisSo} missing={missing(draft.drama.synopsis.so)}><textarea rows={5} value={draft.drama.synopsis.so === "?" ? "" : draft.drama.synopsis.so} onChange={(event) => updateDraft((current) => { current.drama.synopsis.so = event.target.value; return current; })} /></Field><Field label={t.synopsisEn} missing={missing(draft.drama.synopsis.en)}><textarea rows={5} value={draft.drama.synopsis.en === "?" ? "" : draft.drama.synopsis.en} onChange={(event) => updateDraft((current) => { current.drama.synopsis.en = event.target.value; return current; })} /></Field></div>
              </EditorSection>

              <EditorSection title={t.guests} number="03">
                <div className="guest-editor-list">{draft.guests.map((guest, index) => <article className="guest-editor-card" key={guest.id}><div className="guest-card-head"><span>{String(index + 1).padStart(2, "0")}</span><button onClick={() => updateDraft((current) => { current.guests.splice(index, 1); return current; })}>{t.remove}</button></div><div className="form-grid two"><Field label={t.guestName} missing={missing(guest.guest_name)}><input list="guest-names" value={guest.guest_name === "?" ? "" : guest.guest_name} onChange={(event) => updateDraft((current) => { current.guests[index].guest_name = event.target.value; return current; })} /></Field><Field label={t.participation}><select value={guest.participation_mode} onChange={(event) => updateDraft((current) => { current.guests[index].participation_mode = event.target.value as Guest["participation_mode"]; return current; })}><option value="unknown">{t.unknown}</option><option value="live">{t.live}</option><option value="recorded">{t.recorded}</option></select></Field></div><div className="form-grid two"><Field label={t.roleSo} missing={missing(guest.role.so)}><input value={guest.role.so === "?" ? "" : guest.role.so} onChange={(event) => updateDraft((current) => { current.guests[index].role.so = event.target.value; return current; })} /></Field><Field label={t.roleEn} missing={missing(guest.role.en)}><input value={guest.role.en === "?" ? "" : guest.role.en} onChange={(event) => updateDraft((current) => { current.guests[index].role.en = event.target.value; return current; })} /></Field></div><div className="form-grid four"><Field label={t.gender}><select value={guest.gender} onChange={(event) => updateDraft((current) => { current.guests[index].gender = event.target.value as Guest["gender"]; return current; })}><option value="man">{t.man}</option><option value="woman">{t.woman}</option><option value="unknown">{t.unknown}</option></select></Field><Field label={t.youth}><select value={guest.is_youth === null ? "" : String(guest.is_youth)} onChange={(event) => updateDraft((current) => { current.guests[index].is_youth = event.target.value === "" ? null : event.target.value === "true"; return current; })}><option value="">{t.unknown}</option><option value="true">{t.yes}</option><option value="false">{t.no}</option></select></Field><Field label={t.crossSection}><select value={guest.cross_section || ""} onChange={(event) => updateDraft((current) => { current.guests[index].cross_section = event.target.value || null; return current; })}><option value="">{t.unknown}</option><option value="civil-society">{t.civilSociety}</option><option value="government-administration">{t.governmentAdmin}</option><option value="elder">{t.elder}</option><option value="religious-leader">{t.religiousLeader}</option></select></Field><Field label={t.ipn}><select value={guest.ipn_region || ""} onChange={(event) => updateDraft((current) => { current.guests[index].ipn_region = event.target.value || null; return current; })}><option value="">{t.notIpn}</option>{baseline.states.map((state) => <option value={state.id} key={state.id}>{state.name[language]}</option>)}</select></Field></div></article>)}</div>
                <button className="add-guest" onClick={() => updateDraft((current) => { current.guests.push({ id: `${current.episode.id}-g-${Date.now()}`, episode_id: current.episode.id, guest_name: "", role: { so: "", en: "" }, gender: "man", is_youth: null, cross_section: null, ipn_region: null, participation_mode: "live", data_status: "incomplete", missing_fields: ["guest_name", "role.so", "role.en"] }); return current; })}>＋ {t.addGuest}</button>
              </EditorSection>

              <EditorSection title={t.media} number="04">
                <div className="media-grid">{(["image", "audio", "video"] as const).map((kind) => { const label = kind === "image" ? t.cover : kind === "audio" ? t.audio : t.video; const urlKey = kind === "image" ? "cover_image_url" : `${kind}_url` as "audio_url" | "video_url"; return <article key={kind}><div><span>{label.slice(0, 1)}</span><strong>{label}</strong><label className="switch"><input type="checkbox" checked={draft.episode.availability[kind]} onChange={(event) => updateDraft((current) => { current.episode.availability[kind] = event.target.checked; return current; })} /><i /></label></div><input type="url" value={draft.episode.media[urlKey] || ""} onChange={(event) => updateDraft((current) => { current.episode.media[urlKey] = event.target.value || null; return current; })} placeholder={t.urlOptional} /></article>; })}</div>
              </EditorSection>

              <div className="save-bar"><div>{lastSavedAt ? <><span>✓ {t.saved}</span><small>{t.savedBy} {moderator.display_name} · {new Date(lastSavedAt).toLocaleString(language === "so" ? "so-SO" : "en-GB")}</small></> : <small>{t.internal}</small>}</div><button id="save-episode" disabled={!dirty || saving} onClick={saveDraft}>{saving ? t.saving : dirty ? t.save : `✓ ${t.saved}`}</button></div>
            </>}
          </section>
        </section>
      </main>
      <datalist id="guest-names">{guestNames.map((name) => <option value={name} key={name} />)}</datalist>
    </div>
  );
}

function EditorSection({ title, number, tone, children }: { title: string; number: string; tone?: string; children: React.ReactNode }) {
  return <section className={`editor-section ${tone || ""}`}><header><span>{number}</span><h2>{title}</h2></header><div className="editor-section-body">{children}</div></section>;
}

function Field({ label, missing: isMissing, children }: { label: string; missing?: boolean; children: React.ReactNode }) {
  return <label className={`admin-field ${isMissing ? "missing" : ""}`}><span>{label}{isMissing && <i>!</i>}</span>{children}</label>;
}
