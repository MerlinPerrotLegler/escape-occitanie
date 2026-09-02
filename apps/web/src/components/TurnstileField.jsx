import React, { useEffect, useRef } from 'react';

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const SCRIPT_WAIT_MS = 8000;

let scriptPromise = null;

function emit(ref, value) {
  const fn = ref.current;
  if (typeof fn === 'function') {
    fn(value);
  }
}

function waitForTurnstileApi(timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (window.turnstile) {
        resolve();
        return;
      }
      if (Date.now() - start >= timeoutMs) {
        reject(new Error('turnstile-script'));
        return;
      }
      window.setTimeout(tick, 50);
    };
    tick();
  });
}

function loadTurnstileScript() {
  if (typeof window !== 'undefined' && window.turnstile) {
    return Promise.resolve();
  }
  if (scriptPromise) {
    return scriptPromise;
  }
  scriptPromise = (async () => {
    try {
      const existing = document.querySelector('script[src^="https://challenges.cloudflare.com/turnstile/v0/api.js"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = SCRIPT_SRC;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      await waitForTurnstileApi(SCRIPT_WAIT_MS);
    } catch (err) {
      scriptPromise = null;
      throw err;
    }
  })();
  return scriptPromise;
}

function waitUntilVisible(el, signal) {
  return new Promise((resolve) => {
    if (!el || signal?.aborted) {
      resolve(false);
      return;
    }
    let settled = false;
    const finish = (ok) => {
      if (settled) {
        return;
      }
      settled = true;
      io.disconnect();
      window.clearTimeout(fallback);
      resolve(ok);
    };
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight) {
      resolve(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting && entry.boundingClientRect.width > 0)) {
          finish(true);
        }
      },
      { threshold: 0.01, rootMargin: '80px' }
    );
    const fallback = window.setTimeout(() => finish(el.offsetWidth > 0), 1500);
    signal?.addEventListener('abort', () => finish(false), { once: true });
    io.observe(el);
  });
}

function readWidgetToken(container) {
  const input = container?.querySelector('[name="cf-turnstile-response"]');
  const value = typeof input?.value === 'string' ? input.value.trim() : '';
  return value;
}

export function TurnstileField({ resetKey, onToken, onEnabled }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const onTokenRef = useRef(onToken);
  const onEnabledRef = useRef(onEnabled);

  onTokenRef.current = onToken;
  onEnabledRef.current = onEnabled;

  useEffect(() => {
    let cancelled = false;
    let tokenPoll = 0;
    const ac = new AbortController();
    emit(onTokenRef, '');
    emit(onEnabledRef, null);

    function skip() {
      if (!cancelled) {
        emit(onEnabledRef, false);
      }
    }

    function removeWidget() {
      if (tokenPoll) {
        window.clearInterval(tokenPoll);
        tokenPoll = 0;
      }
      if (widgetIdRef.current != null && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget already gone.
        }
      }
      widgetIdRef.current = null;
      if (containerRef.current) {
        containerRef.current.replaceChildren();
      }
    }

    async function setup() {
      try {
        const res = await fetch('/api/turnstile.php');
        const data = await res.json().catch(() => ({}));
        const siteKey = typeof data.siteKey === 'string' ? data.siteKey.trim() : '';
        const enabled = data.enabled === true && siteKey !== '';
        if (!res.ok || !enabled) {
          skip();
          return;
        }
        await loadTurnstileScript();
        if (cancelled || !containerRef.current) {
          if (!cancelled) {
            skip();
          }
          return;
        }
        const visible = await waitUntilVisible(containerRef.current, ac.signal);
        if (cancelled || !containerRef.current || !window.turnstile) {
          if (!cancelled) {
            skip();
          }
          return;
        }
        if (!visible && containerRef.current.offsetWidth <= 0) {
          skip();
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme: 'dark',
          language: 'fr',
          appearance: 'always',
          callback: (token) => emit(onTokenRef, token || ''),
          'expired-callback': () => emit(onTokenRef, ''),
          'error-callback': () => emit(onTokenRef, ''),
        });
        if (cancelled) {
          removeWidget();
          return;
        }
        if (widgetIdRef.current == null) {
          skip();
          return;
        }
        emit(onEnabledRef, true);
        tokenPoll = window.setInterval(() => {
          const token = readWidgetToken(containerRef.current);
          if (token) {
            emit(onTokenRef, token);
            window.clearInterval(tokenPoll);
            tokenPoll = 0;
          }
        }, 200);
      } catch {
        skip();
      }
    }

    setup();
    return () => {
      cancelled = true;
      ac.abort();
      removeWidget();
    };
  }, [resetKey]);

  return (
    <div>
      <div ref={containerRef} className="min-h-[65px]" />
    </div>
  );
}
