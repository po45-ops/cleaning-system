const DEFAULT_SITE_URL = "https://po45-ops.github.io/cleaning-system/";
const siteUrl = process.env.PAGE_URL || process.argv[2] || DEFAULT_SITE_URL;
const maxAttempts = Number(process.env.SMOKE_ATTEMPTS || 6);
const retryDelayMs = Number(process.env.SMOKE_RETRY_DELAY_MS || 5000);
const requestTimeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 12000);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchWithRetry(url, options = {}) {
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchWithTimeout(url, options);
      if (response.ok) return response;
      lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < maxAttempts) {
      console.log(
        `Smoke check attempt ${attempt}/${maxAttempts} failed for ${url}; retrying...`
      );
      await wait(retryDelayMs);
    }
  }

  throw lastError;
}

function extractAssetUrls(html, pageUrl) {
  const assetUrls = new Set();
  const patterns = [
    /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
    /<link\b[^>]*\brel=["']stylesheet["'][^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
    /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*\brel=["']stylesheet["'][^>]*>/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      assetUrls.add(new URL(match[1], pageUrl).toString());
    }
  }

  return Array.from(assetUrls);
}

async function smokeTestPages() {
  const pageResponse = await fetchWithRetry(siteUrl, {
    headers: { accept: "text/html" },
  });
  const html = await pageResponse.text();
  const normalizedUrl = pageResponse.url || siteUrl;

  if (!html.includes('<div id="root"></div>')) {
    throw new Error("GitHub Pages HTML is missing the React root element.");
  }

  const assetUrls = extractAssetUrls(html, normalizedUrl);
  if (assetUrls.length === 0) {
    throw new Error("GitHub Pages HTML does not reference any built assets.");
  }

  await Promise.all(
    assetUrls.map(async (url) => {
      const response = await fetchWithRetry(url, { method: "HEAD" });
      const contentLength = Number(response.headers.get("content-length") || 0);
      if (contentLength === 0) {
        console.warn(`Smoke check warning: ${url} has no content-length header.`);
      }
    })
  );

  console.log(
    `GitHub Pages smoke check passed for ${normalizedUrl} (${assetUrls.length} assets).`
  );
}

smokeTestPages().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
