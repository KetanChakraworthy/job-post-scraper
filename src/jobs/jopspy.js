import { scrapeJobs } from "ts-jobspy";
import fs from "fs";
import { client, connectToDatabase, saveJobToDatabase } from "../db/db.js";

export const runJobspyScraper = async () => {
  await connectToDatabase();

  const jobs = await scrapeJobs({
    siteName: ["linkedin"],
    searchTerm: "software engineer",
    location: "San Francisco, CA",
    resultsWanted: 20,
    hoursOld: 72,
    countryIndeed: "USA",
    linkedinFetchDescription: true,
  });

  console.log(`Found ${jobs.length} jobs`);
  await Promise.all(
    jobs.map(async (job) => {
      await saveJobToDatabase({ job, scraperType: "JOBSPY" });
    }),
  );

  await client.close();
};
