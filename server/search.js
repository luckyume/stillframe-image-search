const COMMONS_API_URL = 'https://commons.wikimedia.org/w/api.php';
const RESULTS_PER_PAGE = 20;

function decodeHtml(value = '') {
  const named = { amp: '&', apos: "'", quot: '"', lt: '<', gt: '>', nbsp: ' ' };
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (entity, name) => named[name] ?? entity);
}

function plainText(value = '') {
  return decodeHtml(value.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

function imageDescription(metadata, filename) {
  const candidates = [metadata?.ImageDescription?.value, metadata?.ObjectName?.value];
  const description = candidates.map(plainText).find(Boolean);
  return description || filename.replace(/^File:/i, '').replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ');
}

export async function searchCommons(term, { page = 1, fetchImpl = fetch, signal } = {}) {
  const url = new URL(COMMONS_API_URL);
  url.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: term,
    gsrnamespace: '6',
    gsrlimit: String(RESULTS_PER_PAGE),
    gsroffset: String((page - 1) * RESULTS_PER_PAGE),
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '640',
    format: 'json',
    origin: '*',
  }).toString();

  const response = await fetchImpl(url, {
    headers: { 'user-agent': 'StillframeImageSearch/1.0 (image search demo)' },
    signal: signal ?? AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Image source returned HTTP ${response.status}`);

  const payload = await response.json();
  if (payload.error) throw new Error(payload.error.info || 'Image source request failed');

  return Object.values(payload.query?.pages ?? {})
    .map((file) => {
      const image = file.imageinfo?.[0];
      if (!image?.url) return null;
      const pageUrl = image.descriptionurl || image.descriptionshorturl || '';
      return {
        url: image.thumburl || image.url,
        description: imageDescription(image.extmetadata, file.title),
        page: pageUrl,
        title: file.title.replace(/^File:/i, ''),
      };
    })
    .filter(Boolean);
}

export { RESULTS_PER_PAGE, plainText };
