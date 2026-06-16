import { BrowserName, DeviceCategory, PlaywrightCrawler } from "crawlee";
import { client, connectToDatabase } from "../db/db.js";
import { requestHandler } from "./jobScraper.js";

const forceTorNewIdentity = async () => {
  return new Promise((resolve) => {
    const socket = net.connect({ port: 9051, host: "127.0.0.1" }, () => {
      // 1. Authenticate with the open control port
      socket.write('AUTHENTICATE ""\r\n');
      // 2. Send the specific native Tor instruction for a fresh circuit/identity
      socket.write("SIGNAL NEWNYM\r\n");
      socket.write("QUIT\r\n");
    });

    socket.on("data", () => socket.end());
    socket.on("end", () => resolve(true));
    socket.on("error", () => resolve(false)); // Fail silently if Tor is currently cycling
  });
};

export const runJobScraper = async () => {
  await connectToDatabase();

  const startUrl = "https://www.linkedin.com/jobs/search/?position=1&pageNum=0";

  const crawler = new PlaywrightCrawler({
    maxRequestsPerCrawl: 15,
    maxConcurrency: 1,
    maxRequestRetries: 3,
    browserPoolOptions: {
      useFingerprints: true,
      fingerprintOptions: {
        fingerprintGeneratorOptions: {
          browsers: [BrowserName.chrome, BrowserName.firefox],
          devices: [DeviceCategory.desktop],
          locales: ["en-US", "en"],
        },
      },
    },
    launchContext: {
      launchOptions: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
        ],
      },
    },
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
