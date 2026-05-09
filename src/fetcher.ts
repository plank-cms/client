import type { PlankCacheOptions, PlankParams } from "./types.js";
import { buildPlankUrl } from "./url.js";

export function createFetcher(
  baseUrl: string,
  token: string,
  defaultLocale?: string,
) {
  return async function fetchFromPlank<T = unknown>(
    endpoint: string,
    params: PlankParams = {},
    options: PlankCacheOptions = {},
  ): Promise<T> {
    const paramsCopy: PlankParams = { ...(params || {}) };
    if (
      defaultLocale &&
      (paramsCopy.locale === undefined || paramsCopy.locale === null)
    ) {
      // prefer explicit param, otherwise attach client default locale
      // @ts-ignore allow unknown key
      paramsCopy.locale = defaultLocale;
    }
    const url = buildPlankUrl(baseUrl, endpoint, paramsCopy);
    const { cache = "no-store", revalidate } = options;

    const fetchOptions: RequestInit & { next?: { revalidate: number } } = {
      headers: { Authorization: `Bearer ${token}` },
    };

    if (typeof revalidate === "number") {
      fetchOptions.next = { revalidate };
    } else {
      fetchOptions.cache = cache;
    }

    const res = await fetch(url, fetchOptions);

    if (!res.ok) {
      throw new Error(`Plank fetch failed: ${res.status} ${res.statusText}`);
    }

    return res.json() as Promise<T>;
  };
}
