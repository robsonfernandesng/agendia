const DEFAULT_PRODUCTION_ORIGIN = 'https://agendia-588682649251.us-west1.run.app';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getApiOrigin = () => {
  const configuredOrigin = trimTrailingSlash(
    import.meta.env.VITE_API_BASE_URL || DEFAULT_PRODUCTION_ORIGIN,
  );

  if (typeof window === 'undefined') {
    return configuredOrigin;
  }

  const { origin, protocol, hostname } = window.location;
  const isEmbeddedApp =
    protocol === 'capacitor:' ||
    protocol === 'file:' ||
    origin === 'http://localhost' ||
    hostname === 'localhost';

  return isEmbeddedApp ? configuredOrigin : '';
};

export const API_ORIGIN = getApiOrigin();
export const PUBLIC_APP_URL = trimTrailingSlash(
  import.meta.env.VITE_PUBLIC_APP_URL || DEFAULT_PRODUCTION_ORIGIN,
);

export const toApiUrl = (input: string) => {
  if (!input.startsWith('/api/')) return input;
  return `${API_ORIGIN}${input}`;
};

export const installApiFetchInterceptor = () => {
  if (typeof window === 'undefined') return;

  const originalFetch = window.fetch.bind(window);

  const interceptedFetch = (input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string') {
      return originalFetch(toApiUrl(input), init);
    }

    if (input instanceof Request) {
      return originalFetch(new Request(toApiUrl(input.url), input), init);
    }

    return originalFetch(input, init);
  };

  try {
    // Try direct assignment
    (window as any).fetch = interceptedFetch;
  } catch (e) {
    try {
      // Fallback to defineProperty
      Object.defineProperty(window, 'fetch', {
        value: interceptedFetch,
        configurable: true,
        writable: true,
      });
    } catch (err) {
      console.error('Failed to intercept fetch:', err);
    }
  }
};
