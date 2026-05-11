# Plank CMS - Client

Client for the [Plank CMS](https://github.com/plank-cms/plank) headless API. Framework-agnostic and compatible with Next.js App Router, Astro, or any project with `fetch`.

## Installation

```bash
pnpm add @plank-cms/client
```

## Setup

Create a client instance and reuse it across your project:

```ts
// lib/plank.ts
import { createPlankClient } from "@plank-cms/client";

const plank = createPlankClient({
  url: process.env.PLANK_URL!,
  token: process.env.PLANK_TOKEN!,
  // defaultLocale: "en",
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

```ts
import plank from "@/lib/plank";

const { data, total, page, limit } = await plank.collection("posts").findMany();
```

Requests are fresh by default. The client uses `cache: "no-store"` unless you override it.

With params:

```ts
const { data } = await plank.collection("posts").findMany({
  page: 1,
  limit: 9,
  status: "published",
  category: "news",
});
```

Locale override:

```ts
const { data: esPosts } = await plank
  .collection("posts")
  .findMany({ locale: "es" });
const { data: frPosts } = await plank
  .collection("posts")
  .findMany({ locale: "fr" });
```

```ts
const post = await plank.collection("posts").findOne("entry-id");
```

With request params:

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

Field filters use `filters[field][operator]` semantics:

```ts
const { data } = await plank.collection("categories").findMany({
  filters: {
    slug: {
      in: ["design", "motion", "branding"],
      nin: ["internal", "archived"],
    },
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

Works for collections, single-entry fetches, and single types:

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
- `select` is an alias of `fields`.
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

The client only provides a type guard for the preview sync webhook payload. The frontend is
responsible for handling the webhook, exposing a small polling endpoint, and reloading the preview
tab.

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

Validate it with:

```ts
import { isPlankPreviewSyncWebhookPayload } from "@plank-cms/client";
```

Route pattern:

```text
/draft/[contentType]/[slug]
```

Flow:

1. Plank opens `/draft/[contentType]/[slug]`.
2. Plank sends `preview.sync` to your webhook after each save.
3. Your webhook stores the latest sync state in memory, keyed by `contentType + slug`.
4. The preview page polls `/api/plank/preview-state/[contentType]/[slug]`.
5. The browser compares `triggered_at` with the last value in `localStorage`.
6. If `preview_url` changed, navigate to it. Otherwise reload the page.

#### Next.js App Router example

Template in Plank:

```text
https://frontend.example.com/draft/{contentType}/{slug}
```

Preview route:

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

In-memory sync store:

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

Webhook route:

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

Polling endpoint:

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

Preview polling component:

```tsx
// components/PreviewAutoRefresh.tsx
'use client';

import { useEffect } from "react";

export default function PreviewAutoRefresh({
  contentType,
  slug,
}: {
  contentType: string;
  slug: string;
}) {
  useEffect(() => {
    let cancelled = false;
    const storageKey = `plank-preview:${contentType}:${slug}`;

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

        const lastTriggeredAt = window.localStorage.getItem(storageKey);

        if (!lastTriggeredAt) {
          window.localStorage.setItem(storageKey, state.triggeredAt);
          return;
        }

        if (state.triggeredAt === lastTriggeredAt) return;

        window.localStorage.setItem(storageKey, state.triggeredAt);

        if (state.previewUrl && state.previewUrl !== window.location.href) {
          window.location.assign(state.previewUrl);
          return;
        }

        window.location.reload();
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

- Use `/draft/[contentType]/[slug]`.
- Fetch preview content with `cache: "no-store"` and `status: "all"`.
- Key preview sync state by both `contentType` and `slug`.
- If `preview_url` changes after a save, navigate to it instead of only reloading.

---

## Next.js App Router cache

### Fresh by default

Every request uses `cache: "no-store"` unless you override it.

```ts
await plank.collection("posts").findMany();
```

### Static / force-cache

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

The client is framework-agnostic and works anywhere standard `fetch` is available, including
Next.js, Astro, Remix, SvelteKit, Node.js, or plain server-side JavaScript/TypeScript.

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

Use `fetch` and `buildUrl` directly when you need full control:

```ts
// raw fetch
const data = await plank.fetch("/posts", { limit: 5 }, { revalidate: 300 });

// build URL without fetching
const url = plank.buildUrl("/posts", { category: "news", limit: 10 });
// https://your-plank-instance.com/api/posts?category=news&limit=10
```

---

## License

[MIT](LICENSE) - AM25, S.A.S. DE C.V.
