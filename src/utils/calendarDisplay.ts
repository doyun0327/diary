import { useSyncExternalStore } from 'react';

export type CalendarDisplayMode = 'emoji' | 'drawing';

export const CALENDAR_DISPLAY_STORAGE_KEY = 'picture-diary-calendar-display';
export const CALENDAR_DISPLAY_CHANGE_EVENT = 'calendar-display-change';

export function getStoredCalendarDisplayMode(): CalendarDisplayMode {
  try {
    const raw = localStorage.getItem(CALENDAR_DISPLAY_STORAGE_KEY);
    if (raw === 'emoji' || raw === 'drawing') return raw;
  } catch {
    // ignore
  }
  return 'emoji';
}

export function applyCalendarDisplayMode(mode: CalendarDisplayMode) {
  try {
    localStorage.setItem(CALENDAR_DISPLAY_STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  window.dispatchEvent(new Event(CALENDAR_DISPLAY_CHANGE_EVENT));
}

function subscribeCalendarDisplay(onStoreChange: () => void) {
  window.addEventListener(CALENDAR_DISPLAY_CHANGE_EVENT, onStoreChange);
  window.addEventListener('storage', onStoreChange);
  return () => {
    window.removeEventListener(CALENDAR_DISPLAY_CHANGE_EVENT, onStoreChange);
    window.removeEventListener('storage', onStoreChange);
  };
}

export function useCalendarDisplayMode(): CalendarDisplayMode {
  return useSyncExternalStore(
    subscribeCalendarDisplay,
    getStoredCalendarDisplayMode,
    () => 'emoji' as CalendarDisplayMode,
  );
}
