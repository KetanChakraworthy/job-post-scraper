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

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: calculatedMaxRequests || 1000,
    maxConcurrency: safeConcurrency,

    maxRequestRetries: 3,
    maxSessionRotations: 5,

    useSessionPool: true,
    persistCookiesPerSession: false,

    proxyConfiguration,
    preNavigationHooks: [
      ({ request }) => {
        request.headers = {
          "User-Agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
          Accept:
            "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
          Connection: "keep-alive",
        };
      },
    ],

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
