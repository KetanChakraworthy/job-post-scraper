import { CheerioCrawler, Dataset, ProxyConfiguration } from "crawlee";
import { client, connectToDatabase } from "../db/db.js";
import { requestHandler } from "./jobScraper.js";

const forceTorNewIdentity = async () => {
  return new Promise((resolve) => {
    const socket = net.connect({ port: 9051, host: "127.0.0.1" }, () => {
      socket.write('AUTHENTICATE ""\r\n');
      socket.write("SIGNAL NEWNYM\r\n");
      socket.write("QUIT\r\n");
    });

    socket.on("data", () => socket.end());
    socket.on("end", () => resolve(true));
    socket.on("error", () => resolve(false));
  });
};

export const runJobScraper = async ({
  startUrl,
  proxy1,
  proxy2,
  proxy3,
  proxy4,
  maxPosts,
}) => {
  await connectToDatabase();

  const proxyConfiguration = new ProxyConfiguration({
    proxyUrls: [proxy1, proxy2, proxy3, proxy4],
  });
  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: maxPosts,
    maxConcurrency: 1,

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
    errorHandler: async ({ error, session, log }) => {
      // Check if the error thrown came from our custom LinkedIn block handler
      if (
        error.message.includes("LinkedIn blocked") ||
        error.message.includes("login wall")
      ) {
        log.warning(`🚨 Tor Node Blocked! Requesting fresh Tor circuit...`);

        // 1. Retires Crawlee's internal profile session
        session?.retire();

        // 2. Issue the system command to get a brand new Tor network IP address
        const rotationSuccess = await forceTorNewIdentity();
        if (rotationSuccess) {
          log.info(
            `🔄 Success: Tor identity cycled. Waiting for network stabilisation...`,
          );
          // Give the server a 2-second breather to establish the new global circuit path safely
          await new Promise((res) => setTimeout(res, 2000));
        }
      }
    },
    failedRequestHandler({ request, log }) {
      log.error(
        `❌ Request ${request.url} failed permanently after multiple Tor IP rotations.`,
      );
    },
  });

  await crawler.run([startUrl]);

  await client.close();
  console.log("Finished deep scraping! MongoDB connection closed.");
};
