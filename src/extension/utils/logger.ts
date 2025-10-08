// Central logging utility. Controlled via build env VITE_DEBUG_LOGS or
// runtime localStorage flag WORDLE_DEBUG_LOGS. Also exposes global helpers.
type LogFn = (...args: any[]) => void;

const g: any = (globalThis as any);

function resolveEnvFlag(): boolean {
  // Prefer Vite's import.meta.env, fall back to process.env when bundled differently
  // (Deliberately avoid using the keyword 'import' in a typeof expression; not valid syntax.)
  try {
    if (typeof import.meta !== 'undefined' && (import.meta as any)?.env) {
      const val = (import.meta as any).env.VITE_DEBUG_LOGS;
      if (val != null) return val === 'true' || val === true;
    }
  } catch { /* ignore */ }
  try {
    if (typeof process !== 'undefined' && (process as any)?.env) {
      const v = (process as any).env.VITE_DEBUG_LOGS;
      if (v != null) return v === 'true';
    }
  } catch { /* ignore */ }
  return false;
}

function resolveStorageFlag(): boolean {
  try { return localStorage.getItem('WORDLE_DEBUG_LOGS') === 'true'; } catch { return false; }
}

let enabled = resolveEnvFlag() || resolveStorageFlag();

export function setDebugLogging(on: boolean) {
  enabled = on;
  try { localStorage.setItem('WORDLE_DEBUG_LOGS', on ? 'true' : 'false'); } catch {}
}

g.WORDLE_ENABLE_DEBUG_LOGS = () => setDebugLogging(true);
g.WORDLE_DISABLE_DEBUG_LOGS = () => setDebugLogging(false);

function prefix(): string { return `[${new Date().toISOString()}]`; }

function build(method: 'log'|'warn'|'error'): LogFn {
  return (...args: any[]) => { if (enabled) (console as any)[method](prefix(), ...args); };
}

export const logger = {
  enabled: () => enabled,
  log: build('log'),
  warn: build('warn'),
  error: build('error')
};

export default logger;
