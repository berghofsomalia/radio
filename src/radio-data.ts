import { supabase } from "./supabase";

export type Language = "so" | "en";
export type Localised = { so: string; en: string };
export type Programme = { id: string; name: Localised; state_id: string; description: Localised; spreaker_url: string; station_ids: string[] };
export type Station = { id: string; name: Localised; state_id: string };
export type StateRecord = { id: string; name: Localised };
export type Episode = {
  id: string;
  programme_id: string;
  episode_number: number;
  title: Localised;
  broadcast_date: string;
  station_id: string | null;
  publication_status: "ready" | "incomplete";
  availability: { image: boolean; audio: boolean; video: boolean };
  media: { cover_image_url: string | null; audio_url: string | null; video_url: string | null };
  drama: { id: string; relation: "new" | "repeated" | "unresolved"; source_episode_id: string | null };
  missing_fields: string[];
};
export type Guest = {
  id: string;
  episode_id: string;
  guest_name: string;
  role: Localised;
  gender: "woman" | "man" | "unknown";
  is_youth: boolean | null;
  cross_section: string | null;
  ipn_region: string | null;
  participation_mode: "live" | "recorded" | "unknown";
  data_status?: "ready" | "incomplete";
  missing_fields?: string[];
};
export type Drama = {
  id: string;
  programme_id: string;
  source_episode_id: string | null;
  title: Localised;
  synopsis: Localised;
  data_status: "ready" | "incomplete";
  missing_fields: string[];
};
export type Dictionary = Record<string, string>;
export type ArchiveData = {
  programmes: Programme[];
  stations: Station[];
  states: StateRecord[];
  episodes: Episode[];
  guests: Guest[];
  dramas: Drama[];
  dictionaries: Record<Language, Dictionary>;
};
export type InternalEpisode = { episode_id: string; repeat_source_episode_id: string | null; repeat_drama_raw: string | null };
export type Draft = { episode: Episode; drama: Drama; guests: Guest[]; repeat_drama_internal: string };

function clean(value: unknown) {
  return typeof value === "string" && value.trim() && value.trim() !== "?" ? value.trim() : null;
}

function check<T>(result: { data: T | null; error: { message: string } | null }, label: string): T {
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data as T;
}

async function dictionaries() {
  const load = (language: Language) => fetch(new URL(`i18n/${language}.json`, window.location.href)).then((response) => {
    if (!response.ok) throw new Error(`Could not load ${language} translations.`);
    return response.json() as Promise<Dictionary>;
  });
  const [so, en] = await Promise.all([load("so"), load("en")]);
  return { so, en };
}

export async function loadArchive(): Promise<ArchiveData> {
  const [statesResult, stationsResult, programmesResult, linksResult, episodesResult, dramasResult, episodeDramasResult, guestsResult, words] = await Promise.all([
    supabase.from("states").select("*").order("id"),
    supabase.from("stations").select("*").order("id"),
    supabase.from("programmes").select("*").order("id"),
    supabase.from("programme_stations").select("*").order("station_id"),
    supabase.from("episodes").select("*").order("broadcast_date", { ascending: false }),
    supabase.from("dramas").select("*").order("id"),
    supabase.from("episode_dramas").select("*").order("episode_id"),
    supabase.from("guest_appearances").select("*").order("id"),
    dictionaries(),
  ]);

  const stateRows = check<any[]>(statesResult, "states");
  const stationRows = check<any[]>(stationsResult, "stations");
  const programmeRows = check<any[]>(programmesResult, "programmes");
  const links = check<any[]>(linksResult, "programme stations");
  const episodeRows = check<any[]>(episodesResult, "episodes");
  const dramaRows = check<any[]>(dramasResult, "dramas");
  const episodeDramaRows = check<any[]>(episodeDramasResult, "episode dramas");
  const guestRows = check<any[]>(guestsResult, "guest appearances");

  const episodeDramaByEpisode = new Map(episodeDramaRows.map((row) => [row.episode_id, row]));
  const sourceByDrama = new Map(
    episodeDramaRows.filter((row) => row.relation === "new").map((row) => [row.drama_id, row.episode_id]),
  );

  const programmes: Programme[] = programmeRows.map((row) => ({
    id: row.id,
    state_id: row.state_id,
    name: row.id === "garasho-wadaag"
      ? { so: "Garasho-wadaag", en: "Garasho-wadaag" }
      : { so: row.name_so || "?", en: row.name_en || "?" },
    description: { so: row.description_so || "?", en: row.description_en || "?" },
    spreaker_url: row.spreaker_url || "",
    station_ids: links.filter((link) => link.programme_id === row.id).map((link) => link.station_id),
  }));
  const stations: Station[] = stationRows.map((row) => ({ id: row.id, state_id: row.state_id, name: { so: row.name_so || "?", en: row.name_en || "?" } }));
  const states: StateRecord[] = stateRows.map((row) => ({ id: row.id, name: { so: row.name_so || "?", en: row.name_en || "?" } }));
  const episodes: Episode[] = episodeRows.map((row) => {
    const relation = episodeDramaByEpisode.get(row.id);
    return {
      id: row.id,
      programme_id: row.programme_id,
      episode_number: row.episode_number,
      title: { so: row.title_so || "?", en: row.title_en || "?" },
      broadcast_date: row.broadcast_date || "?",
      station_id: row.station_id,
      publication_status: row.publication_status,
      availability: { image: row.image_available, audio: row.audio_available, video: row.video_available },
      media: { cover_image_url: row.cover_image_url, audio_url: row.audio_url, video_url: row.video_url },
      drama: {
        id: relation?.drama_id || `${row.programme_id}-drama-unresolved-${String(row.episode_number).padStart(3, "0")}`,
        relation: relation?.relation || "unresolved",
        source_episode_id: relation ? sourceByDrama.get(relation.drama_id) || null : null,
      },
      missing_fields: row.missing_fields || [],
    };
  });
  const dramas: Drama[] = dramaRows.map((row) => ({
    id: row.id,
    programme_id: row.programme_id,
    source_episode_id: sourceByDrama.get(row.id) || null,
    title: { so: row.title_so || "?", en: row.title_en || "?" },
    synopsis: { so: row.synopsis_so || "?", en: row.synopsis_en || "?" },
    data_status: row.data_status,
    missing_fields: row.missing_fields || [],
  }));
  const guests: Guest[] = guestRows.map((row) => ({
    id: row.id,
    episode_id: row.episode_id,
    guest_name: row.guest_name || "?",
    role: { so: row.role_so || "?", en: row.role_en || "?" },
    gender: row.gender,
    is_youth: row.is_youth,
    cross_section: row.cross_section,
    ipn_region: row.ipn_region,
    participation_mode: row.participation_mode,
    data_status: row.data_status,
    missing_fields: row.missing_fields || [],
  }));

  return { programmes, stations, states, episodes, guests, dramas, dictionaries: words };
}

