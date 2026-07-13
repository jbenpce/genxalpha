// Build-time fetch of the genXalpha Substack RSS feed. The site is static,
// so "latest posts" means latest at build time — deploy.yml also rebuilds on
// a daily schedule to keep the list fresh without manual pushes.

export interface Post {
  title: string;
  href: string;
  date?: Date;
  blurb?: string;
}

const FEED_URL = 'https://genxalpha.substack.com/feed';

// Curated fallback, used only if the feed can't be fetched (e.g. building
// offline). Keeps the build green no matter what.
export const FALLBACK_POSTS: Post[] = [
  {
    title: 'Why AI’s Future Depends on the Grid, Not the Lab',
    href: 'https://genxalpha.substack.com/p/why-ais-future-depends-on-the-grid',
    blurb: 'AI’s bottleneck isn’t model quality — it’s electricity, and how intelligently we use the grid we already have.',
  },
  {
    title: 'Greenspar.x Powers Up',
    href: 'https://genxalpha.substack.com/p/greensparx-powers-up',
    blurb: 'Battery energy storage in Italy: grid-balancing capacity and the machinery of the renewables transition.',
  },
  {
    title: 'Bitcoin: the Apex Asset',
    href: 'https://genxalpha.substack.com/p/bitcoin-the-apex-asset',
    blurb: 'Why an asset secured by vast amounts of electricity is a feature, not a bug.',
  },
  {
    title: 'Behold the Foolish ECB',
    href: 'https://genxalpha.substack.com/p/behold-the-foolish-ecb',
    blurb: 'Central banking meets sound money — and comes off second best.',
  },
  {
    title: 'Operation Chokepoint 2.0',
    href: 'https://genxalpha.substack.com/p/operation-chokepoint-20',
    blurb: 'How regulators quietly squeezed crypto out of the banking system.',
  },
  {
    title: 'Humanity’s Poison: Judgement',
    href: 'https://genxalpha.substack.com/p/humanitys-poison-judgement',
    blurb: 'On judgement, potential and the habits of mind that hold us back.',
  },
  {
    title: 'A New Beginning, A New Substack',
    href: 'https://genxalpha.substack.com/p/a-new-substack-a-new-beginning',
    blurb: 'Where genXalpha came from, and where it’s going.',
  },
];

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&#8217;': '’',
  '&#8216;': '‘',
  '&#8220;': '“',
  '&#8221;': '”',
  '&#8212;': '—',
  '&#8230;': '…',
  '&nbsp;': ' ',
};

function decode(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;/g, (e) => ENTITIES[e] ?? e);
}

function pick(item: string, tag: string): string {
  const m = item.match(
    new RegExp(`<${tag}[^>]*>(?:\\s*<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>\\s*)?</${tag}>`),
  );
  return m ? m[1].trim() : '';
}

function parseFeedXml(xml: string): Post[] {
  return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
    .map((m) => m[1])
    .map((item) => {
      const pub = pick(item, 'pubDate');
      return {
        title: decode(pick(item, 'title')),
        href: pick(item, 'link'),
        date: pub ? new Date(pub) : undefined,
        blurb: decode(pick(item, 'description'))
          .replace(/<[^>]+>/g, '')
          .trim()
          .slice(0, 200),
      };
    })
    .filter((p) => p.title && p.href.startsWith('http'));
}

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchText(url: string, ua: string): Promise<string> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    headers: {
      accept: 'application/rss+xml, application/xml, text/xml, application/json, */*',
      'user-agent': ua,
      'accept-language': 'en-US,en;q=0.9',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

// Substack's bot protection blocks datacenter IPs (including GitHub Actions
// runners), so try the direct feed first and then public feed mirrors that
// fetch from their own infrastructure.
const STRATEGIES: Array<{ name: string; load: () => Promise<Post[]> }> = [
  {
    name: 'direct (browser UA)',
    load: async () => parseFeedXml(await fetchText(FEED_URL, BROWSER_UA)),
  },
  {
    // Proven to work from GitHub Actions runners (the direct fetch is
    // blocked there); tried before allorigins, which tends to time out.
    name: 'rss2json mirror',
    load: async () => {
      const body = await fetchText(
        `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(FEED_URL)}`,
        BROWSER_UA,
      );
      const data = JSON.parse(body);
      if (data.status !== 'ok' || !Array.isArray(data.items)) throw new Error('bad payload');
      return data.items
        .map((i: any) => ({
          title: String(i.title ?? ''),
          href: String(i.link ?? ''),
          date: i.pubDate ? new Date(i.pubDate) : undefined,
          blurb: String(i.description ?? '')
            .replace(/<[^>]+>/g, '')
            .trim()
            .slice(0, 200),
        }))
        .filter((p: Post) => p.title && p.href.startsWith('http'));
    },
  },
  {
    name: 'allorigins mirror',
    load: async () =>
      parseFeedXml(
        await fetchText(
          `https://api.allorigins.win/raw?url=${encodeURIComponent(FEED_URL)}`,
          BROWSER_UA,
        ),
      ),
  },
];

async function loadPosts(): Promise<{ posts: Post[]; live: boolean }> {
  for (const s of STRATEGIES) {
    try {
      const posts = await s.load();
      if (posts.length === 0) throw new Error('parsed to zero items');
      console.log(`[substack] loaded ${posts.length} posts via ${s.name}`);
      return { posts, live: true };
    } catch (err) {
      console.warn(`[substack] ${s.name} failed: ${err}`);
    }
  }
  console.warn('[substack] all strategies failed; using fallback list');
  return { posts: FALLBACK_POSTS, live: false };
}

// Fetch once per build — every page that imports this shares the result.
let cached: Promise<{ posts: Post[]; live: boolean }> | undefined;

export function getPosts(): Promise<{ posts: Post[]; live: boolean }> {
  cached ??= loadPosts();
  return cached;
}

export function formatDate(d?: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
