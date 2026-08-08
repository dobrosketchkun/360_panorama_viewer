// Parses the "panorama, optionally plus depth map" notation used by both the
// direct-link query string and the URL field in the open dialog.
//
//   <pano>                        colour only
//   <pano>&d=<depth>              colour + depth map
//
// The bare direct-link form deliberately swallows the whole query string so
// that panorama URLs carrying their own ?a=1&b=2 keep working. That's why the
// split can't just be "first &d=": it has to be the LAST one whose value looks
// like a URL, so a pano URL with its own d= parameter isn't mistaken for the
// separator. A d= holding a full http(s) URL inside the pano's own query is the
// only way to fool this, and the ?url=/&d= form is the escape hatch for it.

const SPLIT = /^(.*)&d=(https?(?::|%3a).*)$/i;

function decode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Takes a raw string (address-bar text or dialog input), not a query string.
export function parsePair(str) {
  const s = (str || '').trim();
  if (!s) return null;
  const m = s.match(SPLIT);
  if (m) return { url: decode(m[1]), depth: decode(m[2]) };
  return { url: decode(s), depth: null };
}

// Takes window.location.search. Returns {url, depth} or null.
export function parseQuery(search) {
  if (!search || search.length < 2) return null;
  const rest = search.slice(1);
  if (/^https?(:|%3a)/i.test(rest)) return parsePair(rest);
  const params = new URLSearchParams(search);
  const url = params.get('url');
  if (!url) return null;
  return { url, depth: params.get('d') || params.get('depth') || null };
}