export async function loadInternalEpisodes(): Promise<InternalEpisode[]> {
  const result = await supabase.from("episode_internal").select("episode_id,repeat_source_episode_id,repeat_drama_raw");
  return check<InternalEpisode[]>(result, "internal episode data");
}

export async function loadCurrentModerator() {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user) throw new Error(userError?.message || "No signed-in moderator.");
  const result = await supabase.from("moderators").select("display_name,email,role,active").eq("user_id", userData.user.id).single();
  return check<{ display_name: string; email: string; role: string; active: boolean }>(result, "moderator profile");
}

export async function saveDraft(draft: Draft) {
  const episode = draft.episode;
  const episodeRow = {
    id: episode.id,
    programme_id: episode.programme_id,
    episode_number: episode.episode_number,
    title_so: clean(episode.title.so),
    title_en: clean(episode.title.en),
    broadcast_date: clean(episode.broadcast_date),
    station_id: episode.station_id,
    publication_status: episode.publication_status,
    image_available: episode.availability.image,
    audio_available: episode.availability.audio,
    video_available: episode.availability.video,
    cover_image_url: clean(episode.media.cover_image_url),
    audio_url: clean(episode.media.audio_url),
    video_url: clean(episode.media.video_url),
    missing_fields: episode.missing_fields,
    updated_at: new Date().toISOString(),
  };
  check(await supabase.from("episodes").upsert(episodeRow, { onConflict: "id" }), "episode save");

  const dramaRow = {
    id: draft.drama.id,
    programme_id: episode.programme_id,
    title_so: clean(draft.drama.title.so),
    title_en: clean(draft.drama.title.en),
    synopsis_so: clean(draft.drama.synopsis.so),
    synopsis_en: clean(draft.drama.synopsis.en),
    data_status: draft.drama.data_status,
    missing_fields: draft.drama.missing_fields,
    updated_at: new Date().toISOString(),
  };
  check(await supabase.from("dramas").upsert(dramaRow, { onConflict: "id" }), "drama save");
  check(await supabase.from("episode_dramas").upsert({ episode_id: episode.id, drama_id: draft.drama.id, relation: episode.drama.relation }, { onConflict: "episode_id" }), "drama link save");

  if (episode.drama.relation === "repeated") {
    check(await supabase.from("episode_internal").upsert({
      episode_id: episode.id,
      repeat_source_episode_id: episode.drama.source_episode_id,
      repeat_drama_raw: clean(draft.repeat_drama_internal),
      updated_at: new Date().toISOString(),
    }, { onConflict: "episode_id" }), "repeat reference save");
  } else {
    check(await supabase.from("episode_internal").delete().eq("episode_id", episode.id), "repeat reference cleanup");
  }

  check(await supabase.from("guest_appearances").delete().eq("episode_id", episode.id), "guest update");
  if (draft.guests.length) {
    const guestRows = draft.guests.map((guest, index) => ({
      id: `${episode.id}-g${String(index + 1).padStart(2, "0")}`,
      episode_id: episode.id,
      guest_name: clean(guest.guest_name),
      role_so: clean(guest.role.so),
      role_en: clean(guest.role.en),
      gender: guest.gender,
      is_youth: guest.is_youth,
      cross_section: guest.cross_section,
      ipn_region: guest.ipn_region,
      participation_mode: guest.participation_mode,
      data_status: guest.data_status,
      missing_fields: guest.missing_fields || [],
      updated_at: new Date().toISOString(),
    }));
    check(await supabase.from("guest_appearances").insert(guestRows), "guest save");
  }
}
