import { chromium } from "playwright";
import fs from "fs";

async function test() {
  console.log("Loading cookies...");

  const data = JSON.parse(
    fs.readFileSync(
      "/Users/ketan_ch_drapcode/projects/job-post-scraper/src/posts/linkedin_cookies.json",
      "utf8",
    ),
  );
  const cookies = data.cookies || data;

  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // FIRST go to LinkedIn to set the domain context
  console.log("Going to LinkedIn...");
  await page.goto("https://www.linkedin.com/", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // NOW add cookies with correct domains
  console.log("Adding cookies...");
  await context.addCookies(
    cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: ".www.linkedin.com", // Force correct domain
      path: "/",
      secure: true,
      sameSite: "None",
    })),
  );

  // Try feed
  console.log("Going to feed...");
  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  await page.waitForTimeout(3000);

  console.log("URL:", page.url());

  if (page.url().includes("/feed") && !page.url().includes("/login")) {
    console.log("✅ SUCCESS!");
  } else {
    console.log("❌ Failed - the li_at cookie is likely expired or invalid");
    console.log("You need to extract NEW cookies");
  }

  await browser.close();
}

test().catch(console.error);
