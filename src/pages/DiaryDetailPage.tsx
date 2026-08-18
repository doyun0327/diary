import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import type { RoomSummary } from '../types/room';
import { formatDate } from '../utils/date';
import { diaryFontStack, findFont } from '../utils/fonts';
import { shareDiaryTo } from '../utils/shareStory';
import { downloadDiaryPaperPng } from '../utils/downloadDiaryPaper';
import * as roomsApi from '../api/roomsApi';
import MoodIcon from '../components/MoodIcon';
import BackIcon from '../components/BackIcon';
import PagePager from '../components/PagePager';
import AppModal from '../components/AppModal';
import DiaryBookViewer from '../components/DiaryBookViewer';
import { useClientProfile } from '../hooks/useClientProfile';
import './DiaryDetailPage.css';

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
  const { avatarUrl } = useClientProfile();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStep, setShareStep] = useState<ShareStep>('menu');
  const [moreOpen, setMoreOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [roomsPage, setRoomsPage] = useState(0);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [sharedRoomIds, setSharedRoomIds] = useState<string[]>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackModal>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  const roomsPageCount = Math.max(1, Math.ceil(rooms.length / SHARE_ROOMS_PAGE_SIZE));
  const pagedRooms = useMemo(() => {
    const start = roomsPage * SHARE_ROOMS_PAGE_SIZE;
    return rooms.slice(start, start + SHARE_ROOMS_PAGE_SIZE);
  }, [rooms, roomsPage]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    if (roomsPage > 0 && roomsPage >= roomsPageCount) {
      setRoomsPage(Math.max(0, roomsPageCount - 1));
    }
  }, [roomsPage, roomsPageCount]);

  const handleDelete = () => {
    setMoreOpen(false);
    if (confirm(t('detail.confirm.delete'))) {
      onDelete(entry.id);
      onBack();
    }
  };

  const openShare = () => {
    setFeedback(null);
    setShareStep('menu');
    setSelectedRoomIds([]);
    setSharedRoomIds([]);
    setShareOpen(true);
  };

  const closeShare = (opts?: { force?: boolean }) => {
    if (sharing && !opts?.force) return;
    setShareOpen(false);
    setShareStep('menu');
    setSelectedRoomIds([]);
    setSharedRoomIds([]);
  };

  const openRoomStep = async () => {
    setShareStep('rooms');
    setSelectedRoomIds([]);
    setSharedRoomIds([]);
    setRoomsPage(0);
    setRoomsLoading(true);
    try {
      const [list, already] = await Promise.all([
        roomsApi.listRooms(),
        roomsApi.listRoomsSharingDiary(entry.id).catch(() => [] as string[]),
      ]);
      setRooms(list);
      setSharedRoomIds(already);
      setRoomsPage(0);
    } catch (err) {
      setFeedback({
        kind: 'info',
        title: err instanceof Error ? err.message : t('detail.err.roomsList'),
      });
      setRooms([]);
      setRoomsPage(0);
      setSharedRoomIds([]);
    } finally {
      setRoomsLoading(false);
    }
  };

  const toggleRoom = (roomId: string) => {
    if (sharedRoomIds.includes(roomId)) return;
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
    );
  };

  const shareToSelectedRooms = async () => {
    if (sharing || selectedRoomIds.length === 0) return;
    const targets = rooms.filter(
      (r) => selectedRoomIds.includes(r.id) && !sharedRoomIds.includes(r.id),
    );
    if (targets.length === 0) return;

    setSharing(true);
    setFeedback(null);
    const body = {
      diaryId: entry.id,
      title: entry.title,
      date: entry.date,
      content: entry.content,
      mood: entry.mood,
      imageUrl: entry.imageUrl,
    };

    const okNames: string[] = [];
    const failNames: string[] = [];

    try {
      for (const room of targets) {
        try {
          await roomsApi.createRoomPost(room.id, body);
          okNames.push(room.name);
        } catch {
          failNames.push(room.name);
        }
      }

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

  const handleDownloadPng = async () => {
    if (downloadingPng || !paperRef.current) return;
    setDownloadingPng(true);
    setFeedback(null);
    try {
      await downloadDiaryPaperPng(paperRef.current, entry.date, entry.fontId);
      setFeedback({ kind: 'info', title: t('detail.ok.png') });
    } catch (err) {
      setFeedback({
        kind: 'info',
        title: err instanceof Error ? err.message : t('detail.err.png'),
      });
    } finally {
      setDownloadingPng(false);
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

  return (
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
            onClick={() => setBookOpen(true)}
            aria-label={t('detail.bookAria')}
            title={t('detail.bookTitle')}
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
              <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5z" />
              <path d="M8 7h8" />
              <path d="M8 11h8" />
            </svg>
          </button>

          <button
            type="button"
            className="diary-detail__icon-btn"
            onClick={() => void handleDownloadPng()}
            disabled={downloadingPng}
            aria-label={t('detail.pngAria')}
            title={t('detail.pngTitle')}
          >
            {downloadingPng ? (
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
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" x2="12" y1="15" y2="3" />
              </svg>
            )}
          </button>

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
                    onClick={handleDelete}
                  >
                    {t('detail.delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className="diary-detail__paper"
        ref={paperRef}
        style={{ ['--diary-font' as string]: diaryFontStack(findFont(entry.fontId).family) }}
      >
        <div className="diary-detail__dateline">
          <span>{formatDate(entry.date)}</span>
          <span className="diary-detail__mood">
            <MoodIcon mood={entry.mood} size={22} />
          </span>
        </div>

        {entry.title && <h2 className="diary-detail__title">{entry.title}</h2>}

        {entry.imageUrl && (
          <div className="diary-detail__image">
            <img src={entry.imageUrl} alt={entry.title ? t('detail.imageAltTitle', { title: entry.title }) : t('detail.imageAlt', { date: entry.date })} />
          </div>
        )}

        <section className="diary-detail__section">
          <p className="diary-detail__content">{entry.content || ' '}</p>
        </section>
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
                      {pagedRooms.map((room) => {
                        const selected = selectedRoomIds.includes(room.id);
                        const alreadyShared = sharedRoomIds.includes(room.id);
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
                            <span className="diary-detail__picker-icon" aria-hidden>
                              {room.name.trim().charAt(0) || t('rooms.roomFallback')}
                            </span>
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
                    {rooms.length > SHARE_ROOMS_PAGE_SIZE && (
                      <PagePager
                        className="diary-detail__room-pager"
                        page={roomsPage}
                        pageCount={roomsPageCount}
                        onPageChange={setRoomsPage}
                        disabled={sharing}
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

      {bookOpen && (
        <DiaryBookViewer
          entries={[entry]}
          rangeStart={entry.date}
          rangeEnd={entry.date}
          avatarUrl={avatarUrl}
          onClose={() => setBookOpen(false)}
        />
      )}
    </article>
  );
}

export default DiaryDetailPage;
