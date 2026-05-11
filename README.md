# Plank CMS - Client

Client for the [Plank CMS](https://github.com/plank-cms/plank) headless API. Framework-agnostic and compatible with Next.js App Router, Astro, or any project with `fetch`.

## Installation

```bash
pnpm add @plank-cms/client
```

## Setup

Create a client instance and export it for reuse across your project:

```ts
// lib/plank.ts
import { createPlankClient } from "@plank-cms/client";

const plank = createPlankClient({
  url: process.env.PLANK_URL!,
  token: process.env.PLANK_TOKEN!,
  // optional: attach a default locale to all public API requests when not overridden
  // defaultLocale: 'en',
});

export default plank;
```

```bash
# .env.local
PLANK_URL=https://your-plank-instance.com
PLANK_TOKEN=plank_a1b2c3d4...
```

## Usage

### Collections

Fetch a list of entries from a collection type:

```ts
import plank from "@/lib/plank";

const { data, total, page, limit } = await plank.collection("posts").findMany();
```

Requests are fresh by default. The client uses `fetch(..., { cache: "no-store" })` unless you
explicitly pass cache options yourself.

With params:

```ts
const { data } = await plank.collection("posts").findMany({
  page: 1,
  limit: 9,
  status: "published",
  // any field defined in your content type works as an equality filter
  category: "news",
});
```

Locale / per-request override:

```ts
// if you configured a `defaultLocale` on the client, you can still override it per-request
const { data: esPosts } = await plank
  .collection("posts")
  .findMany({ locale: "es" });
const { data: frPosts } = await plank
  .collection("posts")
  .findMany({ locale: "fr" });
```

Fetch a single entry by ID:

```ts
const post = await plank.collection("posts").findOne("entry-id");
```

Fetch a single entry with extra public API params:

```ts
const localizedPost = await plank.collection("posts").findOne("entry-id", {
  status: "published",
  locale: "es",
  fallback: "en",
}, {
  cache: "no-store",
});
```

### Single Types

```ts
const homepage = await plank.single("homepage").find();
```

With public API params:

```ts
const homepage = await plank.single("homepage").find({
  status: "published",
  locale: "es",
  fallback: "en",
});
```

### Filtering and sorting

Collection queries accept the built-in public API params plus a `filters` object for field-based
querying.

```ts
const { data } = await plank.collection("posts").findMany({
  status: "published",
  sort: "published_at",
  order: "desc",
  locale: "es",
  fallback: "en",
  filters: {
    category: { eq: "news" },
    featured: { eq: true },
  },
});
```

Low-level fetch works the same way:

```ts
const posts = await plank.fetch("/posts", {
  limit: 5,
  sort: "created_at",
  order: "desc",
  author: "alejandro-martir",
});
```

### Authors

Fetch a public author profile by slug:

```ts
const author = await plank.fetch("/authors/alejandro-martir");
```

Filter any collection by public author slug:

```ts
const { data } = await plank.collection("posts").findMany({
  author: "alejandro-martir",
  status: "published",
});
```

Public entries may also include `author.slug` and `editor.slug` when those objects are present in
the API response.

Use `filters[field][operator]` semantics through a plain object:

```ts
const { data } = await plank.collection("categories").findMany({
  filters: {
    slug: {
      in: ["design", "motion", "branding"],
      nin: ["internal", "archived"],
    },
  },
});

const featuredPosts = await plank.collection("posts").findMany({
  status: "published",
  filters: {
    featured: { eq: true },
    category: { ne: "drafts" },
  },
});
```

Build the public API URL without fetching:

```ts
const url = plank.buildUrl("/posts", {
  status: "published",
  sort: "published_at",
  order: "desc",
  category: "news",
});
// https://your-plank-instance.com/api/posts?status=published&sort=published_at&order=desc&category=news
```

### Field selection

Use `fields` or `select` to include only specific top-level serialized fields:

```ts
const { data } = await plank.collection("posts").findMany({
  status: "published",
  fields: ["id", "title", "slug", "cover"],
});
```

```ts
const post = await plank.collection("posts").findOne("entry-id", {
  select: ["id", "title", "cover"],
});
```

Exclude specific top-level fields from the serialized response:

```ts
const { data } = await plank.collection("posts").findMany({
  status: "published",
  exclude: ["body", "author", "editor"],
});
```

Works for collection items, single types, and single-entry fetches:

```ts
const post = await plank.collection("posts").findOne(
  "entry-id",
  {
    fields: ["id", "title", "cover", "published_at"],
  },
  { cache: "no-store" },
);

const homepage = await plank.single("homepage").find({
  exclude: ["updated_at", "editor"],
});
```

Notes:

- `fields`, `select`, and `exclude` are top-level only.
- They apply to the public serialized response shape, not raw database columns.
- `select` is an alias of `fields`.
- `filters` is the standard filtering API.
- Supported operators are `eq`, `ne`, `in`, and `nin`.

You can still narrow the response locally with TypeScript when useful:

```ts
type PostCard = {
  id: string;
  title: string;
  slug: string;
  cover: PlankMedia | null;
};

const { data } = await plank.collection<PostCard>("posts").findMany({
  status: "published",
  fields: ["id", "title", "slug", "cover"],
});
```

### Drafts

```ts
const draft = await plank
  .collection("posts")
  .findOne("entry-id", { status: "draft" }, { cache: "no-store" });
// or with status
const drafts = await plank
  .collection("posts")
  .findMany({ status: "draft" }, { cache: "no-store" });
```

### Draft preview sync webhook

The recommended preview sync integration in v1 is:

1. Plank opens your frontend preview route.
2. Plank sends a server-side webhook after each save.
3. Your frontend stores the latest preview sync signal.
4. The already-open preview tab polls that signal and reloads itself when it changes.

This is the only supported preview-sync flow in v1.

There is no browser bridge, no `postMessage`, and no origin-matching setup in the client package.
The client only helps you validate the webhook payload. Your frontend is responsible for storing
the sync signal and reloading the preview tab.

In Plank, configure these preview settings:

- `Enable preview integration`
- `Preview URL template`
- `Preview sync webhook URL`

After each entry save, Plank will POST a preview sync payload to your frontend webhook URL while
preview is enabled.

Webhook payload:

```ts
type PlankPreviewSyncWebhookPayload = {
  event: "preview.sync";
  content_type: string;
  entry_id: string;
  status: string | null;
  slug: string | null;
  preview_url: string | null;
  triggered_at: string;
};
```

The client exposes a type guard for validating this payload:

```ts
import { isPlankPreviewSyncWebhookPayload } from "@plank-cms/client";
```

This is the only preview-sync helper exposed by the client in v1.

#### Frontend implementation contract

Your frontend is expected to implement these pieces:

1. A preview route such as `/draft/[contentType]/[slug]` that fetches directly from Plank with
   `cache: "no-store"`.
2. A webhook route that receives `preview.sync`, validates it, and stores the latest sync state.
3. A lightweight polling endpoint that returns the latest stored sync state for a given preview.
4. A small browser component on the preview page that polls that endpoint and reloads when the
   state changes.

Recommended storage for the sync state:

- Redis
- database table
- durable KV store

Avoid relying on process memory for production because serverless and multi-instance deployments do
not guarantee shared state.

#### Official browser refresh strategy for v1

Use polling.

Polling is the official recommendation for v1 because it is framework-agnostic, easy to implement,
and does not require WebSockets or SSE infrastructure.

The browser flow should be:

1. Open `/draft/[contentType]/[slug]` from Plank.
2. Poll your own `/api/plank/preview-state/[contentType]/[slug]` endpoint every 1-3 seconds.
3. Compare the latest `triggered_at` value with the last one seen in the browser.
4. When it changes, navigate to `preview_url` if it differs from the current URL.
5. Otherwise call `window.location.reload()`.

#### Next.js App Router example

Use a route that includes both the content type and the entry slug. This avoids collisions when
different collection types can reuse the same slug.

In Plank, a good matching template is:

```text
https://frontend.example.com/draft/{contentType}/{slug}
```

Create a draft preview route such as `app/draft/[contentType]/[slug]/page.tsx`:

```ts
import PreviewAutoRefresh from "@/components/PreviewAutoRefresh";
import plank from "@/lib/plank";
import { notFound } from "next/navigation";

export default async function DraftPage({
  params,
}: {
  params: Promise<{ contentType: string; slug: string }>;
}) {
  const { contentType, slug } = await params;

  const { data } = await plank.collection(contentType).findMany(
    {
      limit: 1,
      status: "all",
      filters: {
        slug: { eq: slug },
      },
    },
    { cache: "no-store" },
  );

  const post = data[0] ?? null;

  if (!post) notFound();

  return (
    <>
      <PreviewAutoRefresh contentType={contentType} slug={slug} />
      <article>{post.title}</article>
    </>
  );
}
```

Create a durable store for preview sync state.

This example uses an in-memory map to keep the example compact. Replace it with Redis, your
database, or another shared store before using it in production.

```ts
// lib/preview-sync-store.ts
export type PreviewSyncState = {
  previewUrl: string | null;
  triggeredAt: string;
};

const previewSyncStore = new Map<string, PreviewSyncState>();

export function buildPreviewSyncKey(contentType: string, slug: string) {
  return `${contentType}:${slug}`;
}

export async function setPreviewSyncState(
  contentType: string,
  slug: string,
  state: PreviewSyncState,
) {
  previewSyncStore.set(buildPreviewSyncKey(contentType, slug), state);
}

export async function getPreviewSyncState(contentType: string, slug: string) {
  return previewSyncStore.get(buildPreviewSyncKey(contentType, slug)) ?? null;
}
```

Create a webhook route such as `app/api/plank/preview-sync/route.ts`:

```ts
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { isPlankPreviewSyncWebhookPayload } from "@plank-cms/client";
import { setPreviewSyncState } from "@/lib/preview-sync-store";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (!isPlankPreviewSyncWebhookPayload(body)) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (body.slug) {
    revalidatePath(`/draft/${body.content_type}/${body.slug}`);

    await setPreviewSyncState(body.content_type, body.slug, {
      previewUrl: body.preview_url,
      triggeredAt: body.triggered_at,
    });
  }

  return NextResponse.json({ ok: true });
}
```

Create a polling endpoint such as `app/api/plank/preview-state/[contentType]/[slug]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { getPreviewSyncState } from "@/lib/preview-sync-store";

export async function GET(
  _request: Request,
  context: { params: Promise<{ contentType: string; slug: string }> },
) {
  const { contentType, slug } = await context.params;
  const state = await getPreviewSyncState(contentType, slug);

  return NextResponse.json({
    triggeredAt: state?.triggeredAt ?? null,
    previewUrl: state?.previewUrl ?? null,
  });
}
```

Mount a polling component in the preview page:

```tsx
// components/PreviewAutoRefresh.tsx
'use client';

import { useEffect, useRef } from "react";

export default function PreviewAutoRefresh({
  contentType,
  slug,
}: {
  contentType: string;
  slug: string;
}) {
  const lastTriggeredAtRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const response = await fetch(
          `/api/plank/preview-state/${contentType}/${slug}`,
          { cache: "no-store" },
        );

        if (!response.ok) return;

        const state = (await response.json()) as {
          triggeredAt: string | null;
          previewUrl: string | null;
        };

        if (!state.triggeredAt) return;

        if (!lastTriggeredAtRef.current) {
          lastTriggeredAtRef.current = state.triggeredAt;
          return;
        }

        if (state.triggeredAt !== lastTriggeredAtRef.current) {
          lastTriggeredAtRef.current = state.triggeredAt;

          if (state.previewUrl && state.previewUrl !== window.location.href) {
            window.location.assign(state.previewUrl);
            return;
          }

          window.location.reload();
        }
      } catch {
        // Ignore transient polling failures.
      }
    };

    const interval = window.setInterval(() => {
      if (!cancelled) void poll();
    }, 2000);

    void poll();

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [contentType, slug]);

  return null;
}
```

Notes:

- The preview route should fetch with `cache: "no-store"`.
- The recommended v1 route pattern is `/draft/[contentType]/[slug]`.
- Key your preview sync state by both `contentType` and `slug`, not by `slug` alone.
- `status: "all"` is the safest preview default because it also covers entries that are already
  published but have newer saved draft changes in the editor.
- If your preview route only needs never-published drafts, `status: "draft"` also works.
- The preview auto-refresh is implemented by your frontend, not by the client package.
- The recommended v1 approach is webhook plus polling, exactly as shown above.
- If the slug changes after a save, use `preview_url` from the webhook payload so the browser can
  navigate to the new preview route instead of only reloading the old one.
- Secure preview is best implemented in server-capable frontends where the Plank API token stays on
  the server.
- Pure client-only SPAs are not an officially secure preview target when reusing the same API token
  model.

---

## Next.js App Router cache

The client integrates natively with Next.js `fetch` cache options.

### Fresh by default

The client does not cache by default. Every request uses `cache: "no-store"` unless you override
it.

```ts
await plank.collection("posts").findMany();
// equivalent to fetch(..., { cache: "no-store" })
```

This keeps the client predictable across frameworks and leaves cache strategy to the consuming
frontend.

### Static / force-cache

Opt in when you want framework-level caching:

```ts
await plank.collection("posts").findMany({}, { cache: "force-cache" });
```

### ISR — Incremental Static Regeneration

Revalidate on a time interval:

```ts
// revalidate every 10 minutes
await plank.collection("posts").findMany({}, { revalidate: 600 });

// revalidate every 24 hours
await plank.single("homepage").find({}, { revalidate: 86400 });
```

### No cache

Always fetch fresh data. Useful for previews or highly dynamic content:

```ts
await plank.collection("posts").findMany({}, { cache: "no-store" });
```

---

## TypeScript

The client is fully typed. Pass your content type interface as a generic to get typed responses:

```ts
import type { PlankMedia } from "@plank-cms/client";

interface Post {
  id: string;
  title: string;
  slug: string;
  body: string;
  cover: PlankMedia;
  published_at: string;
}

const { data } = await plank.collection<Post>("posts").findMany();
// data is Post[]

const post = await plank.collection<Post>("posts").findOne("entry-id");
// post is Post
```

Images and galleries now resolve to rich media objects:

```ts
interface Homepage {
  hero: PlankMedia;
  gallery: PlankMedia[];
}
```

---

## Framework support

The client is framework-agnostic. It is not tied to React and can be used anywhere standard
`fetch` is available, including Next.js, Astro, Remix, SvelteKit, Node.js, or plain server-side
JavaScript/TypeScript.

The only framework-specific part in this README is the caching section: the `cache` and
`revalidate` examples map especially well to Next.js App Router because Next extends `fetch`
with `next: { revalidate }`.

---

## Query params reference

| Param         | Type                              | Default       | Description                                                   |
| ------------- | --------------------------------- | ------------- | ------------------------------------------------------------- |
| `page`        | `number`                          | `1`           | Page number                                                   |
| `limit`       | `number`                          | `20`          | Entries per page (max 100)                                    |
| `status`      | `'published' \| 'draft' \| 'all'` | `'published'` | Filter by status                                              |
| `sort`        | `string`                          | —             | Field name to sort by                                         |
| `order`       | `'asc' \| 'desc'`                 | —             | Sort direction                                                |
| `author`      | `string`                          | —             | Filter collection entries by public author slug               |
| `filters`     | `PlankFilters`                    | —             | Field-based filters using operator objects                    |
| `locale`      | `string`                          | —             | Request a localized version of localizable fields (e.g. `es`) |
| `fallback`    | `string \| string[]`              | —             | Comma-separated fallback locale list (e.g. `en,fr`)           |
| `fields`      | `string \| string[]`              | —             | Include only specific top-level serialized fields             |
| `select`      | `string \| string[]`              | —             | Alias of `fields`                                             |
| `exclude`     | `string \| string[]`              | —             | Remove specific top-level serialized fields                   |

---

## Low-level API

For full control, use `fetch` and `buildUrl` directly:

```ts
// raw fetch
const data = await plank.fetch("/posts", { limit: 5 }, { revalidate: 300 });

// build URL without fetching (useful for debugging or custom fetch logic)
const url = plank.buildUrl("/posts", { category: "news", limit: 10 });
// https://your-plank-instance.com/api/posts?category=news&limit=10
```

---

## License

[MIT](LICENSE) - AM25, S.A.S. DE C.V.
