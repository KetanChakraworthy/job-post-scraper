import { configDotenv } from "dotenv";
import { runJobScraper } from "./jobs/index.js";
import { runJobspyScraper } from "./jobs/jopspy.js";

configDotenv();

const startUrl = [
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Software%20Engineer&location=United%20States&f_TPR=r259200&start=0", // Jobs 1-25
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Software%20Engineer&location=United%20States&f_TPR=r259200&start=25", // Jobs 26-50
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Software%20Engineer&location=United%20States&f_TPR=r259200&start=50", // Jobs 51-75
  "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=Software%20Engineer&location=United%20States&f_TPR=r259200&start=75", // Jobs 76-100
];

const proxy1 = process.env.PROXY_1;
const proxy2 = process.env.PROXY_2;
const proxy3 = process.env.PROXY_3;
const proxy4 = process.env.PROXY_4;
const maxJobs = Number(process.env.MAX_JOBS);
console.log("\n Start URL:", startUrl.join("\n"));
console.log("\n Proxy 1:", proxy1);
console.log("\n Proxy 2:", proxy2);
console.log("\n Proxy 3:", proxy3);
console.log("\n Proxy 4:", proxy4);
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
