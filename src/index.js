import { configDotenv } from "dotenv";
import { runJobScraper } from "./jobs/index.js";
import { runJobspyScraper } from "./jobs/jopspy.js";

configDotenv();

const keywords = "Software Engineer";
const location = "United States";
const experienceLevels = ["2", "3", "4"];
const startUrl = [];

for (const level of experienceLevels) {
  for (let start = 0; start < 250; start += 25) {
    startUrl.push(
      `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_E=${level}&start=${start}`,
    );
  }
}

const proxy1 = process.env.PROXY_1;
const proxy2 = process.env.PROXY_2;
const proxy3 = process.env.PROXY_3;
const proxy4 = process.env.PROXY_4;
const maxJobs = Number(process.env.MAX_JOBS);
console.log("\n Start URL:", startUrl.join("\n"));
console.log("\n maxJobs:", maxJobs);

const config = { startUrl, proxy1, proxy2, proxy3, proxy4, maxJobs };

function getScraperArgument() {
  const scraperArg = process.argv.find((arg) => arg.startsWith("--scraper="));
  if (!scraperArg) return null;
  return scraperArg.split("=")[1];
}

async function main() {
  const targetScraper = getScraperArgument();

  console.log("=".repeat(50));
  console.log("Starting job scraper...");
  switch (targetScraper) {
    case "crawlee":
      await runJobScraper(config);
      break;

    case "jobspy":
      await runJobspyScraper();
      break;

    default:
      console.error("❌ Error: Missing or invalid scraper type specified!");
      console.log('Please use: "npm run crawlee" or "npm run jobspy"');
      process.exit(1);
  }
  console.log("Ending job scraper...");
  console.log("=".repeat(50));
}

main().catch((err) => {
  console.error("An unexpected error occurred in the execution runner:", err);
  process.exit(1);
});
