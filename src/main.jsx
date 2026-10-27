import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

function SearchGlyph({ className = '' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.8" />
      <path d="m16 16 4.1 4.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ArrowGlyph({ direction = 'right' }) {
  const flipped = direction === 'left';
  return (
    <svg className={flipped ? 'arrow-icon arrow-icon--left' : 'arrow-icon'} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3.5 10h12m-5-5 5 5-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BrandMark() {
  return (
    <a className="brand" href="/" aria-label="Stillframe home">
      <span className="brand-symbol" aria-hidden="true"><span /><span /><span /><span /></span>
      <span>stillframe</span>
    </a>
  );
}

function formatWhen(value) {
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function SearchApp() {
  const [input, setInput] = useState('');
  const [term, setTerm] = useState('');
  const [images, setImages] = useState([]);
  const [page, setPage] = useState(1);
  const [recent, setRecent] = useState([]);
  const [showAllRecent, setShowAllRecent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const requestNumber = useRef(0);

  async function refreshRecent() {
    try {
      const response = await fetch('/recent/');
      if (!response.ok) throw new Error('Recent searches are unavailable.');
      setRecent(await response.json());
    } catch {
      setRecent([]);
    }
  }

  useEffect(() => { refreshRecent(); }, []);

  async function runSearch(nextTerm, nextPage = 1) {
    const cleanTerm = nextTerm.trim();
    if (!cleanTerm) {
      setError('Enter a subject to start searching.');
      return;
    }

    const requestId = ++requestNumber.current;
    setLoading(true);
    setError('');
    setTerm(cleanTerm);
    setInput(cleanTerm);
    setPage(nextPage);
    try {
      const response = await fetch(`/query/${encodeURIComponent(cleanTerm)}?page=${nextPage}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Search could not be completed.');
      if (requestId !== requestNumber.current) return;
      setImages(payload);
      await refreshRecent();
    } catch (searchError) {
      if (requestId !== requestNumber.current) return;
      setImages([]);
      setError(searchError.message || 'Search could not be completed. Try again in a moment.');
    } finally {
      if (requestId === requestNumber.current) setLoading(false);
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    runSearch(input, 1);
  }

  const visibleRecent = showAllRecent ? recent : recent.slice(0, 7);

  return (
    <div className="app-shell">
      <header className="topbar">
        <BrandMark />
        <nav className="topnav" aria-label="Main navigation">
          <a className="topnav-link topnav-link--active" href="#search">Explore</a>
          <a className="topnav-link" href="#recent-searches">Recent searches</a>
        </nav>
        <a className="source-link" href="https://commons.wikimedia.org/" target="_blank" rel="noreferrer">
          Visual commons <span aria-hidden="true">↗</span>
        </a>
      </header>

      <main className="page-layout" id="search">
        <section className="main-column" aria-labelledby="page-title">
          <div className="intro">
            <h1 id="page-title">Find the image<br className="desktop-break" /> you have in mind.</h1>
            <p className="intro-copy">A little curiosity goes a long way. Search millions of freely shared images from Wikimedia Commons.</p>
            <form className="search-form" onSubmit={handleSubmit} role="search">
              <SearchGlyph className="search-form-icon" />
              <label className="sr-only" htmlFor="image-search">Search images</label>
              <input
                id="image-search"
                type="search"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Try “lolcats funny”"
                autoComplete="off"
              />
              <button type="submit" disabled={loading}>
                <span>{loading ? 'Searching' : 'Search'}</span>
                {!loading && <ArrowGlyph />}
              </button>
            </form>
            <div className="suggestions" aria-label="Suggested searches">
              <span>Try</span>
              {['japanese gardens', 'red fox', 'abstract architecture'].map((suggestion) => (
                <button type="button" key={suggestion} onClick={() => runSearch(suggestion)}>{suggestion}</button>
              ))}
            </div>
          </div>

          <section className="results-section" aria-live="polite" aria-busy={loading}>
            <div className="results-heading">
              <div>
                <h2>{term ? `Images for “${term}”` : 'A world of images, waiting'}</h2>
                {term && <p>{loading ? 'Gathering a few good finds…' : `${images.length} results · page ${page}`}</p>}
              </div>
              {term && !loading && images.length > 0 && (
                <div className="page-status">{String(page).padStart(2, '0')} <span>/</span> pages</div>
              )}
            </div>

            {error && <div className="notice notice--error" role="alert">{error}</div>}
            {loading && <div className="loading-state"><span className="loader" />Finding images in the Commons…</div>}

            {!loading && term && images.length > 0 && (
              <>
                <div className="image-grid">
                  {images.map((image, index) => (
                    <article className={`image-item image-item--${index % 5}`} key={`${image.page}-${index}`}>
                      <a className="image-frame" href={image.page} target="_blank" rel="noreferrer" aria-label={`Open source page: ${image.description}`}>
                        <img src={image.url} alt={image.description} loading={index < 6 ? 'eager' : 'lazy'} />
                        <span className="image-open" aria-hidden="true">↗</span>
                      </a>
                      <p className="image-caption" title={image.description}>{image.description}</p>
                    </article>
                  ))}
                </div>
                <div className="pagination" aria-label="Image result pages">
                  <button type="button" className="page-button page-button--previous" onClick={() => runSearch(term, page - 1)} disabled={page <= 1 || loading}>
                    <ArrowGlyph direction="left" /><span>Previous</span>
                  </button>
                  <span className="current-page">Page <strong>{page}</strong></span>
                  <button type="button" className="page-button" onClick={() => runSearch(term, page + 1)} disabled={loading}>
                    <span>Next page</span><ArrowGlyph />
                  </button>
                </div>
              </>
            )}

            {!loading && term && images.length === 0 && !error && (
              <div className="empty-results"><SearchGlyph /><h3>No images found on this page</h3><p>Try a broader search, or move back to an earlier page.</p></div>
            )}

            {!term && !error && (
              <div className="welcome-panel">
                <div className="welcome-copy"><span className="welcome-mark" aria-hidden="true">✳</span><p>Curiosity looks good on you.</p><span>Start with a search above to explore photographs, illustrations, and more.</span></div>
                <div className="welcome-lines" aria-hidden="true"><span /><span /><span /></div>
              </div>
            )}
          </section>
        </section>

        <aside className="recent-rail" id="recent-searches" aria-labelledby="recent-title">
          <div className="rail-heading">
            <div><span className="rail-label">YOUR TRAIL</span><h2 id="recent-title">Recent searches</h2></div>
            <span className="recent-count">{String(recent.length).padStart(2, '0')}</span>
          </div>
          {visibleRecent.length > 0 ? (
            <ol className="recent-list">
              {visibleRecent.map((entry, index) => (
                <li key={`${entry.term}-${entry.when}`}>
                  <button type="button" className="recent-query" onClick={() => runSearch(entry.term)}>
                    <span className="recent-index">{String(index + 1).padStart(2, '0')}</span>
                    <span className="recent-term">{entry.term}</span>
                    <span className="recent-date">{formatWhen(entry.when)}</span>
                  </button>
                </li>
              ))}
            </ol>
          ) : (
            <p className="recent-empty">Your searches will gather here as you explore.</p>
          )}
          {recent.length > 7 && (
            <button className="view-all" type="button" onClick={() => setShowAllRecent((current) => !current)}>
              {showAllRecent ? 'Show less' : 'View all searches'} <ArrowGlyph />
            </button>
          )}
          <div className="rail-note"><span className="rail-note-dot" />Search history is saved on this server.</div>
        </aside>
      </main>

      <footer className="footer">
        <span>STILLFRAME <span className="footer-dot">·</span> IMAGE SEARCH</span>
        <span>Images from Wikimedia Commons</span>
      </footer>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<SearchApp />);
