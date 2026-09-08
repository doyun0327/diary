export type NyangTicketTab = 'subscribe' | 'packs';

export const OPEN_NYANG_TICKET_EVENT = 'diary-open-nyang-ticket';

export type OpenNyangTicketDetail = {
  tab?: NyangTicketTab;
};

/** 메뉴·모달 등에서 냥 티켓 시트 열기 */
export function openNyangTicket(tab: NyangTicketTab = 'subscribe') {
  window.dispatchEvent(
    new CustomEvent<OpenNyangTicketDetail>(OPEN_NYANG_TICKET_EVENT, {
      detail: { tab },
    }),
  );
}
