import { useEffect, useMemo, useState } from 'react';
import { GameResult } from '@/types/gameTypes';
import { SOLVER_VERSION, SolverResult } from '@/solver/solver';

export function useSolver(games: GameResult[]) {
  const solutionsKey = useMemo(
    () =>
      JSON.stringify(
        [
          ...new Set(
            games.flatMap((game) =>
              game.solution ? [game.solution.trim().toUpperCase()] : []
            )
          ),
        ].sort()
      ),
    [games]
  );
  const [results, setResults] = useState<Record<string, SolverResult>>({});
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let worker: Worker | undefined;
    const run = async () => {
      const solutions: string[] = JSON.parse(solutionsKey);
      setError(null);
      setRunning(true);
      const key = `solver-${SOLVER_VERSION}`;
      let cache: Record<string, SolverResult> = {};
      try {
        if (typeof chrome !== 'undefined' && chrome.storage?.local) {
          cache = (await chrome.storage.local.get(key))?.[key] || {};
        }
      } catch {
        // A missing cache must not prevent computation.
      }
      if (cancelled) return;
      setResults({ ...cache });
      const missing = solutions.filter((solution) => !cache[solution]);
      if (!missing.length) {
        setRunning(false);
        return;
      }
      try {
        worker = new Worker(
          new URL('../../solver/solver.worker.ts', import.meta.url),
          { type: 'module' }
        );
        worker.onerror = () => {
          if (!cancelled) {
            setError('Solver could not run. Reload the dashboard to retry.');
            setRunning(false);
          }
          worker?.terminate();
        };
        worker.onmessage = (
          event: MessageEvent<{
            solution?: string;
            result?: SolverResult;
            complete?: boolean;
            error?: string;
          }>
        ) => {
          if (cancelled) return;
          const message = event.data;
          if (message.solution && message.result) {
            cache[message.solution] = message.result;
            setResults({ ...cache });
          }
          if (message.complete || message.error) {
            setRunning(false);
            if (message.error) setError(message.error);
            if (typeof chrome !== 'undefined' && chrome.storage?.local) {
              chrome.storage.local.set({ [key]: cache }).catch(() => {
                if (!cancelled)
                  setError(
                    'Results calculated, but the solver cache could not be saved.'
                  );
              });
            }
            worker?.terminate();
          }
        };
        worker.postMessage(missing);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : 'Solver could not start'
          );
          setRunning(false);
        }
      }
    };
    void run();
    return () => {
      cancelled = true;
      worker?.terminate();
    };
  }, [solutionsKey]);

  return { results, running, error };
}
