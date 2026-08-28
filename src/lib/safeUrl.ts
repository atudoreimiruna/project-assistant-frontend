/**
 * Team repo and Drive URLs are free-text user input that gets rendered straight
 * into an `href`. Without a scheme check a stored `javascript:` value would run
 * for anyone who clicks the link, so treat anything that isn't plain http(s)
 * as "no link".
 */
export function safeHref(url: string | undefined | null): string | undefined {
  if (!url) return undefined;
  try {
    const { protocol } = new URL(url);
    return protocol === 'http:' || protocol === 'https:' ? url : undefined;
  } catch {
    return undefined;
  }
}
