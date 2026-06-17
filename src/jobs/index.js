import { CheerioCrawler, Dataset, ProxyConfiguration } from "crawlee";
import { client, connectToDatabase } from "../db/db.js";
import { errorHandler, requestHandler } from "./jobScraper.js";

export const runJobScraper = async ({
  startUrls,
  maxJobs,
  totalSearchPagesNeeded,
  proxies,
}) => {
  await connectToDatabase();
  const calculatedMaxRequests = maxJobs + totalSearchPagesNeeded;
  let safeConcurrency = 2;
  if (maxJobs > 50 && maxJobs <= 500) safeConcurrency = 3;
  if (maxJobs > 500) safeConcurrency = 5;

  const proxyConfiguration = new ProxyConfiguration({
    proxyUrls: proxies,
  });

  const fetchReqConfigs = {
    maxRequestsPerCrawl: calculatedMaxRequests || 1000,
    maxConcurrency: safeConcurrency,
    maxRequestRetries: 3,
    maxSessionRotations: 5,
  };

  const sessionConfig = {
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

  const preNavigationHooks = [
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
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
      };
    },
  ];

  const crawler = new CheerioCrawler({
    ...fetchReqConfigs,
    ...sessionConfig,
    proxyConfiguration,
    preNavigationHooks,

    requestHandler,
    errorHandler,
    failedRequestHandler({ request, log }) {
      log.error(
        `❌ Request ${request.url} failed permanently after multiple Tor IP rotations.`,
      );
    },
  });

  await crawler.run(startUrls);

  await client.close();
  console.log("Finished deep scraping! MongoDB connection closed.");
};
