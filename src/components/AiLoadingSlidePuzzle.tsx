import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import './AiLoadingSlidePuzzle.css';

const GRID = 3;
const TILE_COUNT = GRID * GRID;
const EMPTY = TILE_COUNT - 1;
const PUZZLE_IMAGE = '/brand/sketch-book-writing.png';

function solvedBoard() {
  return Array.from({ length: TILE_COUNT }, (_, index) => index);
}

function neighbors(index: number) {
  const row = Math.floor(index / GRID);
  const col = index % GRID;
  const next: number[] = [];
  if (row > 0) next.push(index - GRID);
  if (row < GRID - 1) next.push(index + GRID);
  if (col > 0) next.push(index - 1);
  if (col < GRID - 1) next.push(index + 1);
  return next;
}

function shuffleBoard() {
  let board = solvedBoard();
  let emptyIndex = EMPTY;
  const moves = 36 + Math.floor(Math.random() * 24);

  for (let i = 0; i < moves; i += 1) {
    const options = neighbors(emptyIndex);
    const pick = options[Math.floor(Math.random() * options.length)] ?? emptyIndex;
    board = board.map((value, idx) => {
      if (idx === emptyIndex) return board[pick];
      if (idx === pick) return board[emptyIndex];
      return value;
    });
    emptyIndex = pick;
  }

  if (board.every((value, index) => value === index)) {
    return shuffleBoard();
  }
  return board;
}

function isSolved(board: number[]) {
  return board.every((value, index) => value === index);
}

function tileBackground(value: number) {
  const col = value % GRID;
  const row = Math.floor(value / GRID);
  const step = GRID > 1 ? 100 / (GRID - 1) : 0;
  return {
    backgroundImage: `url(${PUZZLE_IMAGE})`,
    backgroundSize: `${GRID * 100}% ${GRID * 100}%`,
    backgroundPosition: `${col * step}% ${row * step}%`,
  };
}

export default function AiLoadingSlidePuzzle() {
  const { t } = useTranslation();
  const [board, setBoard] = useState(() => shuffleBoard());
  const solved = useMemo(() => isSolved(board), [board]);

  const tryMove = useCallback((index: number) => {
    setBoard((prev) => {
      const emptyIndex = prev.indexOf(EMPTY);
      if (!neighbors(emptyIndex).includes(index)) return prev;

      const next = [...prev];
      next[emptyIndex] = next[index];
      next[index] = EMPTY;
      return next;
    });
  }, []);

  return (
    <div className="ai-slide-puzzle">
      <div className="ai-slide-puzzle__hud">
        <p className="ai-slide-puzzle__hint">
          {solved ? t('write.ai.puzzleDone') : t('write.ai.puzzleHint')}
        </p>
      </div>
      <div className="ai-slide-puzzle__field">
        <div className="ai-slide-puzzle__grid" role="group" aria-label={t('write.ai.puzzleAria')}>
          {board.map((value, index) => {
            if (value === EMPTY) {
              return <span key={`empty-${index}`} className="ai-slide-puzzle__tile ai-slide-puzzle__tile--empty" />;
            }
            return (
              <button
                key={`${index}-${value}`}
                type="button"
                className="ai-slide-puzzle__tile"
                style={tileBackground(value)}
                onPointerDown={(event) => {
                  event.preventDefault();
                  tryMove(index);
                }}
                aria-label={t('write.ai.puzzleTile', { n: value + 1 })}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
