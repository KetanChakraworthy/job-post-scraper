import { configDotenv } from "dotenv";
import { runJobScraper } from "./jobs/index.js";
import { runJobspyScraper } from "./jobs/jopspy.js";

configDotenv();

const OFFSET = 10;
const maxJobs = Number(process.env.MAX_JOBS);
const totalSearchPagesNeeded = Math.ceil(maxJobs / OFFSET);

const keywords = "Software Engineer";
const location = "India";
const experienceLevels = ["2", "3", "4"];
const startUrls = [];
let pagesGenerated = 0;
let currentStartOffset = 0;

while (pagesGenerated < totalSearchPagesNeeded) {
  for (const level of experienceLevels) {
    if (pagesGenerated >= totalSearchPagesNeeded) break;
    startUrls.push(
      `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_E=${level}&start=${currentStartOffset}`,
    );
    pagesGenerated++;
  }
  currentStartOffset += OFFSET;
}

const loadProxiesFromEnv = () => {
  const proxies = [];
  let index = 1;
  while (process.env[`PROXY_${index}`]) {
    const proxyUrl = process.env[`PROXY_${index}`].trim();
    if (proxyUrl) {
      proxies.push(proxyUrl);
    }
    index++;
  }

  console.log(
    `📡 Loaded ${proxies.length} proxy environments from system variables.`,
  );
  return proxies;
};
const proxies = loadProxiesFromEnv();
const config = { startUrls, proxies, maxJobs, totalSearchPagesNeeded };

function getScraperArgument() {
  const scraperArg = process.argv.find((arg) => arg.startsWith("--scraper="));
  if (!scraperArg) return null;
  return scraperArg.split("=")[1];
}

async function main() {
  const targetScraper = getScraperArgument();

  console.log("=".repeat(50));
  switch (targetScraper) {
    case "crawlee_jobs":
      console.log("Starting job scraper...");
      await runJobScraper(config);
      console.log("Ending job scraper...");
      break;
    case "crawlee_posts":
      console.log("Starting posts scraper...");
      console.log("Ending posts scraper...");
      break;
    case "jobspy":
      console.log("Starting job scraper...");
      await runJobspyScraper();
      console.log("Ending job scraper...");
      break;

    default:
      console.error("❌ Error: Missing or invalid scraper type specified!");
      console.log('Please use: "npm run crawlee" or "npm run jobspy"');
      process.exit(1);
  }
  console.log("=".repeat(50));
}

main().catch((err) => {
  console.error("An unexpected error occurred in the execution runner:", err);
  process.exit(1);
});
