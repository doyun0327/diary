import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useTranslation } from "react-i18next";
import type { RoomSummary } from "../types/room";
import * as roomsApi from "../api/roomsApi";
import {
  AUTH_CHANGE_EVENT,
  getAccessToken,
  isGoogleSignedIn,
} from "../hooks/useAuthSession";
import BackIcon from "../components/BackIcon";
import CloseIcon from "../components/CloseIcon";
import AppModal from "../components/AppModal";
import CoachBubble from "../components/CoachBubble";
import PagePager from "../components/PagePager";
import { shareViaNative } from "../utils/nativeShare";
import {
  coverClassName,
  fileToCoverDataUrl,
  rememberRoomCover,
  resolveRoomCover,
} from "../utils/roomCovers";
import { letterAvatarDataUrl } from "../utils/letterAvatar";
import {
  getCachedRoomFeed,
  getCachedRoomsList,
  invalidateRoomsList,
} from "../utils/roomCache";
import { prefetchRoomFeed, prefetchRoomsList } from "../utils/roomPrefetch";
import { roomHasUnreadPosts, syncRoomPostsSeenBaseline } from "../utils/roomPostSeen";
import { isNetworkError, resolveNetworkErrorTitle } from "../utils/networkError";
import {
  isRoomCreateCoachSeen,
  markRoomCreateCoachSeen,
} from "../utils/onboarding";
import {
  buildRoomInviteUrl,
  isValidInviteCode,
  normalizeInviteCode,
} from "../utils/roomInvite";
import { roomsNeedGoogleLogin } from "../utils/roomsAuthGate";
import "./RoomsPages.css";

const HUB_PAGE_SIZE = 10;
const HUB_FEED_PREFETCH = 5;

interface RoomsHubPageProps {
  nickname: string;
  avatarUrl: string | null;
  clientId: string;
  userId?: string | null;
  ensureGuestSession: (
    clientId: string,
    nickname: string,
    opts?: { force?: boolean },
  ) => Promise<unknown>;
  onOpenAccount: () => void;
  onOpenRoom: (roomId: string) => void;
  onBack: () => void;
  /** 딥링크로 받은 초대코드 — 있으면 자동 입장 */
  pendingInviteCode?: string | null;
  onPendingInviteConsumed?: () => void;
}

type SheetKind = "create" | "join" | "edit" | null;

