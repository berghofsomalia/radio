"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useState } from "react";
import { loadArchive as loadArchiveFromSupabase } from "./radio-data";

type Language = "so" | "en";
type Localised = { so: string; en: string };
type Programme = {
  id: string;
  name: Localised;
  state_id: string;
  description: Localised;
  spreaker_url: string;
  station_ids: string[];
};
type Station = { id: string; name: Localised; state_id: string };
type StateRecord = { id: string; name: Localised };
type Episode = {
  id: string;
  programme_id: string;
  episode_number: number;
  title: Localised;
  broadcast_date: string;
  station_id: string | null;
  publication_status: "ready" | "incomplete";
  availability: { image: boolean; audio: boolean; video: boolean };
  media: { cover_image_url: string | null; audio_url: string | null; video_url: string | null };
  drama: {
    id: string;
    relation: "new" | "repeated" | "unresolved";
    source_episode_id: string | null;
  };
  missing_fields: string[];
};
type Guest = {
  id: string;
  episode_id: string;
  guest_name: string;
  role: Localised;
  gender: "woman" | "man" | "unknown";
  is_youth: boolean | null;
  cross_section: string | null;
  ipn_region: string | null;
};
type Drama = {
  id: string;
  programme_id: string;
  source_episode_id: string | null;
  title: Localised;
  synopsis: Localised;
  data_status: "ready" | "incomplete";
};
type Dictionary = Record<string, string>;
type ArchiveData = {
  programmes: Programme[];
  stations: Station[];
  states: StateRecord[];
  episodes: Episode[];
  guests: Guest[];
  dramas: Drama[];
  dictionaries: Record<Language, Dictionary>;
};
type Route = { programme: string | null; episode: string | null };

const programmeLogos: Record<string, string> = {
  "garasho-wadaag": "logos/garasho-wadaag.png",
  hiloow: "logos/hiloow.png",
};

function currentRoute(): Route {
  const params = new URLSearchParams(window.location.search);
  return { programme: params.get("programme"), episode: params.get("episode") };
}

function value(field: Localised | undefined, language: Language) {
  if (!field) return "?";
  return field[language] || field[language === "so" ? "en" : "so"] || "?";
}

function formatDate(raw: string, language: Language) {
  if (!raw || raw === "?") return "?";
  const parsed = new Date(`${raw}T12:00:00Z`);
  if (language === "so") {
    const months = ["Jannaayo", "Febraayo", "Maarso", "Abriil", "Maajo", "Juun", "Luulyo", "Agoosto", "Sebteembar", "Oktoobar", "Nofeembar", "Diseembar"];
    return `${parsed.getUTCDate()} ${months[parsed.getUTCMonth()]} ${parsed.getUTCFullYear()}`;
  }
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

function interpolate(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, replacement]) => text.replace(`{${key}}`, String(replacement)),
    template,
  );
}

function episodeSort(a: Episode, b: Episode) {
  return b.broadcast_date.localeCompare(a.broadcast_date) || b.episode_number - a.episode_number;
}

