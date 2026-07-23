import { configDotenv } from "dotenv";
import { runJobScraper } from "./jobs/index.js";
import { runJobspyScraper } from "./jobs/jopspy.js";
import { runPostScraper } from "./posts/index.js";
import { createAccountPool } from "./utils/sessionPool.js";
import { extractLinkedInCookies } from "./posts/extractCookies.js";
import { client, connectToDatabase } from "./db/db.js";

configDotenv();

const OFFSET = 16;
const maxJobs = Number(process.env.MAX_JOBS);
const totalSearchPagesNeeded = Math.ceil(maxJobs / OFFSET);

const getJobUrls = () => {
  const SEARCH_QUERY = "";
  const SEARCH_LOCATION = "Remote";
  const INDEED_HOST = "www.indeed.com";
  const startUrls = [];
  let pagesGenerated = 0;
  let currentStartOffset = 0;

  while (pagesGenerated < totalSearchPagesNeeded) {
    if (pagesGenerated >= totalSearchPagesNeeded) break;
    startUrls.push(
      `https://${INDEED_HOST}/jobs?q=${encodeURIComponent(SEARCH_QUERY)}` +
        `&l=${encodeURIComponent(SEARCH_LOCATION)}&sort=date&start=${currentStartOffset}`,
    );
    pagesGenerated++;
    currentStartOffset += OFFSET;
  }
  return startUrls;
};

export const loadProxiesFromEnv = async () => {
  const webshareToken = process.env.WEBSHARE_TOKEN;

  if (!webshareToken) {
    throw new Error("WEBSHARE_TOKEN is not set.");
  }

  const proxies = [];
  let page = 1;
  let hasNext = true;

  while (hasNext) {
    const url = new URL("https://proxy.webshare.io/api/v2/proxy/list/");
    url.searchParams.append("mode", "direct");
    url.searchParams.append("page", page);
    url.searchParams.append("page_size", "100");

    const req = await fetch(url.href, {
      method: "GET",
      headers: {
        Authorization: `Token ${webshareToken}`,
      },
    });

    if (!req.ok) {
      throw new Error(
        `Failed to fetch proxies: ${req.status} ${req.statusText}`,
      );
    }

    const res = await req.json();

    proxies.push(
      ...res.results.map(
        ({ username, password, proxy_address, port }) =>
          `http://${username}:${password}@${proxy_address}:${port}`,
      ),
    );

    hasNext = !!res.next;
    page++;
  }

  console.log(`📡 Loaded ${proxies.length} proxies from Webshare.`);

  return proxies;
};
const proxies = await loadProxiesFromEnv();
console.log("=".repeat(50));
console.log("proxies", proxies);
console.log("=".repeat(50));
const config = { proxies, maxJobs, totalSearchPagesNeeded };

function getScraperArgument() {
  const scraperArg = process.argv.find((arg) => arg.startsWith("--scraper="));
  if (!scraperArg) return null;
  return scraperArg.split("=")[1];
}

async function main() {
  const targetScraper = getScraperArgument();

  console.log("=".repeat(50));
  await connectToDatabase();
  switch (targetScraper) {
    case "crawlee_jobs":
      console.log("Starting job scraper...");
      config.startUrls = getJobUrls();
      await runJobScraper(config);
      console.log("Ending job scraper...");
      break;
    case "crawlee_posts":
      console.log("Starting posts scraper...");
      config.profileUrls = [
        "https://www.linkedin.com/in/pranav-pathak-a41821209/",
      ];
      await runPostScraper({ ...config, postsPerProfile: 5 });
      console.log("Ending posts scraper...");
      break;
    case "jobspy":
      console.log("Starting job scraper...");
      await runJobspyScraper();
      console.log("Ending job scraper...");
      break;
    case "gen_session_pool":
      await createAccountPool(1, proxies);
    case "extract-linkedin-cookies":
      await extractLinkedInCookies();
    default:
      console.error("❌ Error: Missing or invalid scraper type specified!");
      console.log('Please use: "npm run crawlee" or "npm run jobspy"');
      process.exit(1);
  }
  await client.close();
  console.log("=".repeat(50));
}

main().catch((err) => {
  console.error("An unexpected error occurred in the execution runner:", err);
  process.exit(1);
});
