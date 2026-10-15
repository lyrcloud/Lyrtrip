// After a deploy, a tab still running the previous build can fail to load one of its code files.
// Reloading picks up the new build; the timestamp stops a reload loop if the error is something else.
const KEY = 'lyrtrip:stale-build-reload';

export const isStaleBuildError = (error: unknown) =>
  /ChunkLoadError|Loading (CSS )?chunk|dynamically imported module|Importing a module script failed/i.test(
    `${(error as Error)?.name ?? ''} ${(error as Error)?.message ?? error ?? ''}`);

export function reloadForNewBuild(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch { /* storage unavailable: reload once anyway */ }
  window.location.reload();
  return true;
}
