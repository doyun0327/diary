import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import type { RoomSummary } from '../types/room';
import { formatDate } from '../utils/date';
import { diaryFontStack, findFont, fontSizeCss } from '../utils/fonts';
import { shareDiaryTo } from '../utils/shareStory';
import * as roomsApi from '../api/roomsApi';
import { coverClassName, resolveRoomCover } from '../utils/roomCovers';
import { resolveEntryImageForRoomShare } from '../utils/resolveRoomShareImage';
import { getCachedRoomsList, invalidateRoomFeed } from '../utils/roomCache';
import { prefetchRoomsList } from '../utils/roomPrefetch';
import { getAccessToken, useAuthSession } from '../hooks/useAuthSession';
import { useClientProfile } from '../hooks/useClientProfile';
import MoodIcon from '../components/MoodIcon';
import BackIcon from '../components/BackIcon';
import PagePager from '../components/PagePager';
import AppModal from '../components/AppModal';
import './DiaryDetailPage.css';
import './RoomsPages.css';

const SHARE_ROOMS_PAGE_SIZE = 10;

interface DiaryDetailPageProps {
  entry: DiaryEntry;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
  onOpenRooms: () => void;
}

type ShareStep = 'menu' | 'rooms';

type FeedbackModal =
  | { kind: 'info'; title: string }
  | { kind: 'gotoRooms'; title: string }
  | null;

