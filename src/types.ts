export type PlankStatus = "published" | "draft" | "all";
export type PlankFilterScalar = string | number | boolean;

export interface PlankFieldFilter {
  eq?: PlankFilterScalar;
  ne?: PlankFilterScalar;
  in?: PlankFilterScalar[];
  nin?: PlankFilterScalar[];
}

export type PlankFilters = Record<string, PlankFieldFilter>;

export interface PlankParams {
  page?: number;
  limit?: number;
  status?: PlankStatus;
  sort?: string;
  order?: "asc" | "desc";
  author?: string;
  locale?: string;
  fallback?: string | string[];
  filters?: PlankFilters;
  fields?: string | string[];
  select?: string | string[];
  exclude?: string | string[];
}

export interface PlankCacheOptions {
  cache?: "force-cache" | "no-store";
  revalidate?: number;
}

export interface PlankListResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CollectionClient<T = unknown> {
  findMany(
    params?: PlankParams,
    options?: PlankCacheOptions,
  ): Promise<PlankListResponse<T>>;
  findOne(
    id: string,
    params?: Pick<
      PlankParams,
      "status" | "locale" | "fallback" | "fields" | "select" | "exclude"
    >,
    options?: PlankCacheOptions,
  ): Promise<T>;
}

export interface SingleClient<T = unknown> {
  find(
    params?: Pick<
      PlankParams,
      "status" | "locale" | "fallback" | "fields" | "select" | "exclude"
    >,
    options?: PlankCacheOptions,
  ): Promise<T>;
}

export interface PlankClient {
  collection<T = unknown>(slug: string): CollectionClient<T>;
  single<T = unknown>(slug: string): SingleClient<T>;
  fetch<T = unknown>(
    endpoint: string,
    params?: PlankParams,
    options?: PlankCacheOptions,
  ): Promise<T>;
  buildUrl(endpoint: string, params?: PlankParams): string;
}

export interface PlankClientConfig {
  url: string;
  token: string;
  defaultLocale?: string;
}

export interface PlankPreviewSyncMessage {
  source: "plank-preview";
  type: "plank.preview.sync";
  url: string;
}

export interface PlankPreviewBridgeOptions {
  allowedOrigin: string;
}

export interface NavigationItem {
  label: string;
  href: string;
  items?: NavigationItem[];
}

export interface PlankMedia {
  id: string | null;
  url: string;
  alt: string | null;
  figcaption: string | null;
  width: number | null;
  height: number | null;
}

export type PlankMediaGallery = PlankMedia[];
