/** 완전 탈퇴 회원 방 표시명 (서버 nickname 오버라이드 + i18n) */
export function roomAuthorLabel(
  nickname: string | null | undefined,
  withdrawn: boolean | undefined,
  t: (key: string) => string,
): string {
  if (withdrawn) {
    return t('rooms.withdrawnMember');
  }
  const name = (nickname ?? '').trim();
  return name || '?';
}
