import { useCallback, useEffect, useState } from 'react';
import {
  DEFAULT_CHARACTER,
  normalizeCharacter,
  type CharacterProfile,
} from '../types/character';

const STORAGE_KEY = 'picture-diary-character';

function loadCharacter(): CharacterProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CHARACTER;
    return normalizeCharacter(JSON.parse(raw) as Partial<CharacterProfile>);
  } catch {
    return DEFAULT_CHARACTER;
  }
}

export function useCharacter() {
  const [character, setCharacterState] = useState<CharacterProfile>(loadCharacter);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(character));
  }, [character]);

  const setCharacter = useCallback((next: CharacterProfile) => {
    setCharacterState(normalizeCharacter(next));
  }, []);

  return { character, setCharacter };
}