export default function Home() {
  const [data, setData] = useState<ArchiveData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [language, setLanguage] = useState<Language>("so");
  const [route, setRoute] = useState<Route>({ programme: null, episode: null });
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("all");

  useEffect(() => {
    const saved = window.localStorage.getItem("radio-archive-language");
    queueMicrotask(() => {
      if (saved === "so" || saved === "en") setLanguage(saved);
      setRoute(currentRoute());
    });
    const onPopState = () => setRoute(currentRoute());
    window.addEventListener("popstate", onPopState);
    loadArchiveFromSupabase().then((archive) => setData(archive as ArchiveData)).catch(() => setLoadFailed(true));
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("radio-archive-language", language);
  }, [language]);

  const navigate = (next: Route) => {
    const url = new URL(window.location.href);
    url.search = "";
    if (next.programme) url.searchParams.set("programme", next.programme);
    if (next.episode) url.searchParams.set("episode", next.episode);
    window.history.pushState({}, "", url);
    setRoute(next);
    setSearch("");
    setYear("all");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (loadFailed) {
    return <main className="state-page">The archive data could not be loaded.</main>;
  }
  if (!data) {
    return <main className="state-page"><span className="loading-dot" /> Loading the archive…</main>;
  }

  const dictionary = data.dictionaries[language];
  const t = (key: string) => dictionary[key] || key;
  const selectedEpisode = route.episode
    ? data.episodes.find((episode) => episode.id === route.episode)
    : undefined;

  return (
    <div className="site-shell">
      <Header language={language} setLanguage={setLanguage} programmes={data.programmes} route={route} navigate={navigate} t={t} />
      {selectedEpisode ? (
        <EpisodeView episode={selectedEpisode} data={data} language={language} navigate={navigate} t={t} />
      ) : (
        <ArchiveView
          data={data}
          language={language}
          selectedProgramme={route.programme}
          search={search}
          setSearch={setSearch}
          year={year}
          setYear={setYear}
          navigate={navigate}
          t={t}
        />
      )}
      <footer><span>{t("site_name")}</span><p>{t("footer_note")}</p></footer>
    </div>
  );
}

function Header({ language, setLanguage, programmes, route, navigate, t }: {
  language: Language;
  setLanguage: (language: Language) => void;
  programmes: Programme[];
  route: Route;
  navigate: (route: Route) => void;
  t: (key: string) => string;
}) {
  return (
    <header className="site-header">
      <button className="brand" onClick={() => navigate({ programme: null, episode: null })}>
        <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
        <span><strong>{t("site_name")}</strong><small>{t("site_kicker")}</small></span>
      </button>
      <nav aria-label="Programmes">
        {programmes.map((programme) => (
          <button className={route.programme === programme.id ? "active" : ""} key={programme.id} onClick={() => navigate({ programme: programme.id, episode: null })}>
            <img src={programmeLogos[programme.id]} alt="" />
            {programme.name[language]}
          </button>
        ))}
      </nav>
      <div className="language-switch" aria-label={t("language")}>
        <button className={language === "so" ? "active" : ""} onClick={() => setLanguage("so")}>SO</button>
        <button className={language === "en" ? "active" : ""} onClick={() => setLanguage("en")}>EN</button>
      </div>
      <a className="admin-entry" href="#/admin" aria-label="Moderator sign in">↗</a>
    </header>
  );
}

function ArchiveView({ data, language, selectedProgramme, search, setSearch, year, setYear, navigate, t }: {
  data: ArchiveData;
  language: Language;
  selectedProgramme: string | null;
  search: string;
  setSearch: (value: string) => void;
  year: string;
  setYear: (value: string) => void;
  navigate: (route: Route) => void;
  t: (key: string) => string;
}) {
  const programmes = new Map(data.programmes.map((item) => [item.id, item]));
  const stations = new Map(data.stations.map((item) => [item.id, item]));
  const readyEpisodes = data.episodes.filter((episode) => episode.publication_status === "ready");
  const metricEpisodes = readyEpisodes.filter((episode) => !selectedProgramme || episode.programme_id === selectedProgramme);
  const visibleEpisodeIds = new Set(metricEpisodes.map((episode) => episode.id));
  const namedGuests = data.guests.filter((guest) => guest.guest_name !== "?" && visibleEpisodeIds.has(guest.episode_id));
  const guestsByEpisode = useMemo(() => {
    const grouped = new Map<string, Guest[]>();
    data.guests.forEach((guest) => {
      if (guest.guest_name === "?") return;
      grouped.set(guest.episode_id, [...(grouped.get(guest.episode_id) || []), guest]);
    });
    return grouped;
  }, [data.guests]);

  const programme = selectedProgramme ? programmes.get(selectedProgramme) : undefined;
  const years = Array.from(new Set(readyEpisodes.map((episode) => episode.broadcast_date.slice(0, 4))))
    .filter((item) => /^\d{4}$/.test(item))
    .sort((a, b) => b.localeCompare(a));
  const query = search.trim().toLocaleLowerCase();
  const filtered = readyEpisodes
    .filter((episode) => !selectedProgramme || episode.programme_id === selectedProgramme)
    .filter((episode) => year === "all" || episode.broadcast_date.startsWith(year))
    .filter((episode) => {
      if (!query) return true;
      const guestText = (guestsByEpisode.get(episode.id) || []).map((guest) => `${guest.guest_name} ${guest.role.so} ${guest.role.en}`).join(" ");
      return `${episode.title.so} ${episode.title.en} ${guestText}`.toLocaleLowerCase().includes(query);
    })
    .sort(episodeSort);

  const metrics: Array<[number, string]> = [
    [metricEpisodes.length, t("episodes")],
    [namedGuests.length, t("guest_voices")],
    [namedGuests.filter((guest) => guest.gender === "woman").length, t("women")],
    [namedGuests.filter((guest) => guest.is_youth).length, t("youth")],
    [namedGuests.filter((guest) => guest.cross_section === "elder").length, t("elders")],
    [namedGuests.filter((guest) => guest.cross_section === "government-administration").length, t("government")],
  ];

  return (
    <main>
      <section className={`hero ${programme ? programme.id : "combined"}`}>
        <div className="hero-copy">
          <p className="eyebrow">{programme ? programme.name[language] : t("site_kicker")}</p>
          <h1>{programme ? value(programme.description, language) : t("hero_title")}</h1>
          {!programme && <p className="hero-intro">{t("hero_intro")}</p>}
          {programme && <a className="text-link" href={programme.spreaker_url} target="_blank" rel="noreferrer">{t("listen_spreaker")} <span aria-hidden="true">↗</span></a>}
        </div>
        <div className={`hero-logos ${programme ? "single" : "pair"}`} aria-hidden="true">
          {programme ? (
            <img src={programmeLogos[programme.id]} alt="" />
          ) : (
            <><img src={programmeLogos["garasho-wadaag"]} alt="" /><img src={programmeLogos.hiloow} alt="" /></>
          )}
        </div>
      </section>

      <section className="metrics" aria-label="Archive statistics">
        {metrics.map(([number, label]) => <div key={label}><strong>{number}</strong><span>{label}</span></div>)}
      </section>

      {!selectedProgramme && (
        <section className="programme-pair">
          {data.programmes.map((item) => (
            <button className={`programme-panel ${item.id}`} key={item.id} onClick={() => navigate({ programme: item.id, episode: null })}>
              <img className="programme-panel-logo" src={programmeLogos[item.id]} alt="" />
              <span>{item.name[language]}</span><p>{value(item.description, language)}</p><strong>{t("view_programme")} →</strong>
            </button>
          ))}
        </section>
      )}

      <section className="archive-section">
        <div className="section-heading">
          <div><p className="eyebrow">{t("browse_archive")}</p><h2>{programme ? programme.name[language] : t("latest_episodes")}</h2></div>
          <p>{t("showing")} <strong>{filtered.length}</strong> {t("results")}</p>
        </div>
        <div className="filters">
          <label className="search-field"><span className="sr-only">{t("search_label")}</span><span aria-hidden="true">⌕</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("search_placeholder")} /></label>
          <select aria-label={t("all_years")} value={year} onChange={(event) => setYear(event.target.value)}>
            <option value="all">{t("all_years")}</option>{years.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </div>
        {filtered.length ? (
          <div className="episode-grid">
            {filtered.map((episode) => <EpisodeCard key={episode.id} episode={episode} programme={programmes.get(episode.programme_id)!} station={episode.station_id ? stations.get(episode.station_id) : undefined} guests={guestsByEpisode.get(episode.id) || []} language={language} navigate={navigate} t={t} />)}
          </div>
        ) : (
          <div className="empty-state"><p>{t("no_results")}</p><button onClick={() => { setSearch(""); setYear("all"); }}>{t("clear_search")}</button></div>
        )}
      </section>
    </main>
  );
}

function EpisodeCard({ episode, programme, station, guests, language, navigate, t }: {
  episode: Episode;
  programme: Programme;
  station?: Station;
  guests: Guest[];
  language: Language;
  navigate: (route: Route) => void;
  t: (key: string) => string;
}) {
  return (
    <article className="episode-card">
      <button className={`episode-cover ${programme.id}`} onClick={() => navigate({ programme: null, episode: episode.id })}>
        <img src={programmeLogos[programme.id]} alt="" />
        <span>{programme.name[language]}</span><strong>{String(episode.episode_number).padStart(2, "0")}</strong><i aria-hidden="true" /><i aria-hidden="true" />
      </button>
      <div className="episode-card-body">
        <p className="card-meta">{formatDate(episode.broadcast_date, language)} · {station ? station.name[language] : "?"}</p>
        <h3>{value(episode.title, language)}</h3>
        <div className="guest-preview">
          {guests.slice(0, 2).map((guest) => {
            const role = value(guest.role, language);
            return <div key={guest.id}><strong>{guest.guest_name}</strong>{role !== "?" && <span>{role}</span>}</div>;
          })}
          {guests.length > 2 && <small>+{guests.length - 2}</small>}
        </div>
        <button className="open-button" onClick={() => navigate({ programme: null, episode: episode.id })}>{t("open_episode")} <span aria-hidden="true">→</span></button>
      </div>
    </article>
  );
}

function EpisodeView({ episode, data, language, navigate, t }: {
  episode: Episode;
  data: ArchiveData;
  language: Language;
  navigate: (route: Route) => void;
  t: (key: string) => string;
}) {
  const programme = data.programmes.find((item) => item.id === episode.programme_id)!;
  const station = data.stations.find((item) => item.id === episode.station_id);
  const drama = data.dramas.find((item) => item.id === episode.drama.id);
  const guests = data.guests.filter((guest) => guest.episode_id === episode.id && guest.guest_name !== "?");
  const states = new Map(data.states.map((item) => [item.id, item]));
  const programmeEpisodes = data.episodes.filter((item) => item.programme_id === episode.programme_id && item.publication_status === "ready").sort((a, b) => a.episode_number - b.episode_number);
  const position = programmeEpisodes.findIndex((item) => item.id === episode.id);
  const previous = position > 0 ? programmeEpisodes[position - 1] : undefined;
  const next = position >= 0 && position < programmeEpisodes.length - 1 ? programmeEpisodes[position + 1] : undefined;
  const original = episode.drama.source_episode_id ? data.episodes.find((item) => item.id === episode.drama.source_episode_id) : undefined;
  const relationLabel = episode.drama.relation === "new" ? t("new_drama") : episode.drama.relation === "repeated" ? t("repeated_drama") : t("unresolved_drama");
  const dramaTitle = original ? value(original.title, language) : value(episode.title, language);

  return (
    <main className="episode-page">
      <button className="back-button" onClick={() => navigate({ programme: episode.programme_id, episode: null })}>← {t("back_archive")}</button>
      <section className={`episode-hero ${programme.id}`}>
        <div>
          <p className="eyebrow">{programme.name[language]} · {t("episode")} {episode.episode_number}</p>
          <h1>{value(episode.title, language)}</h1>
          <dl><div><dt>{t("broadcast_date")}</dt><dd>{formatDate(episode.broadcast_date, language)}</dd></div><div><dt>{t("station")}</dt><dd>{station ? station.name[language] : "?"}</dd></div></dl>
        </div>
        <div className="episode-identity" aria-hidden="true">
          <img src={programmeLogos[programme.id]} alt="" />
          <div className="episode-number">{String(episode.episode_number).padStart(2, "0")}</div>
        </div>
      </section>

      <section className="drama-panel">
        <div className="drama-heading">
          <div><p className="eyebrow">{t("drama")}</p><h2>{dramaTitle}</h2></div>
          <span className={`relation-chip ${episode.drama.relation}`}>{relationLabel}</span>
        </div>
        <p className={drama && value(drama.synopsis, language) !== "?" ? "" : "pending-copy"}>{drama && value(drama.synopsis, language) !== "?" ? value(drama.synopsis, language) : t("synopsis_pending")}</p>
        {episode.drama.relation === "repeated" && original && <button className="source-link" onClick={() => navigate({ programme: null, episode: original.id })}>{interpolate(t("first_broadcast"), { number: original.episode_number })} →</button>}
      </section>

      <section className="guests-section">
        <div className="section-heading"><div><p className="eyebrow">{t("guest_voices")}</p><h2>{t("guests")}</h2></div><strong>{guests.length}</strong></div>
        {guests.length ? (
          <div className="guest-list">
            {guests.map((guest) => {
              const state = guest.ipn_region ? states.get(guest.ipn_region) : undefined;
              const role = value(guest.role, language);
              return <article key={guest.id}><div className="guest-monogram" aria-hidden="true">{guest.guest_name.trim().charAt(0)}</div><div><h3>{guest.guest_name}</h3>{role !== "?" && <p>{role}</p>}{state && <small>{interpolate(t("ipn_member"), { state: state.name[language] })}</small>}</div></article>;
            })}
          </div>
        ) : <p className="empty-copy">{t("no_guests")}</p>}
      </section>

      <nav className="episode-pagination" aria-label="Episode navigation">
        {previous ? <button onClick={() => navigate({ programme: null, episode: previous.id })}><small>{t("previous_episode")}</small><strong>← {value(previous.title, language)}</strong></button> : <span />}
        {next ? <button onClick={() => navigate({ programme: null, episode: next.id })}><small>{t("next_episode")}</small><strong>{value(next.title, language)} →</strong></button> : <span />}
      </nav>
    </main>
  );
}
