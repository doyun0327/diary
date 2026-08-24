import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { RoomSummary } from "../types/room";
import * as roomsApi from "../api/roomsApi";
import { getAccessToken } from "../hooks/useAuthSession";
import BackIcon from "../components/BackIcon";
import CloseIcon from "../components/CloseIcon";
import AppModal from "../components/AppModal";
import { shareViaNative } from "../utils/nativeShare";
import {
  coverClassName,
  fileToCoverDataUrl,
  rememberRoomCover,
  resolveRoomCover,
} from "../utils/roomCovers";
import {
  getCachedRoomsList,
  setCachedRoomsList,
} from "../utils/roomCache";
import "./RoomsPages.css";

interface RoomsHubPageProps {
  nickname: string;
  avatarUrl: string | null;
  clientId: string;
  ensureGuestSession: (clientId: string, nickname: string) => Promise<unknown>;
  onOpenAccount: () => void;
  onOpenRoom: (roomId: string) => void;
  onBack: () => void;
}

type SheetKind = "create" | "join" | null;

function sortRoomsNewestFirst(list: RoomSummary[]): RoomSummary[] {
  return [...list].sort((a, b) => {
    const tb = Date.parse(b.createdAt) || 0;
    const ta = Date.parse(a.createdAt) || 0;
    if (tb !== ta) return tb - ta;
    return b.id.localeCompare(a.id);
  });
}

function canShare(nickname: string, avatarUrl: string | null) {
  return Boolean(nickname.trim() && avatarUrl);
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch {
    // WebView/권한 ?��?�� ?�� ?���?
  }
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.left = "-9999px";
  document.body.appendChild(el);
  el.select();
  el.setSelectionRange(0, text.length);
  const ok = document.execCommand("copy");
  document.body.removeChild(el);
  if (!ok) {
    throw new Error("copy failed");
  }
}

