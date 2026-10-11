import { StrictMode, useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { detectFromUrl, type DetectedTarget } from './detect';
import type { ScanRequest, ScanResponse, View } from './messages';
import { Overlay } from './overlay';
import './overlay.css';
import '@engine/components/ScoreTriangle.css';
import '@engine/components/TrustScore.css';
import '@engine/components/ScorePanel.css';
import '@engine/components/ScoreBrief.css';

const HOST_ID = 'token-trust-score-root';

function targetKey(target: DetectedTarget) {
  return `${target.kind}:${target.chainHint ?? ''}:${target.address.toLowerCase()}`;
}

function mount() {
  if (document.getElementById(HOST_ID)) return;
  const host = document.createElement('div');
  host.id = HOST_ID;
  document.documentElement.appendChild(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = chrome.runtime.getURL('content.css');
  const wrap = document.createElement('div');
  shadow.append(link, wrap);
  createRoot(wrap).render(
    <StrictMode>
      <ContentApp />
    </StrictMode>,
  );
}

function ContentApp() {
  const [view, setView] = useState<View>({ status: 'idle' });
  const [closedFor, setClosedFor] = useState<string | null>(null);
  const lastKey = useRef<string>('');

  const scan = useCallback((target: DetectedTarget) => {
    const key = targetKey(target);
    lastKey.current = key;
    if (closedFor === key) return;
    setView({ status: 'loading', target });
    const request: ScanRequest = { type: 'scan', target };
    chrome.runtime.sendMessage(request, (response: ScanResponse | undefined) => {
      if (lastKey.current !== key) return;
      if (chrome.runtime.lastError || !response) {
        setView({ status: 'error', target, message: 'The extension background page did not answer. Reload the extension and try again.' });
        return;
      }
      setView(response.ok ? { status: 'done', target, result: response.result } : { status: 'error', target, message: response.message });
    });
  }, [closedFor]);

  useEffect(() => {
    const tick = () => {
      const target = detectFromUrl(location.href);
      if (!target) {
        setView({ status: 'idle' });
        return;
      }
      const key = targetKey(target);
      if (key === lastKey.current) return;
      if (closedFor === key) return;
      scan(target);
    };

    tick();
    const onUrl = () => tick();
    window.addEventListener('popstate', onUrl);
    window.addEventListener('hashchange', onUrl);
    const push = history.pushState.bind(history);
    const replace = history.replaceState.bind(history);
    history.pushState = (...args) => {
      push(...args);
      queueMicrotask(onUrl);
    };
    history.replaceState = (...args) => {
      replace(...args);
      queueMicrotask(onUrl);
    };
    const timer = window.setInterval(onUrl, 1000);
    return () => {
      window.removeEventListener('popstate', onUrl);
      window.removeEventListener('hashchange', onUrl);
      history.pushState = push;
      history.replaceState = replace;
      window.clearInterval(timer);
    };
  }, [closedFor, scan]);

  const close = () => {
    if (view.status !== 'idle') setClosedFor(targetKey(view.target));
    lastKey.current = '';
    setView({ status: 'idle' });
  };

  return (
    <Overlay
      view={view}
      onClose={close}
      onRetry={(target) => {
        setClosedFor(null);
        lastKey.current = '';
        scan(target);
      }}
    />
  );
}

mount();
