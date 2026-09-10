import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RoomMember } from '../types/room';
import * as roomsApi from '../api/roomsApi';
import RoomSafetyModal, { type SafetyTarget } from './RoomSafetyModal';
import {
  isUserBlocked,
  subscribeBlockedUsers,
} from '../utils/blockedUsers';
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
  const [safetyTarget, setSafetyTarget] = useState<SafetyTarget | null>(null);
  const [blockTick, setBlockTick] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastPokeAt = useRef<Map<string, number>>(new Map());
  const toastTimer = useRef<number | null>(null);

  useEffect(() => subscribeBlockedUsers(() => setBlockTick((n) => n + 1)), []);

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

  const activeMembers = members.filter((m) => {
    void blockTick;
    if (!currentUserId) return true;
    if (m.userId === currentUserId) return true;
    return !isUserBlocked(m.userId);
  });

  if (activeMembers.length === 0) return null;

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
    if (member.withdrawn) {
      showToast(t('rooms.pokeWithdrawn'));
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
      const pokerName =
        activeMembers.find((m) => m.userId === currentUserId)?.nickname.trim() ||
        t('common.anonymous');
      await roomsApi.pokeMember(roomId, member.userId, {
        title: t('rooms.pokePushTitle', { name: pokerName }),
        body: t('rooms.pokePushBody'),
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

  const overflow = activeMembers.length > VISIBLE_MAX;
  const visible = overflow ? activeMembers.slice(0, VISIBLE_MAX) : activeMembers;
  const hiddenMembers = overflow ? activeMembers.slice(VISIBLE_MAX) : [];

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
            aria-label={t('rooms.membersMoreAria', { n: hiddenMembers.length })}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            ···
          </button>
        )}
      </div>

      {expanded && hiddenMembers.length > 0 && (
        <div className="room-members__panel" role="dialog" aria-label={t('rooms.membersPanelAria')}>
          <ul className="room-members__list">
            {hiddenMembers.map((member) => {
              const isSelf = Boolean(currentUserId && member.userId === currentUserId);
              return (
                <li key={member.userId} className="room-members__row">
                  <button
                    type="button"
                    className={`rooms__member room-members__row-btn${
                      pokingId === member.userId ? ' is-poking' : ''
                    }`}
                    onClick={() => void poke(member)}
                    disabled={pokingId === member.userId || isSelf}
                    aria-label={
                      isSelf
                        ? member.nickname
                        : t('rooms.pokeAria', { name: member.nickname })
                    }
                  >
                    <span className="rooms__member-avatar">
                      {memberAvatarSrc(member) ? (
                        <img src={memberAvatarSrc(member)!} alt="" />
                      ) : (
                        memberInitial(member)
                      )}
                    </span>
                    <span className="rooms__member-name">{member.nickname}</span>
                    {!isSelf ? (
                      <span className="room-members__poke-label">{t('rooms.pokeAction')}</span>
                    ) : (
                      <span className="room-members__poke-label">{t('rooms.safety.you')}</span>
                    )}
                  </button>
                  {!isSelf ? (
                    <button
                      type="button"
                      className="room-members__safety"
                      aria-label={t('rooms.safety.moreAria')}
                      onClick={() =>
                        setSafetyTarget({
                          roomId,
                          userId: member.userId,
                          nickname: member.nickname,
                          kind: 'user',
                        })
                      }
                    >
                      ···
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {toast && (
        <div className="room-members__toast" role="status">
          {toast}
        </div>
      )}

      {safetyTarget && (
        <RoomSafetyModal
          target={safetyTarget}
          onClose={() => setSafetyTarget(null)}
          onBlocked={() => setBlockTick((n) => n + 1)}
          onDone={showToast}
        />
      )}
    </div>
  );
}

export default RoomMemberAvatars;