function DiaryDetailPage({
  entry,
  onBack,
  onEdit,
  onDelete,
  onOpenRooms,
}: DiaryDetailPageProps) {
  const { t } = useTranslation();
  const { ensureGuestSession } = useAuthSession();
  const { clientId, nickname } = useClientProfile();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStep, setShareStep] = useState<ShareStep>('menu');
  const [moreOpen, setMoreOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsPage, setRoomsPage] = useState(0);
  const [roomsPageCount, setRoomsPageCount] = useState(1);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [sharedRoomIds, setSharedRoomIds] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackModal>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);
  const knownRoomsRef = useRef(new Map<string, RoomSummary>());
  const shareImagePromiseRef = useRef<Promise<string | undefined> | null>(null);

  const resetShareImagePrep = () => {
    shareImagePromiseRef.current = null;
  };

  const prepareShareImage = () => {
    if (!shareImagePromiseRef.current) {
      shareImagePromiseRef.current = resolveEntryImageForRoomShare(entry);
    }
    return shareImagePromiseRef.current;
  };

  useEffect(() => {
    resetShareImagePrep();
  }, [entry.id]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDeleteClick = () => {
    setMoreOpen(false);
    setConfirmDelete(true);
  };

  const handleDeleteConfirm = () => {
    setConfirmDelete(false);
    onDelete(entry.id);
    onBack();
  };

  const openShare = () => {
    setFeedback(null);
    setShareStep('menu');
    setSelectedRoomIds([]);
    setSharedRoomIds([]);
    void prefetchRoomsList(0, SHARE_ROOMS_PAGE_SIZE);
    void prepareShareImage();
    setShareOpen(true);
  };

  const closeShare = (opts?: { force?: boolean }) => {
    if (sharing && !opts?.force) return;
    setShareOpen(false);
    setShareStep('menu');
    setSelectedRoomIds([]);
    setSharedRoomIds([]);
    resetShareImagePrep();
  };

  const loadRoomsPage = async (
    page: number,
    opts?: { includeShared?: boolean },
  ) => {
    const cached = getCachedRoomsList(page, SHARE_ROOMS_PAGE_SIZE);
    if (cached) {
      cached.content.forEach((r) => knownRoomsRef.current.set(r.id, r));
      setRooms(cached.content);
      setRoomsPage(cached.page);
      setRoomsPageCount(Math.max(1, cached.totalPages));
      setRoomsLoading(false);
    } else {
      setRoomsLoading(true);
    }

    try {
      if (!getAccessToken()) {
        const nick = nickname.trim() || t('common.anonymous');
        await ensureGuestSession(clientId, nick);
      }

      const sharedPromise = opts?.includeShared
        ? roomsApi.listRoomsSharingDiary(entry.id).catch(() => [] as string[])
        : null;

      if (cached) {
        if (sharedPromise) {
          setSharedRoomIds(await sharedPromise);
        }
        return;
      }

      const [result, sharedIds] = await Promise.all([
        prefetchRoomsList(page, SHARE_ROOMS_PAGE_SIZE),
        sharedPromise ?? Promise.resolve(null),
      ]);

      if (result) {
        result.content.forEach((r) => knownRoomsRef.current.set(r.id, r));
        setRooms(result.content);
        setRoomsPage(result.page);
        setRoomsPageCount(Math.max(1, result.totalPages));
      }
      if (sharedIds) {
        setSharedRoomIds(sharedIds);
      }
    } catch (err) {
      if (!cached) {
        setFeedback({
          kind: 'info',
          title: err instanceof Error ? err.message : t('detail.err.roomsList'),
        });
        setRooms([]);
        setRoomsPage(0);
        setRoomsPageCount(1);
      }
      if (opts?.includeShared) {
        setSharedRoomIds([]);
      }
    } finally {
      setRoomsLoading(false);
    }
  };

  const openRoomStep = () => {
    setShareStep('rooms');
    setSelectedRoomIds([]);
    setSharedRoomIds([]);
    setRoomsPage(0);
    knownRoomsRef.current.clear();
    void prepareShareImage();
    void loadRoomsPage(0, { includeShared: true });
  };

  const onShareRoomsPageChange = (nextPage: number) => {
    if (nextPage === roomsPage || roomsLoading || sharing) return;
    void loadRoomsPage(nextPage);
  };

  const toggleRoom = (roomId: string) => {
    if (sharedRoomIds.includes(roomId)) return;
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
    );
  };

  const shareToSelectedRooms = async () => {
    if (sharing || selectedRoomIds.length === 0) return;
    const targets = selectedRoomIds
      .filter((id) => !sharedRoomIds.includes(id))
      .map((id) => knownRoomsRef.current.get(id))
      .filter((r): r is RoomSummary => Boolean(r));
    if (targets.length === 0) return;

    setSharing(true);
    setFeedback(null);

    try {
      const nick = nickname.trim() || t('common.anonymous');
      const [, imageUrl] = await Promise.all([
        (async () => {
          if (!getAccessToken()) {
            await ensureGuestSession(clientId, nick);
          }
        })(),
        prepareShareImage(),
      ]);
    } catch (err) {
      setSharing(false);
      setFeedback({
        kind: 'info',
        title: err instanceof Error ? err.message : t('detail.err.roomsList'),
      });
      return;
    }

    const shareNick = nickname.trim() || t('common.anonymous');
    const imageUrl = await prepareShareImage();

    const body = {
      diaryId: entry.id,
      title: entry.title,
      date: entry.date,
      content: entry.content,
      mood: entry.mood,
      moodPack: entry.moodPack,
      imageUrl,
      pushTitle: shareNick,
      pushBody: t('rooms.sharePushBody'),
    };

    const okNames: string[] = [];
    const failNames: string[] = [];

    try {
      const results = await Promise.allSettled(
        targets.map((room) => roomsApi.createRoomPost(room.id, body)),
      );

      results.forEach((result, i) => {
        const room = targets[i];
        if (result.status === 'fulfilled') {
          okNames.push(room.name);
          invalidateRoomFeed(room.id);
        } else {
          failNames.push(room.name);
        }
      });

      closeShare({ force: true });

      if (okNames.length > 0 && failNames.length === 0) {
        setFeedback({
          kind: 'gotoRooms',
          title:
            okNames.length === 1
              ? t('share.ok.oneRoom', { name: okNames[0] })
              : t('share.ok.manyRooms', { n: okNames.length }),
        });
      } else if (okNames.length > 0) {
        setFeedback({
          kind: 'gotoRooms',
          title: t('share.ok.partial', { n: okNames.length, fails: failNames.join(', ') }),
        });
      } else {
        setFeedback({ kind: 'info', title: t('share.err.roomShare') });
      }
    } finally {
      setSharing(false);
    }
  };

  const handlePickSns = async () => {
    if (sharing) return;
    setFeedback(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setSharing(true);
    try {
      const { result, previewUrl: url, isMobileShare } = await shareDiaryTo(entry, 'sns', {
        paperElement: paperRef.current,
      });
      closeShare({ force: true });

      if (result !== 'shared') {
        if (isMobileShare) {
          setFeedback({ kind: 'info', title: t('share.saved.sns') });
          if (url) setPreviewUrl(url);
        } else {
          setFeedback({ kind: 'info', title: t('share.pcHint') });
          if (url) setPreviewUrl(url);
        }
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        closeShare({ force: true });
      } else {
        setFeedback({
          kind: 'info',
          title: err instanceof Error ? err.message : t('detail.err.share'),
        });
      }
    } finally {
      setSharing(false);
    }
  };

  return createPortal(
    <article className="diary-detail">
      <div className="diary-detail__toolbar">
        <button
          type="button"
          className="diary-detail__back"
          onClick={onBack}
          aria-label={t('detail.backAria')}
        >
          <BackIcon />
        </button>

        <div className="diary-detail__actions">
          <button
            type="button"
            className="diary-detail__icon-btn"
            onClick={openShare}
            disabled={sharing}
            aria-label={t('detail.shareAria')}
            title={t('detail.shareAria')}
          >
            {sharing ? (
              '…'
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="18" cy="5" r="3" />
                <circle cx="6" cy="12" r="3" />
                <circle cx="18" cy="19" r="3" />
                <line x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
                <line x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
              </svg>
            )}
          </button>

          <div className="diary-detail__more-wrap">
            <button
              type="button"
              className="diary-detail__icon-btn"
              onClick={() => setMoreOpen((v) => !v)}
              aria-label={t('detail.moreAria')}
              aria-expanded={moreOpen}
              title={t('detail.moreAria')}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <circle cx="12" cy="5" r="1.5" fill="currentColor" />
                <circle cx="12" cy="12" r="1.5" fill="currentColor" />
                <circle cx="12" cy="19" r="1.5" fill="currentColor" />
              </svg>
            </button>
            {moreOpen && (
              <>
                <button
                  type="button"
                  className="diary-detail__more-backdrop"
                  aria-label={t('detail.menuCloseAria')}
                  onClick={() => setMoreOpen(false)}
                />
                <div className="diary-detail__more-menu" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMoreOpen(false);
                      onEdit();
                    }}
                  >
                    {t('detail.edit')}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={handleDeleteClick}
                  >
                    {t('detail.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="diary-detail__main">
      <div
        className="diary-detail__paper"
        ref={paperRef}
        style={{
          ['--diary-font' as string]: diaryFontStack(findFont(entry.fontId).family),
          ['--diary-font-size' as string]: fontSizeCss(entry.fontSize),
        }}
      >
        <div className="diary-detail__dateline">
          <span>{formatDate(entry.date)}</span>
          <span className="diary-detail__mood">
            <MoodIcon mood={entry.mood} packId={entry.moodPack} size={22} />
          </span>
        </div>

        {entry.title && <h2 className="diary-detail__title">{entry.title}</h2>}

        {entry.imageUrl ? (
          <div className="diary-detail__image">
            <img src={entry.imageUrl} alt={entry.title ? t('detail.imageAltTitle', { title: entry.title }) : t('detail.imageAlt', { date: entry.date })} />
          </div>
        ) : (
          <div className="diary-detail__image diary-detail__image--emoji">
            <MoodIcon mood={entry.mood} packId={entry.moodPack} size={80} />
          </div>
        )}

        <section className="diary-detail__section">
          <p className="diary-detail__content">{entry.content || ' '}</p>
        </section>
      </div>
      </div>

      {feedback && (
        <AppModal
          title={feedback.title}
          lead={feedback.kind === 'gotoRooms' ? t('share.goToRoomsAsk') : undefined}
          onDismiss={() => setFeedback(null)}
          secondaryLabel={
            feedback.kind === 'gotoRooms' ? t('common.cancel') : undefined
          }
          onSecondary={() => setFeedback(null)}
          primaryLabel={
            feedback.kind === 'gotoRooms' ? t('share.goToRooms') : t('common.close')
          }
          onPrimary={() => {
            if (feedback.kind === 'gotoRooms') {
              setFeedback(null);
              onOpenRooms();
              return;
            }
            setFeedback(null);
          }}
        />
      )}
      {confirmDelete && (
        <AppModal
          title={t('detail.confirm.delete')}
          onDismiss={() => setConfirmDelete(false)}
          showClose={false}
          closeAriaLabel={t('common.close')}
          secondaryLabel={t('common.cancel')}
          onSecondary={() => setConfirmDelete(false)}
          primaryDanger
          primaryLabel={t('common.delete')}
          onPrimary={handleDeleteConfirm}
        />
      )}
      {previewUrl && (
        <div className="diary-detail__share-preview">
          <img src={previewUrl} alt={t('detail.sharePreviewAlt')} />
        </div>
      )}

      {shareOpen && (
        <>
          <div className="diary-detail__picker-backdrop" onClick={() => closeShare()} />
          <div
            className="diary-detail__picker"
            role="dialog"
            aria-label={shareStep === 'menu' ? t('share.title') : t('share.toRoomAria')}
          >
            {shareStep === 'menu' ? (
              <>
                <h3>{t('share.title')}</h3>
                <button
                  type="button"
                  className="diary-detail__picker-item"
                  disabled={sharing}
                  onClick={() => void handlePickSns()}
                >
                  <span className="diary-detail__picker-icon">{t('share.snsIcon')}</span>
                  <span>
                    <strong>{t('share.sns')}</strong>
                    <small>{t('share.snsDesc')}</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="diary-detail__picker-item"
                  disabled={sharing}
                  onClick={() => void openRoomStep()}
                >
                  <span className="diary-detail__picker-icon">{t('share.roomsIcon')}</span>
                  <span>
                    <strong>{t('share.rooms')}</strong>
                    <small>{t('share.roomsDesc')}</small>
                  </span>
                </button>
              </>
            ) : (
              <>
                <div className="diary-detail__picker-head">
                  <button
                    type="button"
                    className="diary-detail__picker-back"
                    disabled={sharing}
                    onClick={() => setShareStep('menu')}
                    aria-label={t('share.backToMenuAria')}
                  >
                    <BackIcon size={18} strokeWidth={2.2} />
                  </button>
                  <h3>{t('share.rooms')}</h3>
                  <span className="diary-detail__picker-head-spacer" />
                </div>
                <p className="diary-detail__room-hint">{t('share.roomsHint')}</p>
                {roomsLoading && <p className="diary-detail__room-empty">{t('share.roomsLoading')}</p>}
                {!roomsLoading && rooms.length === 0 && (
                  <p className="diary-detail__room-empty">
                    {t('share.roomsEmpty')}
                  </p>
                )}
                {!roomsLoading && rooms.length > 0 && (
                  <>
                    <div className="diary-detail__room-grid" role="list">
                      {rooms.map((room) => {
                        const selected = selectedRoomIds.includes(room.id);
                        const alreadyShared = sharedRoomIds.includes(room.id);
                        const cover = resolveRoomCover(
                          room.id,
                          room.coverPreset,
                          room.coverUrl,
                        );
                        return (
                          <button
                            key={room.id}
                            type="button"
                            role="listitem"
                            className={`diary-detail__picker-item diary-detail__room-option${selected ? ' is-selected' : ''}${alreadyShared ? ' is-shared' : ''}`}
                            disabled={sharing || alreadyShared}
                            aria-pressed={selected}
                            aria-disabled={alreadyShared}
                            onClick={() => toggleRoom(room.id)}
                          >
                            {cover.kind === 'image' ? (
                              <span className="diary-detail__picker-icon diary-detail__picker-icon--cover">
                                <img src={cover.url} alt="" />
                              </span>
                            ) : (
                              <span
                                className={`diary-detail__picker-icon diary-detail__picker-icon--cover ${coverClassName(cover.id)}`}
                                aria-hidden
                              />
                            )}
                            <span className="diary-detail__room-option-text">
                              <strong>{room.name}</strong>
                              {alreadyShared ? (
                                <small>{t('share.alreadyShared')}</small>
                              ) : null}
                            </span>
                            {selected && !alreadyShared && (
                              <span className="diary-detail__room-check" aria-hidden>✓</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {roomsPageCount > 1 && (
                      <PagePager
                        className="diary-detail__room-pager"
                        page={roomsPage}
                        pageCount={roomsPageCount}
                        onPageChange={onShareRoomsPageChange}
                        disabled={sharing || roomsLoading}
                      />
                    )}
                  </>
                )}
                <button
                  type="button"
                  className="diary-detail__room-share-btn"
                  disabled={sharing || selectedRoomIds.length === 0}
                  onClick={() => void shareToSelectedRooms()}
                >
                  {sharing ? t('share.sharing') : t('share.submit')}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </article>,
    document.getElementById('root') ?? document.body,
  );
}

export default DiaryDetailPage;
