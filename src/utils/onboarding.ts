const CHARACTER_DONE_KEY = 'picture-diary-onboarding-character-done';
const CHARACTER_COACH_KEY = 'picture-diary-onboarding-character-coach';
const AI_COACH_KEY = 'picture-diary-onboarding-ai-coach';

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function writeFlag(key: string) {
  try {
    localStorage.setItem(key, '1');
  } catch {
    // ignore
  }
}

export function isCharacterSetupDone(): boolean {
  return readFlag(CHARACTER_DONE_KEY);
}

export function markCharacterSetupDone() {
  writeFlag(CHARACTER_DONE_KEY);
}

export function isCharacterCoachSeen(): boolean {
  return readFlag(CHARACTER_COACH_KEY);
}

export function markCharacterCoachSeen() {
  writeFlag(CHARACTER_COACH_KEY);
}

export function isAiCoachSeen(): boolean {
  return readFlag(AI_COACH_KEY);
}

export function markAiCoachSeen() {
  writeFlag(AI_COACH_KEY);
}
