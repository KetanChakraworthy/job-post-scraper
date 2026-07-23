import { chromium } from "playwright";
import fs from "fs";
import { savePostToDatabase } from "../db/db.js";

function loadCookies() {
  const COOKIE_FILE = process.env.COOKIE_PATH;
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

// Detect if URL is a company or user profile
function detectProfileType(url) {
  if (url.includes("/company/")) return "company";
  if (url.includes("/in/")) return "user";
  return "unknown";
}

// Extract handle from URL
function extractHandle(url) {
  if (url.includes("/company/")) {
    return url.split("/company/")[1]?.replace(/\/$/, "")?.split("?")[0];
  }
  if (url.includes("/in/")) {
    return url.split("/in/")[1]?.replace(/\/$/, "")?.split("?")[0];
  }
  return url;
}

export async function runPostScraper({
  profileUrls,
  proxies = [],
  postsPerProfile = 5,
}) {
  console.log(`📊 Starting LinkedIn post scraper\n`);
  console.log(`📊 Posts to extract per profile: ${postsPerProfile}\n`);

  const cookies = loadCookies();
  if (!cookies) throw new Error("Failed to load cookies");

  // Launch browser with proxy support
  const launchOptions = {
    headless: true,
    args: [
      "--disable-blink-features=AutomationControlled",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
      "--disable-features=IsolateOrigins,site-per-process",
      "--disable-gpu",
      "--disable-setuid-sandbox",
      "--no-zygote",
      "--single-process",
    ],
  };

  // Add proxy if provided
  if (proxies && proxies.length > 0) {
    const proxyUrl = proxies[0];
    const proxyMatch = proxyUrl.match(/http:\/\/(.*):(.*)@(.*):(\d+)/);

    if (proxyMatch) {
      launchOptions.proxy = {
        server: `http://${proxyMatch[3]}:${proxyMatch[4]}`,
        username: proxyMatch[1],
        password: proxyMatch[2],
      };
      console.log(`🔒 Using proxy: ${proxyMatch[3]}:${proxyMatch[4]}\n`);
    } else {
      console.log("⚠️ Invalid proxy format, running without proxy\n");
    }
  }

  const browser = await chromium.launch(launchOptions);

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36",
  });

  const page = await context.newPage();

  // Add anti-detection scripts
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => false });
    Object.defineProperty(navigator, "plugins", { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, "languages", {
      get: () => ["en-US", "en"],
    });
    window.chrome = { runtime: {} };
  });

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
    const handle = extractHandle(url);
    const profileType = detectProfileType(url);

    console.log(
      `👤 ${profileType === "company" ? "🏢 Company" : "👤 User"}: ${handle}`,
    );

    try {
      // Build posts URL based on profile type
      let postsUrl;
      if (profileType === "company") {
        postsUrl = `https://www.linkedin.com/company/${handle}/posts/`;
      } else {
        postsUrl = `https://www.linkedin.com/in/${handle}/recent-activity/all/`;
      }

      console.log(`  🔗 Posts URL: ${postsUrl}`);

      // Go to posts page
      await page.goto(postsUrl, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
      await page.waitForTimeout(3000);

      // Check for login redirect
      if (page.url().includes("/login")) {
        console.log(`  ⚠️ Profile ${handle} requires login - skipping`);
        continue;
      }

      // Click "Show more" buttons to expand text
      console.log('  📖 Expanding "Show more" text...');
      let clickAttempts = 0;
      while (clickAttempts < 20) {
        const clicked = await page.evaluate(() => {
          const showMoreButtons = document.querySelectorAll(
            ".feed-shared-inline-show-more-text__see-more-less-btn, " +
              ".see-more, " +
              '[aria-label="Show more"]',
          );

          let didClick = false;
          showMoreButtons.forEach((btn) => {
            if (btn.offsetParent !== null) {
              btn.click();
              didClick = true;
            }
          });
          return didClick;
        });

        if (!clicked) break;
        await page.waitForTimeout(500);
        clickAttempts++;
      }
      console.log("  ✅ Text expanded");

      // Scroll to load posts with human-like behavior
      console.log("  📜 Loading posts...");
      let previousPostCount = 0;
      let scrollAttempts = 0;
      const maxScrolls = 30;

      while (scrollAttempts < maxScrolls) {
        await page.evaluate(async () => {
          const scrollAmount = 300 + Math.random() * 500;
          window.scrollBy({
            top: scrollAmount,
            behavior: "smooth",
          });
          await new Promise((r) => setTimeout(r, 500 + Math.random() * 1000));
        });

        await page.waitForTimeout(1000);

        const currentPostCount = await page.evaluate(() => {
          return document.querySelectorAll(
            ".feed-shared-update-v2, article.feed-shared-update-v2, .occludable-update",
          ).length;
        });

        if (
          currentPostCount >= postsPerProfile &&
          currentPostCount === previousPostCount
        ) {
          break;
        }

        previousPostCount = currentPostCount;
        scrollAttempts++;
      }
      await page.waitForTimeout(2000);

      // Extract detailed post information
      console.log("  🔍 Extracting post details...");
      const posts = await page.evaluate((maxPosts) => {
        const postElements = document.querySelectorAll(
          ".feed-shared-update-v2, article.feed-shared-update-v2, .occludable-update",
        );

        return Array.from(postElements)
          .slice(0, maxPosts)
          .map((post, index) => {
            try {
              // Get post text
              const textEl = post.querySelector(
                ".feed-shared-update-v2__description, " +
                  ".feed-shared-text, " +
                  ".update-components-text, " +
                  ".break-words, " +
                  ".feed-shared-inline-show-more-text",
              );
              const text = textEl ? textEl.innerText.trim() : "";

              // Get author info (for company pages, author might be the company itself)
              const authorEl = post.querySelector(
                ".feed-shared-actor__name, " +
                  ".update-components-actor__name, " +
                  'span[dir="ltr"]',
              );
              const author = authorEl ? authorEl.innerText.trim() : "";

              const authorUrlEl = post.querySelector(
                ".feed-shared-actor__container a, " +
                  ".update-components-actor__container a",
              );
              const authorUrl = authorUrlEl ? authorUrlEl.href : "";

              // Get timestamp
              const timeEl = post.querySelector("time");
              const timestamp = timeEl
                ? timeEl.getAttribute("datetime") || timeEl.innerText.trim()
                : "";

              // Get post URL - try multiple methods to get unique URL
              let postUrl = window.location.href;

              // Method 1: Direct feed update link
              const feedLink = post.querySelector('a[href*="/feed/update/"]');
              if (feedLink) {
                postUrl = feedLink.href;
              }

              // Method 2: Post URN link
              if (postUrl === window.location.href) {
                const urnLink = post.querySelector("a[data-urn]");
                if (urnLink) {
                  postUrl = urnLink.href;
                }
              }

              // Method 3: Activity link
              if (postUrl === window.location.href) {
                const activityLink = post.querySelector(
                  'a[href*="/posts/"], a[href*="/activity-"]',
                );
                if (activityLink) {
                  postUrl = activityLink.href;
                }
              }

              // Method 4: Try to get from the post container's ID
              if (postUrl === window.location.href) {
                const postId =
                  post.getAttribute("data-urn") || post.getAttribute("id");
                if (postId) {
                  postUrl = `https://www.linkedin.com/feed/update/${postId}`;
                }
              }

              // Get engagement metrics
              const reactionsEl = post.querySelector(
                ".social-details-social-counts__reactions-count, " +
                  ".social-actions__reactions, " +
                  '[data-test-id="social-actions__reactions"]',
              );
              const commentsEl = post.querySelector(
                ".social-details-social-counts__comments, " +
                  ".social-actions__comments, " +
                  '[data-test-id="social-actions__comments"]',
              );

              const reactions = reactionsEl
                ? reactionsEl.innerText.trim()
                : "0";
              const comments = commentsEl ? commentsEl.innerText.trim() : "0";

              // Get all images
              const images = Array.from(post.querySelectorAll("img"))
                .map((img) => ({
                  src: img.src,
                  alt: img.alt || "",
                  width: img.naturalWidth,
                  height: img.naturalHeight,
                }))
                .filter(
                  (img) =>
                    !img.src.includes("profile") &&
                    !img.src.includes("avatar") &&
                    !img.src.includes("logo") &&
                    !img.src.includes("company") &&
                    img.width > 100,
                );

              // Get all videos
              const videos = Array.from(
                post.querySelectorAll("video, video source"),
              )
                .map((video) => ({
                  src: video.src || video.getAttribute("src"),
                  type: video.type || video.getAttribute("type") || "",
                  poster: video.getAttribute("poster") || "",
                }))
                .filter((v) => v.src);

              // Get documents/attachments
              const documents = Array.from(
                post.querySelectorAll(
                  'a[href*="/document/"], a[href*="/file/"]',
                ),
              ).map((doc) => ({
                url: doc.href,
                text: doc.innerText.trim(),
              }));

              // Get article/external links
              const links = Array.from(
                post.querySelectorAll(
                  '.feed-shared-article__link, a[href*="http"]',
                ),
              )
                .map((link) => ({
                  url: link.href,
                  text: link.innerText.trim(),
                }))
                .filter(
                  (link) =>
                    !link.url.includes("linkedin.com/in/") &&
                    !link.url.includes("/feed/update/") &&
                    !link.url.includes("/posts/") &&
                    link.text.length > 0,
                );

              // Extract hashtags
              const hashtags = text.match(/#\w+/g) || [];

              // Check if it's a repost
              const isRepost =
                post
                  .querySelector(
                    ".feed-shared-actor__sub-description, " +
                      ".update-components-actor__sub-description",
                  )
                  ?.innerText?.includes("reposted") || false;

              return {
                index,
                text,
                author,
                authorUrl,
                timestamp,
                url: postUrl,
                reactions,
                comments,
                images,
                videos,
                documents,
                links,
                hashtags,
                isRepost,
                scrapedAt: new Date().toISOString(),
              };
            } catch (e) {
              return {
                index,
                error: e.message,
                text: "",
              };
            }
          })
          .filter(
            (post) =>
              post.text.length > 5 ||
              post.images.length > 0 ||
              post.videos.length > 0,
          );
      }, postsPerProfile);

      console.log(`  📝 Posts found: ${posts.length}`);

      // Log post details
      posts.forEach((post, i) => {
        const mediaInfo = [];
        if (post.images.length > 0)
          mediaInfo.push(`${post.images.length} images`);
        if (post.videos.length > 0)
          mediaInfo.push(`${post.videos.length} videos`);
        if (post.documents.length > 0)
          mediaInfo.push(`${post.documents.length} docs`);

        console.log(`  ┌─ Post ${i + 1}`);
        console.log(`  │ 📝 ${post.text.substring(0, 80)}...`);
        if (mediaInfo.length > 0) console.log(`  │ 📎 ${mediaInfo.join(", ")}`);
        if (post.hashtags.length > 0)
          console.log(`  │ 🏷️ ${post.hashtags.join(", ")}`);
        console.log(`  │ 🔗 ${post.url}`);
        console.log(
          `  └─ 💬 ${post.comments} comments | ❤️ ${post.reactions} reactions`,
        );
      });

      // Save to database
      try {
        await Promise.all(
          posts.map(async (post, index) => {
            // Create a unique ID for each post
            const postUrl = post.url || "";
            const isDefaultUrl =
              postUrl.includes("/posts/") ||
              postUrl.includes("/recent-activity/");

            const uniqueId = !isDefaultUrl
              ? postUrl
              : `${handle}_${profileType}_post_${index}_${Date.now()}`;

            await savePostToDatabase({
              post: {
                ...post,
                id: uniqueId,
                url: postUrl,
                profileHandle: handle,
                profileType: profileType,
              },
              log: console,
              scraperType: "PLAYWRIGHT",
            });
          }),
        );
        console.log("  ✅ Posts saved to database");
      } catch (dbError) {
        console.error(`  ❌ Database error: ${dbError.message}`);
      }

      // Delay between profiles
      const delay = 3000 + Math.random() * 5000;
      console.log(
        `  ⏳ Waiting ${Math.floor(delay / 1000)}s before next profile...\n`,
      );
      await new Promise((r) => setTimeout(r, delay));
    } catch (error) {
      console.error(`❌ Error scraping ${handle}: ${error.message}\n`);
    }
  }

  await browser.close();
  console.log("✅ Scraping completed");
}
