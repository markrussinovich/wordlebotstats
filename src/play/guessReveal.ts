type Colors = Pick<
  CSSStyleDeclaration,
  'backgroundColor' | 'borderColor' | 'color'
>;
type Row = {
  letters: string[];
  draft: boolean;
  scored: boolean;
  colors: Colors;
};
type Reveal = { started: number; colors: Colors; animations: Animation[] };

const duration = 500;
const stagger = 200;

export function shakeGuess(board: HTMLElement | null, index: number) {
  const row = board?.children[index] as HTMLElement | undefined;
  if (!row || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  row.getAnimations().forEach((animation) => {
    if (animation.id === 'wordle-invalid-guess') animation.cancel();
  });
  const animation = row.animate(
    [0, -5, 5, -5, 5, -3, 3, -1, 1, 0].map((offset) => ({
      transform: `translateX(${offset}px)`,
    })),
    { duration: 600, easing: 'ease-in-out' }
  );
  animation.id = 'wordle-invalid-guess';
}

export function createGuessReveal() {
  let previous: { puzzle: string; rows: Row[]; ready: boolean } | null = null;
  const reveals = new Map<number, Reveal>();
  const pops = new Map<
    number,
    { started: number; letter: string; animation?: Animation }
  >();
  const clear = () => {
    reveals.forEach((reveal) =>
      reveal.animations.forEach((animation) => animation.cancel())
    );
    reveals.clear();
    pops.forEach((pop) => pop.animation?.cancel());
    pops.clear();
  };
  return (board: HTMLElement | null) => {
    if (!board) {
      clear();
      previous = null;
      return;
    }
    const puzzle = `${board.dataset.date}:${board.getAttribute('aria-label')}`;
    const cells = Array.from(
      board.children,
      (row) => Array.from(row.children) as HTMLElement[]
    );
    const rows = cells.map((row) => {
      const style = getComputedStyle(row[0]);
      return {
        letters: row.map((cell) => cell.textContent?.trim() || ''),
        draft:
          row.length === 5 && row.every((cell) => cell.dataset.state === 'tbd'),
        scored:
          row.length === 5 &&
          row.every((cell) =>
            ['correct', 'present', 'absent'].includes(cell.dataset.state || '')
          ),
        colors: {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          color: style.color,
        },
      };
    });
    const now = performance.now();
    const ready = board.dataset.ready === 'true';
    if (previous?.puzzle !== puzzle) clear();
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      clear();
      previous = { puzzle, rows, ready };
      return;
    }
    if (previous?.puzzle === puzzle) {
      const oldRows = previous.rows;
      rows.forEach((row, index) => {
        const old = oldRows[index];
        if (ready && previous?.ready) {
          cells[index].forEach((cell, column) => {
            const letter = row.letters[column];
            if (cell.dataset.state === 'tbd' && letter && !old?.letters[column])
              pops.set(index * 5 + column, { started: now, letter });
          });
        }
        if (
          old?.draft &&
          row.scored &&
          old.letters.every((letter, column) => letter === row.letters[column])
        ) {
          reveals.set(index, {
            started: now,
            colors: old.colors,
            animations: [],
          });
        }
      });
    }
    previous = { puzzle, rows, ready };
    pops.forEach((pop, index) => {
      const cell = cells[Math.floor(index / 5)]?.[index % 5];
      const elapsed = now - pop.started;
      if (
        !cell ||
        cell.dataset.state !== 'tbd' ||
        cell.textContent?.trim() !== pop.letter ||
        elapsed >= 100
      ) {
        pop.animation?.cancel();
        pops.delete(index);
        return;
      }
      if (
        pop.animation?.effect instanceof KeyframeEffect &&
        pop.animation.effect.target === cell
      )
        return;
      pop.animation?.cancel();
      const animation = cell.animate(
        [
          { transform: 'scale(1)' },
          { transform: 'scale(1.1)' },
          { transform: 'scale(1)' },
        ],
        { duration: 100, easing: 'ease-in-out' }
      );
      animation.id = 'wordle-letter-pop';
      animation.currentTime = elapsed;
      pop.animation = animation;
    });
    reveals.forEach((reveal, index) => {
      const elapsed = now - reveal.started;
      if (elapsed >= duration + stagger * 4) {
        reveal.animations.forEach((animation) => animation.cancel());
        reveals.delete(index);
        return;
      }
      cells[index].forEach((cell, column) => {
        const old = reveal.animations[column];
        if (old?.effect instanceof KeyframeEffect && old.effect.target === cell)
          return;
        old?.cancel();
        const style = getComputedStyle(cell);
        const colors = {
          backgroundColor: style.backgroundColor,
          borderColor: style.borderColor,
          color: style.color,
        };
        const animation = cell.animate(
          [
            { ...reveal.colors, transform: 'rotateX(0deg)', offset: 0 },
            { ...reveal.colors, transform: 'rotateX(90deg)', offset: 0.499 },
            { ...colors, transform: 'rotateX(90deg)', offset: 0.5 },
            { ...colors, transform: 'rotateX(0deg)', offset: 1 },
          ],
          {
            duration,
            delay: column * stagger,
            easing: 'ease-in-out',
            fill: 'backwards',
          }
        );
        animation.id = 'wordle-guess-reveal';
        // Preserve reveal progress when the popup replaces its board during typing.
        animation.currentTime = elapsed;
        reveal.animations[column] = animation;
      });
    });
  };
}
