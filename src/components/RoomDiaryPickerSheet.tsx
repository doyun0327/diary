import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import * as roomsApi from '../api/roomsApi';
import CloseIcon from './CloseIcon';
import DiaryListRow from './DiaryListRow';
import {
  getAccessToken,
  isGoogleSignedIn,
} from '../hooks/useAuthSession';
import {
  DEFAULT_FONT_SIZE_ID,
  defaultFontIdForLanguage,
} from '../utils/fonts';
import { invalidateRoomFeed } from '../utils/roomCache';
import { resolveEntryImageForRoomShare } from '../utils/resolveRoomShareImage';
import { rememberSharedDiaryFont } from '../utils/roomPostFont';
import { resolveNetworkErrorTitle } from '../utils/networkError';
import { monthKey, prevMonthKey } from '../utils/date';
import '../pages/RoomsPages.css';

const PICKER_PAGE = 20;
/** 연속으로 빈 달을 이만큼 만나면 클라우드 pull 중단 */
const EMPTY_MONTH_STOP = 8;

function normalizeSearch(text: string) {
  return text
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[./]/g, '-')
    .replace(/-+/g, '-');
}

function entryMatchesQuery(entry: DiaryEntry, rawQuery: string): boolean {
  const needle = normalizeSearch(rawQuery);
  if (!needle) return true;
  const date = entry.date?.trim() || '';
  const dateCompact = date.replace(/-/g, '');
  const hay = normalizeSearch(
    `${entry.title ?? ''} ${entry.content ?? ''} ${date} ${dateCompact}`,
  );
  const needleCompact = needle.replace(/-/g, '');
  return hay.includes(needle) || (needleCompact.length >= 2 && hay.includes(needleCompact));
}

interface RoomDiaryPickerSheetProps {
  roomId: string;
  roomName: string;
  /** 피드에 이미 보이는 내 공유 diaryId */
  feedSharedDiaryIds: string[];
  entries: DiaryEntry[];
  nickname: string;
  clientId: string;
  ensureGuestSession: (
    clientId: string,
    nickname: string,
    opts?: { force?: boolean },
  ) => Promise<unknown>;
  /** Google 로그인 시 해당 YYYY-MM 일기 pull. 받은 일기 수 */
  onPullMonth?: (month: string) => Promise<number>;
  onClose: () => void;
  onShared: () => void;
}

function oldestLocalMonth(entries: DiaryEntry[]): string {
  const now = new Date();
  let oldest = monthKey(now.getFullYear(), now.getMonth());
  for (const e of entries) {
    const ym = e.date?.slice(0, 7);
    if (ym && /^\d{4}-\d{2}$/.test(ym) && ym < oldest) oldest = ym;
  }
  return oldest;
}

