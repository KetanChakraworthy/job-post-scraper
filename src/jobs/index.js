import { CheerioCrawler, Dataset, ProxyConfiguration } from "crawlee";
import { errorHandler, requestHandler } from "./jobScraper.js";
import {
  fetchReqConfig,
  sessionConfig,
  preNavigationHooks,
} from "../utils/crawlee.util.js";

export const runJobScraper = async ({
  startUrls,
  maxJobs,
  totalSearchPagesNeeded,
  proxies,
}) => {
  const calculatedMaxRequests = maxJobs + totalSearchPagesNeeded;
  let safeConcurrency = 2;
  if (maxJobs > 50 && maxJobs <= 500) safeConcurrency = 3;
  if (maxJobs > 500) safeConcurrency = 5;

  const proxyConfiguration = new ProxyConfiguration({
    proxyUrls: proxies,
  });

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: calculatedMaxRequests || 1000,
    ...fetchReqConfig({ calculatedMaxRequests, safeConcurrency }),
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

  console.log("Finished deep scraping! MongoDB connection closed.");
};
