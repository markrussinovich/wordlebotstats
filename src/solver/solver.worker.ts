import words from './data/words.json';
import { WordleSolver } from './solver';

const solver = new WordleSolver(words);
self.onmessage = (event: MessageEvent<string[]>) => {
  try {
    for (const solution of event.data) {
      self.postMessage({ solution, result: solver.solve(solution) });
    }
    self.postMessage({ complete: true });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'Solver failed',
    });
  }
};
