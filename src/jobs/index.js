import { PlaywrightCrawler } from "crawlee";
import { client, connectToDatabase } from "../db/db.js";
import { requestHandler } from "./jobScraper.js";

export const runJobScraper = async () => {
  await connectToDatabase();

  const startUrl = "https://www.linkedin.com/jobs/search/?position=1&pageNum=0";

  const crawler = new PlaywrightCrawler({
    launchContext: {
      launchOptions: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage", // Prevents crashes out of memory shared limits
        ],
      },
    },
    maxRequestsPerCrawl: 15,
    requestHandler,
    failedRequestHandler({ request, log }) {
      log.error(`Request ${request.url} failed permanently.`);
    },
  });

  await crawler.run([startUrl]);

  await client.close();
  console.log("Finished deep scraping! MongoDB connection closed.");
};
