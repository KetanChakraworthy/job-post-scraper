import { chromium } from "playwright";
import fs from "fs";

const COOKIE_FILE = "./linkedin_cookies.json";

async function extractLinkedInCookies() {
  console.log("🔐 LinkedIn Cookie Extractor");
  console.log("========================================");
  console.log("Instructions:");
  console.log("1. Login manually in the browser window");
  console.log("2. After login, wait for the page to fully load");
  console.log("3. Press ENTER in this terminal to save cookies");
  console.log("========================================\n");

  const browser = await chromium.launch({
    headless: false,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Navigate to LinkedIn login
  await page.goto("https://www.linkedin.com/login", {
    waitUntil: "networkidle",
    timeout: 30000,
  });

  console.log("⏳ Browser opened. Please login manually...");
  console.log(
    "📌 Press ENTER in this terminal AFTER you see the LinkedIn homepage\n",
  );

  // Wait for user to press ENTER
  await new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.once("data", () => {
      resolve();
    });
  });

  console.log("✅ Extracting cookies...");

  try {
    // Wait a bit more for all cookies to be set
    await page.waitForTimeout(3000);

    // Navigate to ensure all cookies are captured
    await page
      .goto("https://www.linkedin.com/feed/", {
        waitUntil: "networkidle",
        timeout: 15000,
      })
      .catch(() => {
        console.log("⚠️ Could not navigate to feed, but continuing...");
      });

    await page.waitForTimeout(2000);

    // Extract all cookies
    const cookies = await context.cookies();

    // Filter LinkedIn cookies
    const linkedinCookies = cookies.filter(
      (cookie) => cookie.domain && cookie.domain.includes("linkedin.com"),
    );

    console.log(`📊 Found ${linkedinCookies.length} LinkedIn cookies`);

    // Check for critical cookies
    const criticalCookies = ["li_at", "JSESSIONID", "li_a", "sl"];
    const foundCritical = linkedinCookies.filter((c) =>
      criticalCookies.includes(c.name),
    );

    if (foundCritical.length > 0) {
      console.log(
        `🔑 Found critical cookies: ${foundCritical.map((c) => c.name).join(", ")}`,
      );
    } else {
      console.warn(
        "⚠️ No critical auth cookies found! You may not be logged in properly.",
      );
    }

    // Save cookies
    const cookieData = {
      extracted: new Date().toISOString(),
      totalCookies: linkedinCookies.length,
      cookies: linkedinCookies.map((cookie) => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path || "/",
        expires: cookie.expires || -1,
        httpOnly: cookie.httpOnly || false,
        secure: cookie.secure || false,
        sameSite: cookie.sameSite || "Lax",
      })),
    };

    fs.writeFileSync(COOKIE_FILE, JSON.stringify(cookieData, null, 2));
    console.log(`💾 Cookies saved to ${COOKIE_FILE}`);

    // Show cookie details
    console.log("\n📋 Cookie names:");
    linkedinCookies.forEach((c) => {
      console.log(`   - ${c.name}`);
    });
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await browser.close();
    console.log("🏁 Done!");
  }
}

// Run
extractLinkedInCookies().catch(console.error);

export { extractLinkedInCookies };
