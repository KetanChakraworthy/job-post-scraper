import { chromium } from "playwright";
import fs from "fs";
import { savePostToDatabase } from "../db/db.js";

function loadCookies() {
  const COOKIE_FILE =
    "/Users/ketan_ch_drapcode/projects/job-post-scraper/src/posts/linkedin_cookies.json";

  try {
    const data = JSON.parse(fs.readFileSync(COOKIE_FILE, "utf8"));
    let cookies = data.cookies || data;

    cookies = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: ".www.linkedin.com",
      path: "/",
      secure: true,
      sameSite: "None",
    }));

    console.log(`✅ Loaded ${cookies.length} cookies`);
    return cookies;
  } catch (error) {
    console.error("Error loading cookies:", error.message);
    return null;
  }
}

export async function runPostScraper({ profileUrls }) {
  console.log(`📊 Starting LinkedIn post scraper\n`);

  const cookies = loadCookies();
  if (!cookies) throw new Error("Failed to load cookies");

  // Use fresh browser with cookies instead of profile
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // First go to LinkedIn to set domain context
  await page.goto("https://www.linkedin.com/", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });

  // Add cookies
  await context.addCookies(cookies);
  console.log("🍪 Cookies added\n");

  // Verify authentication
  await page.goto("https://www.linkedin.com/feed/", {
    waitUntil: "domcontentloaded",
    timeout: 15000,
  });
  await page.waitForTimeout(2000);

  if (page.url().includes("/login")) {
    console.log("❌ Cookies expired. Re-extract cookies.");
    await browser.close();
    return;
  }

  console.log("✅ Authenticated\n");

  for (const url of profileUrls) {
    const handle = url.split("/in/")[1]?.replace(/\/$/, "")?.split("?")[0];

    console.log(`👤 ${handle}`);

    try {
      // Go to posts page
      await page.goto(
        `https://www.linkedin.com/in/${handle}/recent-activity/all/`,
        {
          waitUntil: "domcontentloaded",
          timeout: 30000,
        },
      );
      await page.waitForTimeout(3000);

      // Check for login redirect
      if (page.url().includes("/login")) {
        console.log(`  ⚠️ Profile ${handle} requires login - skipping`);
        continue;
      }

      // Scroll to load posts
      await page.evaluate(async () => {
        for (let i = 0; i < 10; i++) {
          window.scrollBy(0, 500);
          await new Promise((r) => setTimeout(r, 800));
        }
      });
      await page.waitForTimeout(2000);

      // Extract posts
      const posts = await page.evaluate(() => {
        const elements = document.querySelectorAll(
          ".feed-shared-update-v2, article.feed-shared-update-v2, .occludable-update",
        );

        return Array.from(elements)
          .map((el, i) => {
            const textEl = el.querySelector(
              ".feed-shared-update-v2__description, .feed-shared-text, .update-components-text, .break-words",
            );
            return {
              index: i,
              text: textEl ? textEl.innerText.trim() : "",
            };
          })
          .filter((p) => p.text.length > 5);
      });

      console.log(`📝 Posts: ${posts.length}`);
      console.log(`📝 Post Obj: ${JSON.stringify(posts)}`);
      Promise.all(
        posts.map(async (post) => {
          await savePostToDatabase({
            post,
            log: console,
            scraperType: "CRAWLEE",
          });
        }),
      );
      // Delay
      await new Promise((r) => setTimeout(r, 3000 + Math.random() * 5000));
    } catch (error) {
      console.error(`❌ ${error.message}`);
    }
  }

  await browser.close();
  console.log("\n✅ Done");
}
