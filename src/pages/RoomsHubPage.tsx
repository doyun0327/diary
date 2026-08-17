import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { RoomSummary } from "../types/room";
import * as roomsApi from "../api/roomsApi";
import { getAccessToken } from "../hooks/useAuthSession";
import BackIcon from "../components/BackIcon";
import CloseIcon from "../components/CloseIcon";
import AppModal from "../components/AppModal";
import { shareViaNative } from "../utils/nativeShare";
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
    setLoading(true);
    setError(null);
    try {
      if (!shareReady) {
        setRooms([]);
        return;
      }
      await ensureAuth();
      const list = await roomsApi.listRooms();
      setRooms(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("rooms.err.list"));
      setRooms([]);
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
      const room = await roomsApi.createRoom(name, nickname.trim(), avatarUrl);
      setRoomName("");
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
    <div className="rooms">
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
        <div className="rooms__empty">
          <p>{t("rooms.err.needProfile")}</p>
          <button
            type="button"
            className="rooms__btn primary"
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
              className="rooms__btn"
              onClick={() => openSheet("join")}
            >
              {t("rooms.joinWithCode")}
            </button>
            <button
              type="button"
              className="rooms__btn primary"
              onClick={() => openSheet("create")}
            >
              {t("rooms.create")}
            </button>
          </div>

          {!sheet && error && <p className="rooms__error">{error}</p>}

          {loading && <p className="rooms__muted">{t("common.loading")}</p>}

          {!loading && rooms.length === 0 && (
            <div className="rooms__empty">
              <p>{t("rooms.empty")}</p>
            </div>
          )}

          <ul className="rooms__list">
            {rooms.map((room) => (
              <li key={room.id} className="rooms__room-item">
                <button
                  type="button"
                  className="rooms__room-main"
                  onClick={() => onOpenRoom(room.id)}
                >
                  <span className="rooms__room-name">{room.name}</span>
                </button>
                <div className="rooms__room-meta">
                  <span className="rooms__room-meta-left">
                    {room.memberCount != null
                      ? t("rooms.memberCount", { n: room.memberCount })
                      : t("rooms.roomFallback")}
                    <span className="rooms__meta-sep" aria-hidden>
                      ·
                    </span>
                    <button
                      type="button"
                      className="rooms__invite-quiet"
                      title={t("rooms.copyInviteTitle")}
                      aria-label={t("rooms.copyInviteAria")}
                      onClick={() => void shareInviteCode(room.inviteCode)}
                    >
                      {t("rooms.copyInvite")}
                    </button>
                  </span>
                  {room.owner ? (
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
            ))}
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
          <div className="rooms-sheet__panel">
            <header className="rooms-sheet__head">
              <h3>{t("rooms.create")}</h3>
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
                className="rooms__btn primary rooms__btn--block"
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
          <div className="rooms-sheet__panel">
            <header className="rooms-sheet__head">
              <h3>{t("rooms.joinWithCode")}</h3>
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
                className="rooms__btn primary rooms__btn--block"
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
