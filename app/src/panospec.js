// Parses the "panorama, optionally plus depth map" notation used by both the
// direct-link query string and the URL field in the open dialog.
//
//   <pano>                        colour only
//   <pano>&d=<depth>              colour + depth map
//   <pano>&d=<depth>&ds=2.0       ...with an explicit depth strength
//
// The bare direct-link form deliberately swallows the whole query string so
// that panorama URLs carrying their own ?a=1&b=2 keep working. That's why the
// split can't just be "first &d=": it has to be the LAST one whose value looks
// like a URL, so a pano URL with its own d= parameter isn't mistaken for the
// separator. A d= holding a full http(s) URL inside the pano's own query is the
// only way to fool this, and the ?url=/&d= form is the escape hatch for it.
//
// &ds= gets stricter treatment: its value is a bare number, so unlike &d= there
// is no URL shape to key on and a panorama URL carrying its own ds= parameter
// would be indistinguishable. Anchoring it to the very end of the string makes
// it unambiguous, and that's the order anyone writes it in anyway. The ?url=
// form has no such constraint — URLSearchParams handles position for us.

const SPLIT = /^(.*)&d=(https?(?::|%3a).*)$/i;
const STRENGTH = /&ds=(\d*\.?\d+)$/i;

function strengthOf(raw) {
  const n = parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function decode(s) {
  try { return decodeURIComponent(s); } catch { return s; }
}

// Takes a raw string (address-bar text or dialog input), not a query string.
export function parsePair(str) {
  let s = (str || '').trim();
  if (!s) return null;
  // Strip &ds= off the tail before splitting on &d=, or it would ride along on
  // the end of the depth URL.
  let strength = null;
  const sm = s.match(STRENGTH);
  if (sm) {
    strength = strengthOf(sm[1]);
    s = s.slice(0, sm.index);
  }
  const m = s.match(SPLIT);
  if (m) return { url: decode(m[1]), depth: decode(m[2]), strength };
  return { url: decode(s), depth: null, strength };
}

// Takes window.location.search. Returns {url, depth, strength} or null.
export function parseQuery(search) {
  if (!search || search.length < 2) return null;
  const rest = search.slice(1);
  if (/^https?(:|%3a)/i.test(rest)) return parsePair(rest);
  const params = new URLSearchParams(search);
  const url = params.get('url');
  if (!url) return null;
  return {
    url,
    depth: params.get('d') || params.get('depth') || null,
    strength: strengthOf(params.get('ds')),
  };
}
