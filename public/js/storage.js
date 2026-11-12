// localStorage wrappers that never throw (private mode, blocked storage, bad values).
export const BEST_KEY = 'nekobako:best';
export const MUTED_KEY = 'nekobako:muted';

export function loadBest(storage) {
  try {
    const value = Number(storage?.getItem(BEST_KEY));
    return Number.isSafeInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

export function saveBest(storage, score) {
  try {
    storage?.setItem(BEST_KEY, String(score));
    return true;
  } catch {
    return false;
  }
}

export function loadMuted(storage) {
  try {
    return storage?.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMuted(storage, muted) {
  try {
    storage?.setItem(MUTED_KEY, muted ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}