function RoomDiaryPickerSheet({
  roomId,
  roomName,
  feedSharedDiaryIds,
  entries,
  nickname,
  clientId,
  ensureGuestSession,
  onPullMonth,
  onClose,
  onShared,
}: RoomDiaryPickerSheetProps) {
  const { t } = useTranslation();
  const [sharedIds, setSharedIds] = useState<Set<string>>(
    () => new Set(feedSharedDiaryIds),
  );
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(PICKER_PAGE);
  const [pullingOlder, setPullingOlder] = useState(false);
  const [cloudDone, setCloudDone] = useState(() => !isGoogleSignedIn());
  const bodyRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const checkedRef = useRef<Set<string>>(new Set());
  const pulledMonthsRef = useRef<Set<string>>(new Set());
  const emptyStreakRef = useRef(0);
  const monthCursorRef = useRef(prevMonthKey(oldestLocalMonth(entries)));
  const pullInflightRef = useRef(false);
  const loadLockRef = useRef(false);
  const sharedIdsRef = useRef(sharedIds);
  sharedIdsRef.current = sharedIds;

  const sortedEntries = useMemo(() => {
    return [...entries]
      .filter((e) => e.id?.trim())
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      });
  }, [entries]);

  const filteredEntries = useMemo(() => {
    if (!query.trim()) return sortedEntries;
    return sortedEntries.filter((e) => entryMatchesQuery(e, query));
  }, [sortedEntries, query]);

  const isSearching = Boolean(query.trim());
  const listEntries = filteredEntries;
  const listLen = listEntries.length;

  const visibleEntries = useMemo(
    () => listEntries.slice(0, visibleCount),
    [listEntries, visibleCount],
  );

  const localHasMore = visibleCount < listLen;
  const canPullCloud =
    !isSearching && Boolean(onPullMonth) && !cloudDone && isGoogleSignedIn();
  const hasMore = localHasMore || canPullCloud;

  useEffect(() => {
    setSharedIds((prev) => {
      const next = new Set(prev);
      for (const id of feedSharedDiaryIds) next.add(id);
      return next;
    });
    for (const id of feedSharedDiaryIds) checkedRef.current.add(id);
  }, [feedSharedDiaryIds]);

  useEffect(() => {
    setVisibleCount(PICKER_PAGE);
    checkedRef.current = new Set(feedSharedDiaryIds);
    pulledMonthsRef.current = new Set();
    emptyStreakRef.current = 0;
    monthCursorRef.current = prevMonthKey(oldestLocalMonth(entries));
    setCloudDone(!isGoogleSignedIn() || !onPullMonth);
    loadLockRef.current = false;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 방 바뀔 때만 리셋
  }, [roomId, onPullMonth]);

  // 공유 여부 확인은 조용히 (로딩 UI 없음 → 높이 변화·스크롤 튐 방지)
  useEffect(() => {
    let cancelled = false;
    const pending = visibleEntries.filter(
      (e) => !checkedRef.current.has(e.id) && !sharedIdsRef.current.has(e.id),
    );
    if (pending.length === 0) return;

    void (async () => {
      const found: string[] = [];
      await Promise.all(
        pending.map(async (entry) => {
          checkedRef.current.add(entry.id);
          try {
            const rooms = await roomsApi.listRoomsSharingDiary(entry.id);
            if (rooms.includes(roomId)) found.push(entry.id);
          } catch {
            // ignore
          }
        }),
      );
      if (cancelled || found.length === 0) return;
      setSharedIds((prev) => {
        const next = new Set(prev);
        for (const id of found) next.add(id);
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, visibleEntries]);

  const pullOlderMonth = async () => {
    if (!onPullMonth || cloudDone || pullInflightRef.current) return;
    if (!isGoogleSignedIn()) {
      setCloudDone(true);
      return;
    }

    pullInflightRef.current = true;
    setPullingOlder(true);
    const el = bodyRef.current;
    const savedTop = el?.scrollTop ?? 0;
    try {
      let ym = monthCursorRef.current;
      let guard = 0;
      while (pulledMonthsRef.current.has(ym) && guard < 24) {
        ym = prevMonthKey(ym);
        guard += 1;
      }
      pulledMonthsRef.current.add(ym);
      monthCursorRef.current = prevMonthKey(ym);

      const count = await onPullMonth(ym);
      if (count > 0) {
        emptyStreakRef.current = 0;
      } else {
        emptyStreakRef.current += 1;
        if (emptyStreakRef.current >= EMPTY_MONTH_STOP) {
          setCloudDone(true);
        }
      }
    } catch (err) {
      console.warn('[picker] pull older month failed', err);
      setCloudDone(true);
    } finally {
      pullInflightRef.current = false;
      setPullingOlder(false);
      // 하단 로딩 문구가 사라져도 스크롤 위치 유지
      requestAnimationFrame(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = savedTop;
      });
    }
  };

  const maybeLoadMore = () => {
    if (loadLockRef.current) return;
    if (localHasMore) {
      loadLockRef.current = true;
      const el = bodyRef.current;
      const savedTop = el?.scrollTop ?? 0;
      setVisibleCount((n) => Math.min(n + PICKER_PAGE, listLen));
      requestAnimationFrame(() => {
        if (bodyRef.current) bodyRef.current.scrollTop = savedTop;
        loadLockRef.current = false;
      });
      return;
    }
    if (canPullCloud) {
      loadLockRef.current = true;
      void pullOlderMonth().finally(() => {
        loadLockRef.current = false;
      });
    }
  };

  const onBodyScroll = () => {
    const el = bodyRef.current;
    if (!el || !hasMore || pullingOlder || loadLockRef.current) return;
    const remain = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remain < 80) maybeLoadMore();
  };

  useEffect(() => {
    setVisibleCount(PICKER_PAGE);
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [query]);

  // 첫 화면이 안 찰 때만 한 번 더 채움 (연쇄 루프 방지)
  useEffect(() => {
    const el = bodyRef.current;
    if (!el || pullingOlder || loadLockRef.current) return;
    if (!localHasMore && !canPullCloud) return;
    if (el.scrollHeight > el.clientHeight + 8) return;
    maybeLoadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listLen, visibleCount, cloudDone, pullingOlder, isSearching]);

  const shareEntry = async (entry: DiaryEntry) => {
    if (sharingId || sharedIds.has(entry.id)) return;
    setError(null);
    setSharingId(entry.id);

    const nick = nickname.trim() || t('common.anonymous');
    try {
      if (!getAccessToken()) {
        await ensureGuestSession(clientId, nick);
      }
      const imageUrl = await resolveEntryImageForRoomShare(entry);
      const fontId = entry.fontId?.trim() || defaultFontIdForLanguage();
      const fontSize = entry.fontSize?.trim() || DEFAULT_FONT_SIZE_ID;

      await roomsApi.createRoomPost(roomId, {
        diaryId: entry.id,
        title: entry.title,
        date: entry.date,
        content: entry.content,
        mood: entry.mood,
        moodPack: entry.moodPack,
        imageUrl,
        fontId,
        fontSize,
        pushTitle: nick,
        pushBody: t('rooms.sharePushBody'),
      });

      rememberSharedDiaryFont(entry.id, fontId, fontSize);
      invalidateRoomFeed(roomId);
      setSharedIds((prev) => new Set(prev).add(entry.id));
      onShared();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (/already|이미|409|존재/i.test(msg)) {
        setSharedIds((prev) => new Set(prev).add(entry.id));
        setError(t('share.alreadyShared'));
      } else {
        setError(
          resolveNetworkErrorTitle(
            err,
            t('share.err.network'),
            t('share.err.roomShare'),
          ),
        );
      }
    } finally {
      setSharingId(null);
    }
  };

  return (
    <div
      className="rooms-sheet"
      role="dialog"
      aria-label={t('rooms.pickDiaryAria', { name: roomName })}
    >
      <div className="rooms-sheet__backdrop" onClick={onClose} />
      <div className="rooms-sheet__panel rooms-sheet__panel--scrap rooms-sheet__panel--diary-picker">
        <header className="rooms-sheet__head rooms-sheet__head--diary-picker">
          <div className="rooms-sheet__titles">
            <h3>{t('rooms.pickDiaryTitle')}</h3>
          </div>
          <button
            type="button"
            className="sheet-close-btn"
            onClick={onClose}
            disabled={Boolean(sharingId)}
            aria-label={t('common.close')}
          >
            <CloseIcon />
          </button>
        </header>

        <label className="rooms-diary-picker__search">
          <input
            ref={searchRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('rooms.pickDiarySearchPlaceholder')}
            aria-label={t('rooms.pickDiarySearchAria')}
            enterKeyHint="search"
            autoComplete="off"
            disabled={Boolean(sharingId)}
          />
        </label>

        <div
          ref={bodyRef}
          className="rooms-diary-picker__body"
          onScroll={onBodyScroll}
        >
          {error && <p className="rooms__error">{error}</p>}
          {listLen === 0 && !pullingOlder ? (
            <p className="rooms__muted">
              {t(
                isSearching
                  ? 'rooms.pickDiarySearchEmpty'
                  : 'rooms.pickDiaryEmpty',
              )}
            </p>
          ) : (
            <ul className="rooms-diary-picker__list">
              {visibleEntries.map((entry) => {
                const already = sharedIds.has(entry.id);
                const busy = sharingId === entry.id;
                const blocked = already || Boolean(sharingId);
                return (
                  <li key={entry.id}>
                    <div
                      className={`rooms-diary-picker__row${already ? ' is-shared' : ''}${busy ? ' is-busy' : ''}`}
                    >
                      <DiaryListRow
                        entry={entry}
                        onClick={() => {
                          if (!blocked) void shareEntry(entry);
                        }}
                      />
                      {already ? (
                        <span className="rooms-diary-picker__badge">
                          {t('share.alreadyShared')}
                        </span>
                      ) : null}
                      {busy ? (
                        <span className="rooms-diary-picker__badge">
                          {t('share.sharing')}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {/* 높이 고정 — 로딩 문구 생김/사라짐으로 스크롤이 튀지 않게 */}
          <div
            className="rooms-diary-picker__footer"
            aria-hidden={pullingOlder ? undefined : !hasMore && listLen === 0}
          >
            {pullingOlder ? (
              <p className="rooms__muted rooms-diary-picker__checking">
                {t('common.loading')}
              </p>
            ) : listLen > 0 && !hasMore ? (
              <p className="rooms__muted rooms-diary-picker__checking">
                {t(
                  isSearching
                    ? 'rooms.pickDiarySearchEnd'
                    : 'rooms.pickDiaryEnd',
                )}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export default RoomDiaryPickerSheet;
