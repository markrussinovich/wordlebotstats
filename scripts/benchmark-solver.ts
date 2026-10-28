import { performance } from 'node:perf_hooks';
import { WordleSolver, SOLVER_VERSION } from '../src/solver/solver';
import words from '../src/solver/data/words.json';
import frequencies from '../src/solver/data/frequencies.json';

const solver = new WordleSolver(words, frequencies.zipf, frequencies.answers);
const distribution = Array<number>(8).fill(0);
const failed: string[] = [];
const start = performance.now();
for (const answer of frequencies.answers) {
  const result = solver.solve(answer);
  distribution[result.turns ?? 7]++;
  if (result.status !== 'solved') failed.push(answer);
}
console.log(
  JSON.stringify(
    {
      version: SOLVER_VERSION,
      corpus: 'All 12Dicts-derived common answers (not the NYT answer list)',
      count: frequencies.answers.length,
      averageWithFailuresAsSeven:
        distribution.reduce((sum, count, turn) => sum + count * turn, 0) /
        frequencies.answers.length,
      distribution,
      failed,
      milliseconds: Math.round(performance.now() - start),
      penny: solver.solve('PENNY'),
    },
    null,
    2
  )
);
if (failed.length) process.exitCode = 1;
