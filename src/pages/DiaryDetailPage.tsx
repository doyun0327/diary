import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DiaryEntry } from '../types/diary';
import type { RoomSummary } from '../types/room';
import { formatDate } from '../utils/date';
import { findFont } from '../utils/fonts';
import { shareDiaryTo } from '../utils/shareStory';
import { downloadDiaryPaperPng } from '../utils/downloadDiaryPaper';
import * as roomsApi from '../api/roomsApi';
import MoodIcon from '../components/MoodIcon';
import DiaryBookViewer from '../components/DiaryBookViewer';
import './DiaryDetailPage.css';

interface DiaryDetailPageProps {
  entry: DiaryEntry;
  onBack: () => void;
  onEdit: () => void;
  onDelete: (id: string) => void;
}

type ShareStep = 'menu' | 'rooms';

function DiaryDetailPage({ entry, onBack, onEdit, onDelete }: DiaryDetailPageProps) {
  const { t } = useTranslation();
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStep, setShareStep] = useState<ShareStep>('menu');
  const [moreOpen, setMoreOpen] = useState(false);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [selectedRoomIds, setSelectedRoomIds] = useState<string[]>([]);
  const [bookOpen, setBookOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const paperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleDelete = () => {
    setMoreOpen(false);
    if (confirm(t('detail.confirm.delete'))) {
      onDelete(entry.id);
      onBack();
    }
  };

  const openShare = () => {
    setShareMsg(null);
    setShareStep('menu');
    setSelectedRoomIds([]);
    setShareOpen(true);
  };

  const closeShare = (opts?: { force?: boolean }) => {
    if (sharing && !opts?.force) return;
    setShareOpen(false);
    setShareStep('menu');
    setSelectedRoomIds([]);
  };

  const openRoomStep = async () => {
    setShareStep('rooms');
    setSelectedRoomIds([]);
    setRoomsLoading(true);
    try {
      const list = await roomsApi.listRooms();
      setRooms(list);
    } catch (err) {
      setShareMsg(err instanceof Error ? err.message : t('detail.err.roomsList'));
      setRooms([]);
    } finally {
      setRoomsLoading(false);
    }
  };

  const toggleRoom = (roomId: string) => {
    setSelectedRoomIds((prev) =>
      prev.includes(roomId) ? prev.filter((id) => id !== roomId) : [...prev, roomId],
    );
  };

  const shareToSelectedRooms = async () => {
    if (sharing || selectedRoomIds.length === 0) return;
    const targets = rooms.filter((r) => selectedRoomIds.includes(r.id));
    if (targets.length === 0) return;

    setSharing(true);
    setShareMsg(null);
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
        setShareMsg(
          okNames.length === 1
            ? t('share.ok.oneRoom', { name: okNames[0] })
            : t('share.ok.manyRooms', { n: okNames.length }),
        );
      } else if (okNames.length > 0) {
        setShareMsg(
          t('share.ok.partial', { n: okNames.length, fails: failNames.join(', ') }),
        );
      } else {
        setShareMsg(t('share.err.roomShare'));
      }
    } finally {
      setSharing(false);
    }
  };

  const handleDownloadPng = async () => {
    if (downloadingPng || !paperRef.current) return;
    setDownloadingPng(true);
    setShareMsg(null);
    try {
      await downloadDiaryPaperPng(paperRef.current, entry.date, entry.fontId);
      setShareMsg(t('detail.ok.png'));
    } catch (err) {
      setShareMsg(err instanceof Error ? err.message : t('detail.err.png'));
    } finally {
      setDownloadingPng(false);
    }
  };

  const handlePickSns = async () => {
    if (sharing) return;
    setShareMsg(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setSharing(true);
    try {
      const { result, previewUrl: url, isMobileShare } = await shareDiaryTo(entry, 'sns');
      closeShare({ force: true });

      if (result === 'shared') {
        setShareMsg(t('share.pick.sns'));
      } else if (isMobileShare) {
        setShareMsg(t('share.saved.sns'));
        if (url) setPreviewUrl(url);
      } else {
        setShareMsg(t('share.pcHint'));
        if (url) setPreviewUrl(url);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        closeShare({ force: true });
      } else {
        setShareMsg(err instanceof Error ? err.message : t('detail.err.share'));
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
            <path d="M15 18l-6-6 6-6" />
          </svg>
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
        style={{ ['--diary-font' as string]: findFont(entry.fontId).family }}
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

      {shareMsg && <p className="diary-detail__share-msg">{shareMsg}</p>}
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
                <button
                  type="button"
                  className="diary-detail__picker-cancel"
                  disabled={sharing}
                  onClick={() => closeShare()}
                >
                  {t('common.cancel')}
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
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M15 18l-6-6 6-6" />
                    </svg>
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
                {rooms.map((room) => {
                  const selected = selectedRoomIds.includes(room.id);
                  return (
                    <button
                      key={room.id}
                      type="button"
                      className={`diary-detail__picker-item diary-detail__room-option${selected ? ' is-selected' : ''}`}
                      disabled={sharing}
                      aria-pressed={selected}
                      onClick={() => toggleRoom(room.id)}
                    >
                      <span className="diary-detail__picker-icon" aria-hidden>
                        {room.name.trim().charAt(0) || t('rooms.roomFallback')}
                      </span>
                      <span className="diary-detail__room-option-text">
                        <strong>{room.name}</strong>
                      </span>
                      {selected && <span className="diary-detail__room-check" aria-hidden>✓</span>}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="diary-detail__room-share-btn"
                  disabled={sharing || selectedRoomIds.length === 0}
                  onClick={() => void shareToSelectedRooms()}
                >
                  {sharing ? t('share.sharing') : t('share.submit')}
                </button>
                <button
                  type="button"
                  className="diary-detail__picker-cancel"
                  disabled={sharing}
                  onClick={() => closeShare()}
                >
                  {t('common.cancel')}
                </button>
              </>
            )}
          </div>
        </>
      )}

      {bookOpen && (
        <DiaryBookViewer entries={[entry]} onClose={() => setBookOpen(false)} />
      )}
    </article>
  );
}

export default DiaryDetailPage;
