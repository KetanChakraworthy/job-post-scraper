import { PlaywrightCrawler, ProxyConfiguration } from "crawlee";
import fs from "fs";
import fse from "fs-extra";

// Function to generate a random email
function getRandomEmail() {
  const firstName = "John";
  const lastName = "Doe";
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${Math.floor(Math.random() * 1000)}@example.com`;
}

export const createAccountPool = async (numAccounts, proxies) => {
  const proxyConfiguration = new ProxyConfiguration({
    proxyUrls: proxies,
  });
  const crawler = new PlaywrightCrawler({
    proxyConfiguration,
    headless: false,

    async requestHandler({ page, enqueueLinks }) {
      const email = getRandomEmail();
      const password = "P@ssw0rd123";

      await page.goto("https://www.linkedin.com/start/join");

      // Fill in the first form (email and password)
      await page.fill("#email-address", email);
      await page.fill("#password", password);

      // Submit the first form
      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]'),
      ]);

      console.log("First form submitted");

      // Fill in the second form (first name, last name)
      const firstName = "John";
      const lastName = "Doe";

      await page.fill("#first-name", firstName);
      await page.fill("#last-name", lastName);

      // Submit the second form
      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]'),
      ]);

      console.log("Second form submitted");

      // Fill in the third form (location)
      const location = "San Francisco";

      // Use a different approach to select and fill the location
      // LinkedIn's dropdown might be dynamic, so you need to find the correct input field
      await page.type("#join-sig-location", location);

      // Wait for the location list to appear and select the first option
      await page.waitForSelector(".search-results__option");
      const locationOption = await page.$(".search-results__option");
      if (locationOption) {
        await locationOption.click();
      }

      console.log("Location selected");

      // Submit the third form
      await Promise.all([
        page.waitForNavigation(),
        page.click('button[type="submit"]'),
      ]);

      console.log("Third form submitted");

      // Wait for navigation to complete and profile to load
      try {
        await page.waitForNavigation({ waitUntil: "networkidle" });
        const isProfileLoaded = await page.evaluate(
          () => !!document.querySelector(".profile-photo"),
        );
        if (isProfileLoaded) {
          console.log("Signup successful");

          // Extract cookies
          const cookies = await page.cookies();
          const account = { email, password, cookies };

          // Save credentials and cookies to a JSON file
          fse.outputJsonSync("accounts.json", [account], { spaces: 2 });
        } else {
          console.error("Failed to create account");
        }
      } catch (error) {
        console.error("Error during signup:", error);
      }

      await enqueueLinks();
    },
  });

  // Start the crawl
  await crawler.run(["https://www.linkedin.com/start/join"]);
};
