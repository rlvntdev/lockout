// Platform configuration for futures trading detection
// futuresPatterns will be populated via live inspection (discovery mode)

export const PLATFORMS = {
  breakout: {
    domains: ["breakout.trade"],
    // Patterns that identify futures order requests
    // Each pattern: { urlMatch: RegExp, methods: string[], bodyMatch?: RegExp }
    futuresPatterns: []
  },
  topstep: {
    domains: ["topstep.com"],
    futuresPatterns: []
  },
  robinhood: {
    domains: ["robinhood.com"],
    futuresPatterns: []
  }
};

// Check if a URL belongs to a tracked platform
export function getPlatform(url) {
  for (const [name, config] of Object.entries(PLATFORMS)) {
    if (config.domains.some(domain => url.includes(domain))) {
      return { name, config };
    }
  }
  return null;
}

// Check if a request matches futures trading patterns
export function isFuturesRequest(url, method, body) {
  const platform = getPlatform(url);
  if (!platform) return false;

  for (const pattern of platform.config.futuresPatterns) {
    const urlMatches = pattern.urlMatch ? pattern.urlMatch.test(url) : true;
    const methodMatches = pattern.methods ? pattern.methods.includes(method) : true;
    const bodyMatches = pattern.bodyMatch && body ? pattern.bodyMatch.test(body) : !pattern.bodyMatch;

    if (urlMatches && methodMatches && bodyMatches) {
      return true;
    }
  }

  return false;
}
