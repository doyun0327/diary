import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomMember } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import './RoomMemberAvatars.css';

const VISIBLE_MAX = 7;
const POKE_COOLDOWN_MS = 4000;

type RoomMemberAvatarsProps = {
  roomId: string;
  members: RoomMember[];
  currentUserId?: string | null;
  showPokeCoach?: boolean;
  onDismissPokeCoach?: () => void;
};

function memberAvatarSrc(member: RoomMember): string | null {
  const url = member.avatarUrl?.trim();
  return url || null;
}

function memberInitial(member: RoomMember): string {
  return (member.nickname.trim() || '?').slice(0, 1).toUpperCase();
}

function RoomMemberAvatars({
  roomId,
  members,
  currentUserId,
  showPokeCoach = false,
  onDismissPokeCoach,
}: RoomMemberAvatarsProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [pokingId, setPokingId] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastPokeAt = useRef<Map<string, number>>(new Map());
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!expanded) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setExpanded(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [expanded]);

  useEffect(() => {
    return () => {
      if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    };
  }, []);

  if (members.length === 0) return null;

  const showToast = (msg: string) => {
    setToast(msg);
    if (toastTimer.current != null) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 1800);
  };

  const poke = async (member: RoomMember) => {
    if (!currentUserId) {
      showToast(t('rooms.pokeNeedLogin'));
      return;
    }
    if (member.userId === currentUserId) {
      showToast(t('rooms.pokeSelf'));
      return;
    }
    const now = Date.now();
    const prev = lastPokeAt.current.get(member.userId) ?? 0;
    if (now - prev < POKE_COOLDOWN_MS) {
      showToast(t('rooms.pokeWait'));
      return;
    }
    if (pokingId) return;

    setPokingId(member.userId);
    try {
      await roomsApi.pokeMember(roomId, member.userId, {
        title: t('rooms.pokePushTitle'),
        body: t('rooms.pokePushBody', { name: member.nickname }),
      });
      lastPokeAt.current.set(member.userId, Date.now());
      onDismissPokeCoach?.();
      showToast(t('rooms.pokeSent'));
    } catch (err) {
      showToast(err instanceof Error ? err.message : t('rooms.pokeFail'));
    } finally {
      setPokingId(null);
    }
  };

  const overflow = members.length > VISIBLE_MAX;
  const visible = overflow ? members.slice(0, VISIBLE_MAX) : members;
  const hiddenCount = members.length - VISIBLE_MAX;

  return (
    <div className="room-members" ref={rootRef}>
      {showPokeCoach && (
        <div className="room-members__coach" role="status">
          <p>{t('rooms.coach.poke')}</p>
          <button
            type="button"
            className="room-members__coach-dismiss"
            aria-label={t('common.close')}
            onClick={() => onDismissPokeCoach?.()}
          >
            ×
          </button>
        </div>
      )}
      <div className="room-members__stack" role="list" aria-label={t('rooms.membersAria')}>
        {visible.map((member) => (
          <button
            key={member.userId}
            type="button"
            className={`room-members__avatar${pokingId === member.userId ? ' is-poking' : ''}`}
            role="listitem"
            title={t('rooms.pokeHint', { name: member.nickname })}
            aria-label={t('rooms.pokeAria', { name: member.nickname })}
            disabled={pokingId === member.userId}
            onClick={() => void poke(member)}
          >
            {memberAvatarSrc(member) ? (
              <img src={memberAvatarSrc(member)!} alt="" />
            ) : (
              <span className="room-members__initial" aria-hidden>
                {memberInitial(member)}
              </span>
            )}
          </button>
        ))}
        {overflow && (
          <button
            type="button"
            className="room-members__more"
            aria-label={t('rooms.membersMoreAria', { n: hiddenCount })}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            +{hiddenCount}
          </button>
        )}
      </div>

      {expanded && overflow && (
        <div className="room-members__panel" role="dialog" aria-label={t('rooms.membersPanelAria')}>
          <ul className="room-members__list">
            {members.map((member) => (
              <li key={member.userId}>
                <button
                  type="button"
                  className={`rooms__member room-members__row-btn${
                    pokingId === member.userId ? ' is-poking' : ''
                  }`}
                  onClick={() => void poke(member)}
                  disabled={pokingId === member.userId}
                  aria-label={t('rooms.pokeAria', { name: member.nickname })}
                >
                  <span className="rooms__member-avatar">
                    {memberAvatarSrc(member) ? (
                      <img src={memberAvatarSrc(member)!} alt="" />
                    ) : (
                      memberInitial(member)
                    )}
                  </span>
                  <span className="rooms__member-name">{member.nickname}</span>
                  <span className="room-members__poke-label">{t('rooms.pokeAction')}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {toast && (
        <div className="room-members__toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

export default RoomMemberAvatars;
