import { GuessResult } from '@/types/gameTypes';

export const SOLVER_VERSION = '2-dwyl-20f5cc9-slate-probes-exact8';
export const SOLVER_DESCRIPTION =
  'Normal mode, fixed SLATE opener, equal word probabilities. Minimizes expected remaining candidates using candidate guesses and informative probes; exact expected-turn search over the bundled guess dictionary when 8 or fewer remain. Not NYT WordleBot or a globally optimal solver. The public-domain dictionary includes words NYT may not accept.';

export interface SolverResult {
  status: 'solved' | 'failed' | 'unavailable';
  turns: number | null;
  guesses: { word: string; feedback: GuessResult[]; remaining: number }[];
}

export function scoreGuess(guess: string, answer: string): number {
  const states = [0, 0, 0, 0, 0];
  const letters: Record<string, number> = {};
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) states[i] = 2;
    else letters[answer[i]] = (letters[answer[i]] || 0) + 1;
  }
  for (let i = 0; i < 5; i++) {
    if (states[i] !== 2 && letters[guess[i]] > 0) {
      states[i] = 1;
      letters[guess[i]]--;
    }
  }
  return states.reduce((code, state, index) => code + state * 3 ** index, 0);
}

export function feedbackCells(word: string, code: number): GuessResult[] {
  return [...word].map((letter, index) => ({
    letter,
    status: (['absent', 'present', 'correct'] as const)[
      Math.floor(code / 3 ** index) % 3
    ],
  }));
}

export class WordleSolver {
  private readonly words: string[];
  private readonly wordSet: Set<string>;
  private readonly choices = new Map<string, { word: string; cost: number }>();
  private readonly results = new Map<string, SolverResult>();

  constructor(words: string[]) {
    this.words = [
      ...new Set(
        words
          .map((word) => word.toUpperCase())
          .filter((word) => /^[A-Z]{5}$/.test(word))
      ),
    ].sort();
    this.wordSet = new Set(this.words);
  }

  private partition(
    guess: string,
    candidates: string[]
  ): Map<number, string[]> {
    const groups = new Map<number, string[]>();
    for (const candidate of candidates) {
      const code = scoreGuess(guess, candidate);
      const group = groups.get(code);
      if (group) group.push(candidate);
      else groups.set(code, [candidate]);
    }
    return groups;
  }

  private choose(candidates: string[]): { word: string; cost: number } {
    const key = candidates.join(',');
    const cached = this.choices.get(key);
    if (cached) return cached;
    if (candidates.length === 1) return { word: candidates[0], cost: 1 };
    const exact = candidates.length <= 8;
    let best = { word: candidates[0], cost: Infinity };
    const evaluate = (guess: string) => {
      const groups = this.partition(guess, candidates);
      let cost = exact ? candidates.length : 0;
      for (const [code, group] of groups) {
        if (code === 242) continue;
        if (group.length === candidates.length) return;
        cost += exact ? this.choose(group).cost : group.length ** 2;
        if (cost >= best.cost) return;
      }
      if (cost < best.cost) best = { word: guess, cost };
    };
    for (const guess of candidates) {
      evaluate(guess);
      // One answer can finish now; all others require at least one more turn.
      if (exact && best.cost === 2 * candidates.length - 1) break;
    }
    if (!exact || best.cost > 2 * candidates.length - 1) {
      const probes = exact ? this.words : this.informativeProbes(candidates);
      const possible = new Set(candidates);
      for (const guess of probes) {
        if (possible.has(guess)) continue;
        evaluate(guess);
        // A non-answer probe costs at least two turns per possible answer.
        if (exact && best.cost <= 2 * candidates.length) break;
      }
    }
    this.choices.set(key, best);
    return best;
  }

  private informativeProbes(candidates: string[]): string[] {
    const counts: Record<string, number> = {};
    for (const word of candidates) {
      for (const letter of new Set(word))
        counts[letter] = (counts[letter] || 0) + 1;
    }
    return this.words
      .map((word) => ({
        word,
        information: [...new Set(word)].reduce((sum, letter) => {
          const frequency = counts[letter] || 0;
          return sum + frequency * (candidates.length - frequency);
        }, 0),
      }))
      .sort(
        (a, b) => b.information - a.information || a.word.localeCompare(b.word)
      )
      .slice(0, 128)
      .map((item) => item.word);
  }

  solve(solution: string): SolverResult {
    const answer = solution.trim().toUpperCase();
    const cached = this.results.get(answer);
    if (cached) return cached;
    if (!this.wordSet.has(answer))
      return { status: 'unavailable', turns: null, guesses: [] };
    let candidates = this.words;
    const guesses: SolverResult['guesses'] = [];
    for (let turn = 1; turn <= 6; turn++) {
      // The target is used only to simulate feedback, never to choose the next guess.
      const word = turn === 1 ? 'SLATE' : this.choose(candidates).word;
      const code = scoreGuess(word, answer);
      candidates = candidates.filter(
        (candidate) => scoreGuess(word, candidate) === code
      );
      guesses.push({
        word,
        feedback: feedbackCells(word, code),
        remaining: candidates.length,
      });
      if (code === 242) {
        const result: SolverResult = { status: 'solved', turns: turn, guesses };
        this.results.set(answer, result);
        return result;
      }
    }
    const result: SolverResult = { status: 'failed', turns: null, guesses };
    this.results.set(answer, result);
    return result;
  }
}