function RoomsHubPage({
  nickname,
  avatarUrl,
  clientId,
  ensureGuestSession,
  onOpenAccount,
  onOpenRoom,
  onBack,
}: RoomsHubPageProps) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [roomName, setRoomName] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const coverPickModeRef = useRef<"create" | "edit" | null>(null);
  const coverEditRoomIdRef = useRef<string | null>(null);
  const [inviteCode, setInviteCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [createdRoom, setCreatedRoom] = useState<{
    id: string;
    inviteCode: string;
  } | null>(null);
  const [roomAction, setRoomAction] = useState<{
    id: string;
    name: string;
    kind: "leave" | "delete";
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const shareReady = canShare(nickname, avatarUrl);

  const ensureAuth = async () => {
    if (!shareReady) {
      throw new Error(t("rooms.err.needProfile"));
    }
    if (getAccessToken()) return;
    try {
      await ensureGuestSession(clientId, nickname.trim());
    } catch {
      throw new Error(t("rooms.err.guestAuth"));
    }
  };

  const refresh = async () => {
    const cached = shareReady ? getCachedRoomsList() : null;
    if (cached) {
      setRooms(sortRoomsNewestFirst(cached));
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      if (!shareReady) {
        setRooms([]);
        return;
      }
      await ensureAuth();
      const list = await roomsApi.listRooms();
      setCachedRoomsList(list);
      setRooms(sortRoomsNewestFirst(list));
    } catch (err) {
      if (!cached) {
        setError(err instanceof Error ? err.message : t("rooms.err.list"));
        setRooms([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ?��로필 �?비될 ?�� ?��?�� 로드
  }, [shareReady, nickname, clientId]);

  const openSheet = (kind: Exclude<SheetKind, null>) => {
    setError(null);
    if (!shareReady) {
      setError(t("rooms.err.needProfile"));
      return;
    }
    setSheet(kind);
  };

  const closeSheet = () => {
    if (busy) return;
    setSheet(null);
    setError(null);
  };

  const applyRoomCoverUrl = async (roomId: string, nextUrl: string) => {
    setBusy(true);
    setError(null);
    try {
      await ensureAuth();
      try {
        const updated = await roomsApi.updateRoomCover(roomId, {
          coverPreset: null,
          coverUrl: nextUrl,
        });
        rememberRoomCover(roomId, { preset: null, url: nextUrl });
        setRooms((prev) =>
          sortRoomsNewestFirst(
            prev.map((r) =>
              r.id === roomId
                ? {
                    ...r,
                    ...updated,
                    coverPreset: null,
                    coverUrl: updated.coverUrl ?? nextUrl,
                  }
                : r,
            ),
          ),
        );
      } catch {
        rememberRoomCover(roomId, { preset: null, url: nextUrl });
        setRooms((prev) =>
          prev.map((r) =>
            r.id === roomId
              ? { ...r, coverPreset: null, coverUrl: nextUrl }
              : r,
          ),
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("rooms.err.coverUpdate"));
    } finally {
      setBusy(false);
    }
  };

  const openCoverGallery = (mode: "create" | "edit", roomId?: string) => {
    setError(null);
    coverPickModeRef.current = mode;
    coverEditRoomIdRef.current = roomId ?? null;
    coverFileRef.current?.click();
  };

  const onCoverFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    void (async () => {
      const file = e.target.files?.[0];
      e.target.value = "";
      const mode = coverPickModeRef.current;
      coverPickModeRef.current = null;
      if (!file || !mode) return;
      if (!file.type.startsWith("image/")) {
        setError(t("rooms.err.coverImage"));
        return;
      }
      try {
        const url = await fileToCoverDataUrl(file);
        if (mode === "create") {
          setCoverUrl(url);
          return;
        }
        const roomId = coverEditRoomIdRef.current;
        coverEditRoomIdRef.current = null;
        if (roomId) await applyRoomCoverUrl(roomId, url);
      } catch {
        setError(t("rooms.err.coverImage"));
      }
    })();
  };

  const handleCreate = async () => {
    if (!shareReady || busy) return;
    const name = roomName.trim();
    if (!name) {
      setError(t("rooms.err.nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureAuth();
      const room = await roomsApi.createRoom(
        name,
        nickname.trim(),
        avatarUrl,
        null,
        coverUrl,
      );
      rememberRoomCover(room.id, {
        preset: null,
        url: coverUrl,
      });
      setRoomName("");
      setCoverUrl(null);
      setSheet(null);
      setCreatedRoom({ id: room.id, inviteCode: room.inviteCode });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("rooms.err.create"));
    } finally {
      setBusy(false);
    }
  };

  const shareInviteCode = async (code: string) => {
    const text = t("rooms.alert.shareText", { code });
    const installUrl =
      (import.meta.env.VITE_APP_SHARE_URL as string | undefined)?.trim() ||
      window.location.origin;

    const nativeOk = await shareViaNative({
      title: t("rooms.alert.shareTitle"),
      text,
      url: installUrl,
    });
    if (nativeOk) return;

    try {
      await copyText(text);
    } catch {
      // ?��립보?�� ?��?��?��?�� 공유?�� 진행
    }

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: t("rooms.alert.shareTitle"),
          text,
          url: installUrl,
        });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    try {
      await copyText(`${text}\n\n${installUrl}`);
    } catch {
      setError(t("rooms.err.copy"));
    }
  };

  const shareCreatedCode = async () => {
    if (!createdRoom) return;
    await shareInviteCode(createdRoom.inviteCode);
  };

  const dismissCreatedRoom = () => {
    setCreatedRoom(null);
  };

  const handleJoin = async () => {
    if (!shareReady || busy) return;
    const code = inviteCode.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      setError(t("rooms.err.codeRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureAuth();
      const room = await roomsApi.joinRoom(code, nickname.trim(), avatarUrl);
      setInviteCode("");
      setSheet(null);
      await refresh();
      onOpenRoom(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("rooms.err.join"));
    } finally {
      setBusy(false);
    }
  };

  const handleRoomAction = async () => {
    if (!roomAction || actionBusy) return;
    setActionBusy(true);
    setError(null);
    try {
      await ensureAuth();
      if (roomAction.kind === "delete") {
        await roomsApi.deleteRoom(roomAction.id);
      } else {
        await roomsApi.leaveRoom(roomAction.id);
      }
      setRoomAction(null);
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t(
              roomAction.kind === "delete"
                ? "rooms.err.deleteRoom"
                : "rooms.err.leave",
            ),
      );
    } finally {
      setActionBusy(false);
    }
  };

  return (
    <div className="rooms rooms--hub">
      <input
        ref={coverFileRef}
        type="file"
        accept="image/*"
        className="rooms-cover-picker__file"
        onChange={onCoverFileChange}
      />
      <div className="rooms__toolbar">
        <button
          type="button"
          className="rooms__back"
          onClick={onBack}
          aria-label={t("common.back")}
        >
          <BackIcon />
        </button>
        <h2>{t("rooms.title")}</h2>
        <span />
      </div>

      {!shareReady ? (
        <div className="rooms__empty rooms__empty--scrap">
          <p className="rooms__empty-title">{t("rooms.err.needProfile")}</p>
          <button
            type="button"
            className="rooms__btn primary rooms__btn--scrap"
            onClick={onOpenAccount}
          >
            {t("account.title")}
          </button>
        </div>
      ) : (
        <>
          <div className="rooms__actions">
            <button
              type="button"
              className="rooms__btn rooms__btn--scrap rooms__btn--tilt-left"
              onClick={() => openSheet("join")}
            >
              {t("rooms.joinWithCode")}
            </button>
            <button
              type="button"
              className="rooms__btn primary rooms__btn--scrap rooms__btn--tilt-right"
              onClick={() => openSheet("create")}
            >
              {t("rooms.create")}
            </button>
          </div>

          {!sheet && error && <p className="rooms__error">{error}</p>}

          {loading && <p className="rooms__muted">{t("common.loading")}</p>}

          {!loading && rooms.length === 0 && (
            <div className="rooms__empty rooms__empty--create-only">
              <button
                type="button"
                className="rooms__btn primary rooms__btn--scrap"
                onClick={() => openSheet("create")}
              >
                {t("rooms.create")}
              </button>
            </div>
          )}

          <ul className="rooms__list rooms__list--polaroid">
            {rooms.map((room, index) => {
              const cover = resolveRoomCover(
                room.id,
                room.coverPreset,
                room.coverUrl,
              );
              return (
                <li
                  key={room.id}
                  className={`rooms__polaroid${
                    index % 2 === 1 ? " rooms__polaroid--tilt" : ""
                  }`}
                >
                  <span
                    className={`rooms__polaroid-pin rooms__polaroid-pin--washi rooms__polaroid-pin--washi-${
                      index % 6
                    }`}
                    aria-hidden
                  />
                  <button
                    type="button"
                    className="rooms__polaroid-main"
                    onClick={() => onOpenRoom(room.id)}
                  >
                    {cover.kind === "image" ? (
                      <span className="rooms__polaroid-photo rooms__polaroid-photo--image">
                        <img src={cover.url} alt="" />
                      </span>
                    ) : (
                      <span
                        className={`rooms__polaroid-photo ${coverClassName(cover.id)}`}
                        aria-hidden
                      />
                    )}
                    <span className="rooms__polaroid-caption">
                      <span className="rooms__polaroid-copy">
                        <span className="rooms__room-name">{room.name}</span>
                        <span className="rooms__room-members">
                          {room.memberCount != null
                            ? t("rooms.memberCount", { n: room.memberCount })
                            : t("rooms.roomFallback")}
                        </span>
                      </span>
                    </span>
                  </button>
                  <div className="rooms__polaroid-actions">
                    <button
                      type="button"
                      className="rooms__invite-quiet"
                      title={t("rooms.copyInviteTitle")}
                      aria-label={t("rooms.copyInviteAria")}
                      onClick={() => void shareInviteCode(room.inviteCode)}
                    >
                      {t("rooms.copyInvite")}
                    </button>
                    {room.owner ? (
                      <>
                        <button
                          type="button"
                          className="rooms__leave-btn"
                          aria-label={t("rooms.changeCoverAria")}
                          title={t("rooms.changeCover")}
                          onClick={() => openCoverGallery("edit", room.id)}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          className="rooms__leave-btn rooms__leave-btn--danger"
                          aria-label={t("rooms.deleteAria")}
                          title={t("rooms.delete")}
                          onClick={() =>
                            setRoomAction({
                              id: room.id,
                              name: room.name,
                              kind: "delete",
                            })
                          }
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            aria-hidden
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <line x1="10" y1="11" x2="10" y2="17" />
                            <line x1="14" y1="11" x2="14" y2="17" />
                          </svg>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="rooms__leave-btn"
                        aria-label={t("rooms.leaveAria")}
                        title={t("rooms.leave")}
                        onClick={() =>
                          setRoomAction({
                            id: room.id,
                            name: room.name,
                            kind: "leave",
                          })
                        }
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                          <polyline points="16 17 21 12 16 7" />
                          <line x1="21" y1="12" x2="9" y2="12" />
                        </svg>
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {sheet === "create" && (
        <div
          className="rooms-sheet"
          role="dialog"
          aria-label={t("rooms.createSheetAria")}
        >
          <div className="rooms-sheet__backdrop" onClick={closeSheet} />
          <div className="rooms-sheet__panel rooms-sheet__panel--scrap">
            <header className="rooms-sheet__head">
              <div className="rooms-sheet__titles">
                <h3>{t("rooms.create")}</h3>
                <p className="rooms-sheet__hint">{t("rooms.createHint")}</p>
              </div>
              <button
                type="button"
                className="sheet-close-btn"
                onClick={closeSheet}
                disabled={busy}
                aria-label={t("common.close")}
              >
                <CloseIcon />
              </button>
            </header>
            <div className="rooms-sheet__body">
              <input
                type="text"
                value={roomName}
                maxLength={30}
                placeholder={t("rooms.roomNamePlaceholder")}
                onChange={(e) => setRoomName(e.target.value)}
              />
              <button
                type="button"
                className={`rooms-cover-pick${coverUrl ? " is-filled" : ""}`}
                onClick={() => openCoverGallery("create")}
              >
                {coverUrl ? (
                  <img
                    className="rooms-cover-pick__preview"
                    src={coverUrl}
                    alt=""
                  />
                ) : (
                  <span className="rooms-cover-pick__placeholder">
                    {t("rooms.coverFromGallery")}
                  </span>
                )}
              </button>
              <button
                type="button"
                className="rooms__btn primary rooms__btn--block rooms__btn--scrap"
                disabled={busy}
                onClick={() => void handleCreate()}
              >
                {busy ? t("rooms.creating") : t("rooms.create")}
              </button>
            </div>
            {error && <p className="rooms__error">{error}</p>}
          </div>
        </div>
      )}

      {sheet === "join" && (
        <div
          className="rooms-sheet"
          role="dialog"
          aria-label={t("rooms.joinSheetAria")}
        >
          <div className="rooms-sheet__backdrop" onClick={closeSheet} />
          <div className="rooms-sheet__panel rooms-sheet__panel--scrap">
            <header className="rooms-sheet__head">
              <div className="rooms-sheet__titles">
                <h3>{t("rooms.joinWithCode")}</h3>
                <p className="rooms-sheet__hint">{t("rooms.joinHint")}</p>
              </div>
              <button
                type="button"
                className="sheet-close-btn"
                onClick={closeSheet}
                disabled={busy}
                aria-label={t("common.close")}
              >
                <CloseIcon />
              </button>
            </header>
            <div className="rooms-sheet__body">
              <input
                type="text"
                inputMode="numeric"
                value={inviteCode}
                maxLength={6}
                placeholder={t("rooms.invitePlaceholder")}
                onChange={(e) =>
                  setInviteCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                }
              />
              <button
                type="button"
                className="rooms__btn primary rooms__btn--block rooms__btn--scrap"
                disabled={busy}
                onClick={() => void handleJoin()}
              >
                {busy ? t("rooms.joining") : t("rooms.joinSubmit")}
              </button>
            </div>
            {error && <p className="rooms__error">{error}</p>}
          </div>
        </div>
      )}

      {createdRoom && (
        <AppModal
          title={t("rooms.alert.createdTitle")}
          lead={t("rooms.alert.createdLead")}
          onDismiss={dismissCreatedRoom}
          closeAriaLabel={t("common.close")}
          primaryLabel={t("rooms.alert.share")}
          onPrimary={() => void shareCreatedCode()}
        >
          <p
            className="rooms-created__code"
            aria-label={t("rooms.copyInviteAria")}
          >
            {createdRoom.inviteCode}
          </p>
        </AppModal>
      )}

      {roomAction && (
        <AppModal
          title={
            roomAction.kind === "delete"
              ? t("rooms.deleteConfirmTitle")
              : t("rooms.leaveConfirmTitle")
          }
          lead={
            roomAction.kind === "delete"
              ? t("rooms.deleteConfirmLead", { name: roomAction.name })
              : t("rooms.leaveConfirmLead", { name: roomAction.name })
          }
          onDismiss={() => {
            if (!actionBusy) setRoomAction(null);
          }}
          showClose={roomAction.kind !== "delete"}
          closeAriaLabel={t("common.close")}
          secondaryLabel={t("common.cancel")}
          onSecondary={() => {
            if (!actionBusy) setRoomAction(null);
          }}
          primaryDanger={roomAction.kind === "delete"}
          primaryLabel={
            actionBusy
              ? roomAction.kind === "delete"
                ? t("rooms.deleting")
                : t("rooms.leaving")
              : roomAction.kind === "delete"
                ? t("rooms.delete")
                : t("rooms.leave")
          }
          onPrimary={() => {
            if (!actionBusy) void handleRoomAction();
          }}
        />
      )}
    </div>
  );
}

export default RoomsHubPage;
