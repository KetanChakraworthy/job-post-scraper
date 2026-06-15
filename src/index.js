import { runJobScraper } from "./jobs/index.js";
import { runJobspyScraper } from "./jobs/jopspy.js";

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
      await runJobScraper();
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
