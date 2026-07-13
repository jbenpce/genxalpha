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

export async function getPosts(): Promise<{ posts: Post[]; live: boolean }> {
  try {
    const res = await fetch(FEED_URL, {
      signal: AbortSignal.timeout(15_000),
      headers: { accept: 'application/rss+xml, application/xml, text/xml' },
    });
    if (!res.ok) throw new Error(`feed returned HTTP ${res.status}`);
    const xml = await res.text();

    const posts: Post[] = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)]
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

    if (posts.length === 0) throw new Error('feed parsed to zero items');
    console.log(`[substack] loaded ${posts.length} posts from the live feed`);
    return { posts, live: true };
  } catch (err) {
    console.warn(`[substack] feed unavailable (${err}); using fallback list`);
    return { posts: FALLBACK_POSTS, live: false };
  }
}

export function formatDate(d?: Date): string {
  if (!d || Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
