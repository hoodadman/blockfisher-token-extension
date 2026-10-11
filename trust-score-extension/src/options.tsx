import { StrictMode, useEffect, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import './options.css';

function Options() {
  const [insightx, setInsightx] = useState('');
  const [twitter, setTwitter] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void chrome.storage.local.get(['insightx', 'twitter']).then((stored) => {
      if (typeof stored.insightx === 'string') setInsightx(stored.insightx);
      if (typeof stored.twitter === 'string') setTwitter(stored.twitter);
    });
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await chrome.storage.local.set({
      insightx: insightx.trim(),
      twitter: twitter.trim(),
    });
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <main>
      <h1>Token trust score</h1>
      <p>Security and market data run with no keys. Add these only if you want holder clusters and the Twitter community score.</p>
      <form onSubmit={(event) => void onSubmit(event)}>
        <label>
          InsightX API key
          <input value={insightx} onChange={(event) => setInsightx(event.target.value)} type="password" autoComplete="off" />
        </label>
        <label>
          X / Twitter bearer token
          <input value={twitter} onChange={(event) => setTwitter(event.target.value)} type="password" autoComplete="off" />
        </label>
        <button type="submit">Save</button>
        {saved && <p className="ok">Saved on this computer.</p>}
      </form>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
