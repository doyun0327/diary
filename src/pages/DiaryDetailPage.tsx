import { useEffect, useRef, useState } from 'react';
import type { DiaryEntry } from '../types/diary';
import { MOOD_MAP } from '../types/diary';
import type { RoomSummary } from '../types/room';
import { formatDate } from '../utils/date';
import { shareDiaryTo, type ShareTarget } from '../utils/shareStory';
import { downloadDiaryPaperPng } from '../utils/downloadDiaryPaper';
import * as roomsApi from '../api/roomsApi';
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
    if (confirm('이 일기를 삭제할까요?')) {
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
      setShareMsg(err instanceof Error ? err.message : '방 목록을 불러오지 못했어요');
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
            ? `「${okNames[0]}」방에 공유했어요`
            : `${okNames.length}개 방에 공유했어요`,
        );
      } else if (okNames.length > 0) {
        setShareMsg(
          `${okNames.length}개 방에 공유했어요. 실패: ${failNames.join(', ')}`,
        );
      } else {
        setShareMsg('방에 공유하지 못했어요');
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
      await downloadDiaryPaperPng(paperRef.current, entry.date);
      setShareMsg('PNG로 저장했어요');
    } catch (err) {
      setShareMsg(err instanceof Error ? err.message : 'PNG 저장에 실패했어요');
    } finally {
      setDownloadingPng(false);
    }
  };

  const handlePick = async (target: ShareTarget) => {
    if (sharing) return;
    setShareMsg(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setSharing(true);
    try {
      const { result, previewUrl: url, isMobileShare } = await shareDiaryTo(entry, target);
      closeShare({ force: true });

      if (result === 'shared') {
        setShareMsg(
          target === 'instagram'
            ? '공유 목록에서 인스타그램을 골라 주세요!'
            : '공유 목록에서 카카오톡을 골라 주세요!',
        );
      } else if (isMobileShare) {
        setShareMsg(
          target === 'instagram'
            ? '이미지가 저장됐어요. 인스타 스토리에 올려 주세요!'
            : '이미지가 저장됐어요. 카카오톡 채팅방에 사진을 보내 주세요!',
        );
        if (url) setPreviewUrl(url);
      } else {
        setShareMsg(
          'PC 웹에서는 앱으로 바로 공유가 안 돼요. 이미지가 다운로드됐으니, 폰에서 열거나 앱에 올려 주세요.',
        );
        if (url) setPreviewUrl(url);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        closeShare({ force: true });
      } else {
        setShareMsg(err instanceof Error ? err.message : '공유에 실패했어요');
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
          aria-label="뒤로가기"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
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

        <div className="diary-detail__actions">
          <button
            type="button"
            className="diary-detail__icon-btn"
            onClick={() => setBookOpen(true)}
            aria-label="일기장으로 보기"
            title="일기장 · PDF"
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
            aria-label="PNG 다운로드"
            title="PNG로 저장"
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
            aria-label="공유하기"
            title="공유하기"
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
              aria-label="더보기"
              aria-expanded={moreOpen}
              title="더보기"
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
                  aria-label="메뉴 닫기"
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
                    수정
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="danger"
                    onClick={handleDelete}
                  >
                    삭제
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="diary-detail__paper" ref={paperRef}>
        <div className="diary-detail__dateline">
          <span>{formatDate(entry.date)}</span>
          <span className="diary-detail__mood">
            {MOOD_MAP[entry.mood].emoji}
          </span>
        </div>

        {entry.title && <h2 className="diary-detail__title">{entry.title}</h2>}

        {entry.imageUrl && (
          <div className="diary-detail__image">
            <img src={entry.imageUrl} alt={entry.title || `${entry.date} 그림`} />
          </div>
        )}

        <section className="diary-detail__section">
          <p className="diary-detail__content">{entry.content || ' '}</p>
        </section>
      </div>

      {shareMsg && <p className="diary-detail__share-msg">{shareMsg}</p>}
      {previewUrl && (
        <div className="diary-detail__share-preview">
          <img src={previewUrl} alt="공유용 일기 카드" />
        </div>
      )}

      {shareOpen && (
        <>
          <div className="diary-detail__picker-backdrop" onClick={closeShare} />
          <div
            className="diary-detail__picker"
            role="dialog"
            aria-label={shareStep === 'menu' ? '공유하기' : '방에 공유'}
          >
            {shareStep === 'menu' ? (
              <>
                <h3>공유하기</h3>
                <button
                  type="button"
                  className="diary-detail__picker-item"
                  disabled={sharing}
                  onClick={() => void handlePick('instagram')}
                >
                  <span className="diary-detail__picker-icon">IG</span>
                  <span>
                    <strong>인스타그램</strong>
                    <small>스토리용 카드로 공유</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="diary-detail__picker-item"
                  disabled={sharing}
                  onClick={() => void handlePick('kakao')}
                >
                  <span className="diary-detail__picker-icon">카톡</span>
                  <span>
                    <strong>카카오톡</strong>
                    <small>채팅방에 사진으로 공유</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="diary-detail__picker-item"
                  disabled={sharing}
                  onClick={() => void openRoomStep()}
                >
                  <span className="diary-detail__picker-icon">방</span>
                  <span>
                    <strong>친구 방</strong>
                    <small>참여 중인 방에 올리기</small>
                  </span>
                </button>
                <button
                  type="button"
                  className="diary-detail__picker-cancel"
                  disabled={sharing}
                  onClick={closeShare}
                >
                  취소
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
                    aria-label="공유 메뉴로"
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
                  <h3>친구 방</h3>
                  <span className="diary-detail__picker-head-spacer" />
                </div>
                <p className="diary-detail__room-hint">여러 방을 골라 한 번에 공유할 수 있어요</p>
                {roomsLoading && <p className="diary-detail__room-empty">방 목록 불러오는 중…</p>}
                {!roomsLoading && rooms.length === 0 && (
                  <p className="diary-detail__room-empty">
                    참여 중인 방이 없어요. 메뉴 → 친구 방에서 방을 만들거나 입장해 주세요.
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
                        {room.name.trim().charAt(0) || '방'}
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
                  {sharing ? '공유 중…' : '공유'}
                </button>
                <button
                  type="button"
                  className="diary-detail__picker-cancel"
                  disabled={sharing}
                  onClick={closeShare}
                >
                  취소
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
