/** Scrapbook-style room cover presets + optional gallery image. */

export const DEFAULT_COVER_PRESET = "kraft";

export const ROOM_COVER_PRESETS = [
  { id: "kraft", labelKey: "rooms.covers.kraft" },
  { id: "mint", labelKey: "rooms.covers.mint" },
  { id: "rose", labelKey: "rooms.covers.rose" },
  { id: "sky", labelKey: "rooms.covers.sky" },
  { id: "lilac", labelKey: "rooms.covers.lilac" },
  { id: "cream", labelKey: "rooms.covers.cream" },
] as const;

export type RoomCoverPresetId = (typeof ROOM_COVER_PRESETS)[number]["id"];

export type RoomCoverDisplay =
  | { kind: "preset"; id: RoomCoverPresetId }
  | { kind: "image"; url: string };

const PRESET_IDS = new Set<string>(
  ROOM_COVER_PRESETS.map((p) => p.id),
);

const LOCAL_COVERS_KEY = "pageby.roomCovers";

const COVER_MAX_EDGE = 640;
const COVER_JPEG_QUALITY = 0.8;

export function normalizeCoverPreset(
  id: string | null | undefined,
): RoomCoverPresetId {
  if (id && PRESET_IDS.has(id)) {
    return id as RoomCoverPresetId;
  }
  return DEFAULT_COVER_PRESET;
}

export function coverClassName(id: string | null | undefined): string {
  return `rooms__cover rooms__cover--${normalizeCoverPreset(id)}`;
}

type LocalCover = { preset?: string; url?: string };

function readLocalCovers(): Record<string, LocalCover> {
  try {
    const raw = localStorage.getItem(LOCAL_COVERS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    // migrate old map of preset strings
    const out: Record<string, LocalCover> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof v === "string") {
        out[k] = { preset: v };
      } else if (v && typeof v === "object") {
        const o = v as LocalCover;
        out[k] = { preset: o.preset, url: o.url };
      }
    }
    return out;
  } catch {
    return {};
  }
}

function writeLocalCovers(map: Record<string, LocalCover>): void {
  try {
    localStorage.setItem(LOCAL_COVERS_KEY, JSON.stringify(map));
  } catch {
    // ignore quota / private mode
  }
}

export function rememberRoomCover(
  roomId: string,
  cover: { preset?: string | null; url?: string | null },
): void {
  const map = readLocalCovers();
  const next: LocalCover = {};
  if (cover.url) {
    next.url = cover.url;
  } else if (cover.preset) {
    next.preset = normalizeCoverPreset(cover.preset);
  } else {
    next.preset = DEFAULT_COVER_PRESET;
  }
  map[roomId] = next;
  writeLocalCovers(map);
}

export function resolveRoomCover(
  roomId: string,
  coverPreset?: string | null,
  coverUrl?: string | null,
): RoomCoverDisplay {
  if (coverUrl && coverUrl.trim()) {
    return { kind: "image", url: coverUrl.trim() };
  }
  if (coverPreset && PRESET_IDS.has(coverPreset)) {
    return { kind: "preset", id: coverPreset as RoomCoverPresetId };
  }
  const local = readLocalCovers()[roomId];
  if (local?.url) {
    return { kind: "image", url: local.url };
  }
  return {
    kind: "preset",
    id: normalizeCoverPreset(local?.preset),
  };
}

/** Resize gallery image for room cover (data URL). */
export function fileToCoverDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("read"));
    reader.onload = () => {
      const src = String(reader.result ?? "");
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(
          1,
          COVER_MAX_EDGE / Math.max(img.width, img.height),
        );
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("canvas"));
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", COVER_JPEG_QUALITY));
      };
      img.onerror = () => reject(new Error("image"));
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}
