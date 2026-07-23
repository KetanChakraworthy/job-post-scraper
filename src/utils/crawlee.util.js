export const fetchReqConfig = ({
  calculatedMaxRequests = 10,
  safeConcurrency = 2,
} = {}) => ({
  maxRequestsPerCrawl: calculatedMaxRequests || 1000,
  maxConcurrency: safeConcurrency,
  maxRequestRetries: 3,
  maxSessionRotations: 5,
});

export const sessionConfig = {
  // Turn off cookie persistence across completely different proxy sessions
  // This stops LinkedIn from linking your separate proxy requests together via tracking headers
  useSessionPool: true,
  persistCookiesPerSession: false,
  // Drops images, css, fonts, and media assets before parsing the response body
  ignoreSslErrors: true,
  additionalMimeTypes: [
    "text/html",
    "application/xhtml+xml",
    "application/xml",
  ],
};

export const preNavigationHooks = [
  ({ request }) => {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    ];
    const randomAgent =
      userAgents[Math.floor(Math.random() * userAgents.length)];

    request.headers = {
      "User-Agent": randomAgent,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    };
  },
];

export const preNavigationHooksForPost = [
  ({ request }) => {
    const userAgents = [
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
      "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    ];
    const randomAgent =
      userAgents[Math.floor(Math.random() * userAgents.length)];

    request.headers = {
      referer: "https://www.google.com/",
      "user-agent":
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
    };
  },
];
