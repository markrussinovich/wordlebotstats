import { GuessResult } from '@/types/gameTypes';

export const SOLVER_VERSION = '3-12dicts-5ef55f9-wordfreq-372f6db-raise';
export const SOLVER_OPENER = 'RAISE';
export const SOLVER_DESCRIPTION =
  'Normal mode, fixed RAISE opener, common answers from public-domain 12Dicts and probabilities from wordfreq. Uses entropy-based expected-turn estimates and exact search when 8 or fewer candidates remain or two turns are left, prioritizing solving within six turns. Falls back to the wider dictionary when feedback rules out common answers. Not NYT WordleBot or a globally optimal solver; results may differ.';

export interface SolverResult {
  status: 'solved' | 'failed' | 'unavailable';
  turns: number | null;
  guesses: { word: string; feedback: GuessResult[]; remaining: number }[];
}

export function scoreGuess(guess: string, answer: string): number {
  let code = 0;
  let greens = 0;
  let place = 1;
  for (let i = 0; i < 5; i++) {
    if (guess[i] === answer[i]) {
      greens |= 1 << i;
      code += 2 * place;
    }
    place *= 3;
  }
  let used = greens;
  place = 1;
  for (let i = 0; i < 5; i++) {
    if (!(greens & (1 << i))) {
      for (let j = 0; j < 5; j++) {
        if (!(used & (1 << j)) && guess[i] === answer[j]) {
          used |= 1 << j;
          code += place;
          break;
        }
      }
    }
    place *= 3;
  }
  return code;
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
  private readonly probes: string[];
  private readonly answers: Set<string>;
  private readonly weights = new Map<string, number>();
  private readonly choices = new Map<
    string,
    { word: string; cost: number; solved: number }
  >();
  private readonly results = new Map<string, SolverResult>();

  constructor(
    words: string[],
    frequencies?: Record<string, number>,
    answers?: string[]
  ) {
    this.words = [
      ...new Set(
        words
          .map((word) => word.toUpperCase())
          .filter((word) => /^[A-Z]{5}$/.test(word))
      ),
    ].sort();
    this.wordSet = new Set(this.words);
    for (const word of this.words) {
      const zipf = frequencies?.[word] ?? 0;
      // Saturate common-word probabilities; corpus frequency is not answer frequency.
      this.weights.set(
        word,
        frequencies ? Math.max(0.001, 1 / (1 + Math.exp(-4 * (zipf - 3.5)))) : 1
      );
    }
    this.answers = new Set(
      answers?.map((word) => word.toUpperCase()) ?? this.words
    );
    this.probes = this.words.filter((word) => this.answers.has(word));
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

  private mass(candidates: string[]): number {
    return candidates.reduce((sum, word) => sum + this.weights.get(word)!, 0);
  }

  private choose(
    candidates: string[],
    turnsLeft: number
  ): { word: string; cost: number; solved: number } {
    const key = `${turnsLeft}:${candidates.join(',')}`;
    const cached = this.choices.get(key);
    if (cached) return cached;
    const ranked = [...candidates].sort(
      (a, b) =>
        this.weights.get(b)! - this.weights.get(a)! || a.localeCompare(b)
    );
    const total = this.mass(candidates);
    if (turnsLeft === 1 || candidates.length === 1)
      return {
        word: ranked[0],
        cost: total,
        solved: this.weights.get(ranked[0])!,
      };
    const exact = candidates.length <= 8 || turnsLeft === 2;
    let best = { word: ranked[0], cost: Infinity, solved: -1 };
    const evaluate = (guess: string) => {
      const groups = this.partition(guess, candidates);
      let cost = exact ? total : 0;
      let solved = 0;
      for (const [code, group] of groups) {
        const mass = this.mass(group);
        if (code === 242) {
          if (exact) solved += mass;
          continue;
        }
        if (group.length === candidates.length) return;
        if (exact) {
          const next = this.choose(group, turnsLeft - 1);
          cost += next.cost;
          solved += next.solved;
        } else {
          const logs = group.reduce((sum, word) => {
            const weight = this.weights.get(word)!;
            return sum + weight * Math.log2(weight);
          }, 0);
          // Estimate remaining guesses from conditional entropy, not word count.
          cost += mass + (mass * Math.log2(mass) - logs) / 2;
        }
        if ((!exact || best.solved >= total - 1e-9) && cost >= best.cost)
          return;
      }
      if (
        solved > best.solved + 1e-9 ||
        (Math.abs(solved - best.solved) <= 1e-9 && cost < best.cost - 1e-9)
      )
        best = { word: guess, cost, solved };
    };
    const lowerBound = 2 * total - this.weights.get(ranked[0])!;
    for (const guess of ranked) {
      evaluate(guess);
      if (
        exact &&
        best.solved >= total - 1e-9 &&
        best.cost <= lowerBound + 1e-9
      )
        break;
    }
    if (!exact || best.solved < total - 1e-9 || best.cost > 2 * total + 1e-9) {
      const probes = exact ? this.probes : this.informativeProbes(candidates);
      const possible = new Set(candidates);
      for (const guess of probes) {
        if (possible.has(guess)) continue;
        evaluate(guess);
        if (
          exact &&
          best.solved >= total - 1e-9 &&
          best.cost <= 2 * total + 1e-9
        )
          break;
      }
    }
    this.choices.set(key, best);
    return best;
  }

  private informativeProbes(candidates: string[]): string[] {
    const counts: Record<string, number> = {};
    const total = this.mass(candidates);
    for (const word of candidates) {
      for (const letter of new Set(word))
        counts[letter] = (counts[letter] || 0) + this.weights.get(word)!;
    }
    return this.probes
      .map((word) => ({
        word,
        information: [...new Set(word)].reduce((sum, letter) => {
          const frequency = counts[letter] || 0;
          return sum + frequency * (total - frequency);
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
      const common = candidates.filter((candidate) =>
        this.answers.has(candidate)
      );
      const word =
        turn === 1
          ? SOLVER_OPENER
          : this.choose(common.length ? common : candidates, 7 - turn).word;
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
