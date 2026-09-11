import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import * as roomsApi from '../api/roomsApi';
import CloseIcon from './CloseIcon';
import DiaryListRow from './DiaryListRow';
import { getAccessToken } from '../hooks/useAuthSession';
import {
  DEFAULT_FONT_SIZE_ID,
  defaultFontIdForLanguage,
} from '../utils/fonts';
import { invalidateRoomFeed } from '../utils/roomCache';
import { resolveEntryImageForRoomShare } from '../utils/resolveRoomShareImage';
import { rememberSharedDiaryFont } from '../utils/roomPostFont';
import {  resolveNetworkErrorTitle } from '../utils/networkError';
import '../pages/RoomsPages.css';

const PICKER_LIMIT = 40;

interface RoomDiaryPickerSheetProps {
  roomId: string;
  roomName: string;
  /** 피드에 이미 보이는 내 공유 diaryId */
  feedSharedDiaryIds: string[];
  entries: DiaryEntry[];
  nickname: string;
  clientId: string;
  ensureGuestSession: (clientId: string, nickname: string) => Promise<unknown>;
  onClose: () => void;
  onShared: () => void;
}

function RoomDiaryPickerSheet({
  roomId,
  roomName,
  feedSharedDiaryIds,
  entries,
  nickname,
  clientId,
  ensureGuestSession,
  onClose,
  onShared,
}: RoomDiaryPickerSheetProps) {
  const { t } = useTranslation();
  const [sharedIds, setSharedIds] = useState<Set<string>>(
    () => new Set(feedSharedDiaryIds),
  );
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(true);

  const recentEntries = useMemo(() => {
    return [...entries]
      .filter((e) => e.id?.trim())
      .sort((a, b) => {
        const byDate = b.date.localeCompare(a.date);
        if (byDate !== 0) return byDate;
        return (b.updatedAt || '').localeCompare(a.updatedAt || '');
      })
      .slice(0, PICKER_LIMIT);
  }, [entries]);

  useEffect(() => {
    setSharedIds(new Set(feedSharedDiaryIds));
  }, [feedSharedDiaryIds]);

  useEffect(() => {
    let cancelled = false;
    setChecking(true);
    void (async () => {
      const next = new Set(feedSharedDiaryIds);
      await Promise.all(
        recentEntries.map(async (entry) => {
          if (next.has(entry.id)) return;
          try {
            const rooms = await roomsApi.listRoomsSharingDiary(entry.id);
            if (rooms.includes(roomId)) next.add(entry.id);
          } catch {
            // ignore per-entry
          }
        }),
      );
      if (!cancelled) {
        setSharedIds(next);
        setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [roomId, recentEntries, feedSharedDiaryIds]);

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
        <header className="rooms-sheet__head">
          <div className="rooms-sheet__titles">
            <h3>{t('rooms.pickDiaryTitle')}</h3>
            <p className="rooms-sheet__hint">
              {t('rooms.pickDiaryHint', { name: roomName })}
            </p>
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

        <div className="rooms-diary-picker__body">
          {error && <p className="rooms__error">{error}</p>}
          {recentEntries.length === 0 ? (
            <p className="rooms__muted">{t('rooms.pickDiaryEmpty')}</p>
          ) : (
            <ul className="rooms-diary-picker__list">
              {recentEntries.map((entry) => {
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
          {checking && recentEntries.length > 0 ? (
            <p className="rooms__muted rooms-diary-picker__checking">
              {t('common.loading')}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default RoomDiaryPickerSheet;