function canShare(nickname: string) {
  return Boolean(nickname.trim());
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
  userId,
  ensureGuestSession,
  onOpenAccount,
  onOpenRoom,
  onBack,
  pendingInviteCode = null,
  onPendingInviteConsumed,
}: RoomsHubPageProps) {
  const { t } = useTranslation();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(() => isGoogleSignedIn());
  const [error, setError] = useState<string | null>(null);
  const [unreadTick, setUnreadTick] = useState(0);
  const [sheet, setSheet] = useState<SheetKind>(null);
  const [roomName, setRoomName] = useState("");
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [editCoverDirty, setEditCoverDirty] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const coverFileRef = useRef<HTMLInputElement>(null);
  const coverPickModeRef = useRef<"create" | "edit" | null>(null);
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
  const [showCreateCoach, setShowCreateCoach] = useState(
    () => !isRoomCreateCoachSeen(),
  );
  const [googleSignedIn, setGoogleSignedIn] = useState(() =>
    isGoogleSignedIn(),
  );
  const [needGoogleLogin, setNeedGoogleLogin] = useState(() =>
    roomsNeedGoogleLogin(),
  );
  const refreshSeqRef = useRef(0);
  const ensureAuthInflightRef = useRef<Promise<void> | null>(null);
  const roomsRef = useRef(rooms);
  roomsRef.current = rooms;

  const shareReady = canShare(nickname);
  const canShowCreateCoach =
    showCreateCoach &&
    shareReady &&
    !loading &&
    rooms.length === 0 &&
    !error &&
    !needGoogleLogin;

  const profileAvatar = () =>
    avatarUrl || letterAvatarDataUrl(nickname.trim() || "?");

  const ensureAuth = () => {
    if (!shareReady) {
      return Promise.reject(new Error(t("rooms.err.needProfile")));
    }
    if (getAccessToken()) return Promise.resolve();
    if (ensureAuthInflightRef.current) return ensureAuthInflightRef.current;

    const run = (async () => {
      try {
        await ensureGuestSession(clientId, nickname.trim());
        if (!getAccessToken()) {
          await ensureGuestSession(clientId, nickname.trim(), { force: true });
        }
        if (!getAccessToken()) {
          throw new Error(t("rooms.err.guestAuth"));
        }
      } catch (err) {
        if (isNetworkError(err)) throw err;
        const msg = err instanceof Error ? err.message : "";
        // 서버/타임아웃 메시지는 그대로 보여 줌 (원인 파악·재시도 유도)
        if (msg.trim()) throw err;
        throw new Error(t("rooms.err.guestAuth"));
      }
    })().finally(() => {
      ensureAuthInflightRef.current = null;
    });

    ensureAuthInflightRef.current = run;
    return run;
  };

  const refresh = async (pageOverride?: number) => {
    const seq = ++refreshSeqRef.current;
    const targetPage = pageOverride ?? page;
    // 게스트·빈 목록은 안내 화면을 바로 두고 백그라운드 갱신 (콜드스타트 대기 UX 완화)
    const blockUi = googleSignedIn || roomsRef.current.length > 0;
    if (blockUi) setLoading(true);
    setError(null);

    const safetyTimer = window.setTimeout(() => {
      if (seq === refreshSeqRef.current) {
        setLoading(false);
      }
    }, 12_000);

    try {
      if (!shareReady) {
        setRooms([]);
        setPage(0);
        setPageCount(1);
        return;
      }

      // Google 로그아웃 직후·토큰 없음 → 목록 API 호출/게스트 발급 없이 재로그인 안내
      if (roomsNeedGoogleLogin() && !getAccessToken()) {
        setNeedGoogleLogin(true);
        setRooms([]);
        setPage(0);
        setPageCount(1);
        return;
      }

      const cached = getCachedRoomsList(targetPage, HUB_PAGE_SIZE);
      if (cached) {
        if (seq !== refreshSeqRef.current) return;
        setError(null);
        setRooms(cached.content);
        setPage(cached.page);
        setPageCount(Math.max(1, cached.totalPages));
        return;
      }

      await ensureAuth();
      if (seq !== refreshSeqRef.current) return;

      const result = await prefetchRoomsList(targetPage, HUB_PAGE_SIZE);
      if (seq !== refreshSeqRef.current) return;

      setError(null);
      setNeedGoogleLogin(roomsNeedGoogleLogin() && !isGoogleSignedIn());
      setRooms(result?.content ?? []);
      setPage(result?.page ?? 0);
      setPageCount(Math.max(1, result?.totalPages ?? 1));
    } catch (err) {
      if (seq !== refreshSeqRef.current) return;
      setError(
        resolveNetworkErrorTitle(
          err,
          t("share.err.network"),
          t("rooms.err.list"),
        ),
      );
      setRooms([]);
      setPageCount(1);
    } finally {
      window.clearTimeout(safetyTimer);
      if (seq === refreshSeqRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    void refresh(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 프로필 준비될 때 다시 로드
  }, [shareReady, nickname, clientId]);

  // Google 로그아웃 직후에만 목록 비우고 1회 재로드 (게스트 토큰 발급 AUTH는 무시)
  useEffect(() => {
    const onAuth = () => {
      const nextGoogle = isGoogleSignedIn();
      setNeedGoogleLogin(roomsNeedGoogleLogin() && !nextGoogle);
      setGoogleSignedIn((prev) => {
        if (prev && !nextGoogle) {
          queueMicrotask(() => {
            setRooms([]);
            setPage(0);
            setPageCount(1);
            setCreatedRoom(null);
            void refresh(0);
          });
        }
        return nextGoogle;
      });
    };
    window.addEventListener(AUTH_CHANGE_EVENT, onAuth);
    return () => window.removeEventListener(AUTH_CHANGE_EVENT, onAuth);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount 시 구독
  }, []);

  // 방 목록 피드 최신화 → 친구 새 글 N 배지
  useEffect(() => {
    if (!shareReady || rooms.length === 0) return;
    let cancelled = false;
    const ids = rooms.map((r) => r.id).filter(Boolean).slice(0, HUB_FEED_PREFETCH);
    void (async () => {
      await Promise.all(
        ids.map((id) =>
          prefetchRoomFeed(id, { page: 0, size: 10, force: true }).catch(() => {}),
        ),
      );
      if (cancelled) return;
      // 허브만 와도 baseline — 이후 친구 새 글에 N 표시 가능
      for (const id of ids) {
        const feed = getCachedRoomFeed(id, 0, 10, { allowStale: true });
        if (feed?.posts?.length) {
          syncRoomPostsSeenBaseline(
            id,
            feed.posts.map((p) => p.id),
          );
        }
      }
      setUnreadTick((n) => n + 1);
    })();
    return () => {
      cancelled = true;
    };
  }, [shareReady, rooms]);

  const unreadRoomIds = useMemo(() => {
    void unreadTick;
    const set = new Set<string>();
    for (const room of rooms) {
      const feed = getCachedRoomFeed(room.id, 0, 10, { allowStale: true });
      if (!feed) continue;
      if (roomHasUnreadPosts(room.id, feed.posts, userId)) {
        set.add(room.id);
      }
    }
    return set;
  }, [rooms, userId, unreadTick]);

  const onRoomsPageChange = (nextPage: number) => {
    if (nextPage === page || loading) return;
    void refresh(nextPage);
  };

  const openSheet = (kind: Exclude<SheetKind, null>) => {
    setError(null);
    if (!shareReady) {
      setError(t("rooms.err.needProfile"));
      return;
    }
    if (kind === "create") {
      setRoomName("");
      setCoverUrl(null);
      setEditingRoomId(null);
      setEditCoverDirty(false);
      if (showCreateCoach) {
        markRoomCreateCoachSeen();
        setShowCreateCoach(false);
      }
    }
    setSheet(kind);
  };

  const dismissCreateCoach = () => {
    markRoomCreateCoachSeen();
    setShowCreateCoach(false);
  };

  const closeSheet = () => {
    if (busy) return;
    setSheet(null);
    setError(null);
    setEditingRoomId(null);
    setEditCoverDirty(false);
  };

  const openEditRoom = (room: RoomSummary) => {
    setError(null);
    if (!shareReady) {
      setError(t("rooms.err.needProfile"));
      return;
    }
    const cover = resolveRoomCover(room.id, room.coverPreset, room.coverUrl);
    setEditingRoomId(room.id);
    setRoomName(room.name);
    setCoverUrl(cover.kind === "image" ? cover.url : null);
    setEditCoverDirty(false);
    setSheet("edit");
  };

  const openCoverGallery = (mode: "create" | "edit") => {
    setError(null);
    coverPickModeRef.current = mode;
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
        setCoverUrl(url);
        if (mode === "edit") setEditCoverDirty(true);
      } catch {
        setError(t("rooms.err.coverImage"));
      }
    })();
  };

  const handleEditSave = async () => {
    if (!editingRoomId || busy) return;
    const name = roomName.trim();
    if (!name) {
      setError(t("rooms.err.nameRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureAuth();
      const body: {
        name: string;
        coverPreset?: string | null;
        coverUrl?: string | null;
      } = { name };
      if (editCoverDirty) {
        body.coverPreset = null;
        body.coverUrl = coverUrl;
      }
      const updated = await roomsApi.updateRoomCover(editingRoomId, body);
      if (editCoverDirty && coverUrl) {
        rememberRoomCover(editingRoomId, { preset: null, url: coverUrl });
      }
      setRooms((prev) =>
        prev.map((r) =>
          r.id === editingRoomId
            ? {
                ...r,
                ...updated,
                name: updated.name ?? name,
                coverPreset: editCoverDirty
                  ? null
                  : (updated.coverPreset ?? r.coverPreset),
                coverUrl: editCoverDirty
                  ? (updated.coverUrl ?? coverUrl)
                  : (updated.coverUrl ?? r.coverUrl),
              }
            : r,
        ),
      );
      setSheet(null);
      setEditingRoomId(null);
      setEditCoverDirty(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("rooms.err.coverUpdate"));
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!shareReady || busy) return;
    const name = roomName.trim();
    if (!name) {
      setError(t("rooms.err.nameRequired"));
      return;
    }
    const pendingCover = coverUrl;
    const pendingAvatar = profileAvatar();
    // data URL 아바타/커버 업로드는 GCS까지 가서 느림 → 방 생성만 먼저, 이미지는 뒤에서
    const avatarForApi =
      pendingAvatar.startsWith("http://") || pendingAvatar.startsWith("https://")
        ? pendingAvatar
        : null;

    setBusy(true);
    setError(null);
    try {
      await ensureAuth();
      const room = await roomsApi.createRoom(
        name,
        nickname.trim(),
        avatarForApi,
        null,
        null,
      );

      if (pendingCover) {
        rememberRoomCover(room.id, { preset: null, url: pendingCover });
      }

      setRoomName("");
      setCoverUrl(null);
      setSheet(null);
      setCreatedRoom({ id: room.id, inviteCode: room.inviteCode });
      setBusy(false);

      const optimistic: RoomSummary = {
        ...room,
        owner: room.owner ?? true,
        memberCount: room.memberCount ?? 1,
        coverUrl: pendingCover ?? room.coverUrl,
      };
      setRooms((prev) =>
        [optimistic, ...prev.filter((r) => r.id !== room.id)].slice(
          0,
          HUB_PAGE_SIZE,
        ),
      );
      setPage(0);

      void (async () => {
        try {
          if (pendingCover) {
            const updated = await roomsApi.updateRoomCover(room.id, {
              coverUrl: pendingCover,
            });
            rememberRoomCover(room.id, {
              preset: null,
              url: updated.coverUrl ?? pendingCover,
            });
            setRooms((prev) =>
              prev.map((r) =>
                r.id === room.id
                  ? {
                      ...r,
                      coverUrl: updated.coverUrl ?? r.coverUrl,
                      coverPreset: updated.coverPreset,
                    }
                  : r,
              ),
            );
          }
          if (!avatarForApi && pendingAvatar) {
            await roomsApi
              .updateMyProfile({
                nickname: nickname.trim(),
                avatarUrl: pendingAvatar,
              })
              .catch(() => {});
          }
        } catch {
          // 커버 업로드 실패해도 초대코드·로컬 커버는 유지
        } finally {
          invalidateRoomsList();
          const result = await prefetchRoomsList(0, HUB_PAGE_SIZE);
          if (result) {
            setRooms(result.content);
            setPage(result.page);
            setPageCount(Math.max(1, result.totalPages));
          }
        }
      })();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("rooms.err.create"));
      setBusy(false);
    }
  };

  const shareInviteCode = async (code: string) => {
    const inviteUrl = buildRoomInviteUrl(code);
    // 안내 문구 + 실제 초대 URL (탭해서 입장)
    const text = `${t("rooms.alert.shareText", { code })}\n${inviteUrl}`;

    const nativeOk = await shareViaNative({
      title: t("rooms.alert.shareTitle"),
      text,
    });
    if (nativeOk) return;

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: t("rooms.alert.shareTitle"),
          text,
        });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }

    try {
      await copyText(text);
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
    const code = normalizeInviteCode(inviteCode);
    if (!isValidInviteCode(code)) {
      setError(t("rooms.err.codeRequired"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await ensureAuth();
      const room = await roomsApi.joinRoom(code, nickname.trim(), profileAvatar());
      setInviteCode("");
      setSheet(null);
      invalidateRoomsList();
      await refresh(0);
      onOpenRoom(room.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("rooms.err.join"));
    } finally {
      setBusy(false);
    }
  };

  // 초대 링크로 들어온 경우 자동 입장
  useEffect(() => {
    const code = normalizeInviteCode(pendingInviteCode ?? "");
    if (!isValidInviteCode(code) || !shareReady) return;
    let cancelled = false;
    setInviteCode(code);
    setSheet("join");
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        await ensureAuth();
        if (cancelled) return;
        const room = await roomsApi.joinRoom(code, nickname.trim(), profileAvatar());
        if (cancelled) return;
        setInviteCode("");
        setSheet(null);
        onPendingInviteConsumed?.();
        invalidateRoomsList();
        await refresh(0);
        onOpenRoom(room.id);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : t("rooms.err.join"));
        onPendingInviteConsumed?.();
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 초대코드 1회
  }, [pendingInviteCode, shareReady]);

  const handleRoomAction = async () => {
    if (!roomAction || actionBusy) return;
    const action = roomAction;
    setActionBusy(true);
    setError(null);

    // UI는 바로 닫고 목록에서 제거 — API·새로고침은 뒤에서
    const removed = rooms.find((r) => r.id === action.id) ?? null;
    setRoomAction(null);
    setRooms((prev) => prev.filter((r) => r.id !== action.id));
    setActionBusy(false);

    try {
      await ensureAuth();
      if (action.kind === "delete") {
        await roomsApi.deleteRoom(action.id);
      } else {
        await roomsApi.leaveRoom(action.id);
      }
      invalidateRoomsList();
      void prefetchRoomsList(0, HUB_PAGE_SIZE).then((result) => {
        if (!result) return;
        setRooms(result.content);
        setPage(result.page);
        setPageCount(Math.max(1, result.totalPages));
      });
    } catch (err) {
      if (removed) {
        setRooms((prev) => {
          if (prev.some((r) => r.id === removed.id)) return prev;
          return [removed, ...prev].slice(0, HUB_PAGE_SIZE);
        });
      }
      setError(
        err instanceof Error
          ? err.message
          : t(
              action.kind === "delete"
                ? "rooms.err.deleteRoom"
                : "rooms.err.leave",
            ),
      );
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
        <span className="rooms__toolbar-balance" aria-hidden />
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
          <div className="rooms__hub-intro">
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
              {canShowCreateCoach && (
                <CoachBubble
                  className="rooms__create-coach"
                  arrow="top-right"
                  onDismiss={dismissCreateCoach}
                >
                  <p>{t("rooms.coach.create")}</p>
                </CoachBubble>
              )}
            </div>

            {!loading && rooms.length === 0 && (
              <div className="rooms__empty rooms__empty--scrap rooms__empty--hub-cta">
                {error ? (
                  <>
                    <p className="rooms__empty-title">{error}</p>
                    <button
                      type="button"
                      className="rooms__btn primary rooms__btn--scrap"
                      onClick={() => void refresh(0)}
                    >
                      {t("rooms.retryList")}
                    </button>
                  </>
                ) : needGoogleLogin ? (
                  <>
                    <p className="rooms__empty-title">
                      {t("rooms.emptyAfterLogout")}
                    </p>
                    <p className="rooms__empty-lead">
                      {t("rooms.emptyLoginLead")}
                    </p>
                    <button
                      type="button"
                      className="rooms__btn primary rooms__btn--scrap"
                      onClick={onOpenAccount}
                    >
                      {t("rooms.emptyLoginCta")}
                    </button>
                  </>
                ) : (
                  <p className="rooms__empty-title">{t("rooms.empty")}</p>
                )}
              </div>
            )}
          </div>

          {!sheet && error && rooms.length > 0 && (
            <p className="rooms__error">{error}</p>
          )}

          {loading && <p className="rooms__muted">{t("common.loading")}</p>}

          <ul className="rooms__list rooms__list--polaroid">
            {rooms.map((room, index) => {
              const cover = resolveRoomCover(
                room.id,
                room.coverPreset,
                room.coverUrl,
              );
              const showNew = unreadRoomIds.has(room.id);
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
                    onPointerDown={() => void prefetchRoomFeed(room.id)}
                    onClick={() => onOpenRoom(room.id)}
                  >
                    <span className="rooms__polaroid-photo-wrap">
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
                      {showNew ? (
                        <span
                          className="rooms__polaroid-new"
                          aria-label={t("rooms.postNewAria")}
                        >
                          {t("rooms.postNew")}
                        </span>
                      ) : null}
                    </span>
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
                          onClick={() => openEditRoom(room)}
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
          <PagePager
            className="rooms__pager"
            page={page}
            pageCount={pageCount}
            onPageChange={onRoomsPageChange}
            disabled={loading}
          />
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

      {sheet === "edit" && (
        <div
          className="rooms-sheet"
          role="dialog"
          aria-label={t("rooms.changeCoverSheetAria")}
        >
          <div className="rooms-sheet__backdrop" onClick={closeSheet} />
          <div className="rooms-sheet__panel rooms-sheet__panel--scrap">
            <header className="rooms-sheet__head">
              <div className="rooms-sheet__titles">
                <h3>{t("rooms.changeCover")}</h3>
                <p className="rooms-sheet__hint">
                  {t("rooms.changeCoverHint", { name: roomName || t("rooms.roomFallback") })}
                </p>
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
                onClick={() => openCoverGallery("edit")}
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
                onClick={() => void handleEditSave()}
              >
                {busy ? t("rooms.changingCover") : t("rooms.changeCoverSave")}
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
                inputMode="text"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={inviteCode}
                maxLength={8}
                placeholder={t("rooms.invitePlaceholder")}
                onChange={(e) =>
                  setInviteCode(
                    e.target.value
                      .replace(/[^a-zA-Z0-9]/g, "")
                      .toUpperCase()
                      .slice(0, 8),
                  )
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
          showClose={!actionBusy}
          closeAriaLabel={t("common.close")}
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
