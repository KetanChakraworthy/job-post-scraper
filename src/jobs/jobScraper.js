import { saveJobToDatabase } from "../db/db.js";

export const handleSearchPage = async ({ page, enqueueLinks, log }) => {
  log.info("Processing search listing page via Tor...");

  try {
    await page.waitForSelector("ul.jobs-search__results-list", {
      timeout: 15000,
    });
  } catch (err) {
    log.error(
      "LinkedIn blocked: Could not load search results wrapper. LinkedIn might have flagged this Tor node.",
    );
    return;
  }

  // Scrolling 3-4 times gives you a broader batch of links per search crawl execution.
  for (let i = 0; i < 4; i++) {
    log.info(`Scrolling to fetch more jobs (Batch ${i + 1}/4)...`);

    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    const fluidScrollPause = Math.floor(Math.random() * 1500) + 1500;
    await new Promise((res) => setTimeout(res, fluidScrollPause));
  }

  const initialLinks = await page.$$eval(
    "ul.jobs-search__results-list li a.base-card__full-link",
    (links) => {
      return links.map((a) => a.href);
    },
  );

  if (initialLinks.length === 0) {
    log.warning(
      "No links found with primary selector. Checking fallback public layouts...",
    );
    const fallbackLinks = await page.$$eval("a[href*='/jobs/view/']", (links) =>
      links.map((a) => a.href),
    );
    if (fallbackLinks.length > 0) {
      initialLinks.push(...fallbackLinks);
    }
  }
  const uniqueLinks = [...new Set(initialLinks)];

  log.info(
    `Enqueuing ${uniqueLinks.length} unique job details pages via Tor pool.`,
  );

  await enqueueLinks({
    urls: uniqueLinks,
    userData: { label: "JOB_DETAIL" },
  });
};

const extractJobDetails = ($, currentUrl) => {
  const title = $("h1.top-card-layout__title, .topcard__title").text().trim();
  const companyName = $("a.topcard__org-name-link").first().text().trim();
  const companyLinkedinUrl = $("a.topcard__org-name-link").first().attr("href");
  const companyLogo = $("img.artdeco-entity-image, img.topcard__logo").attr(
    "src",
  );

  // LinkedIn guest pages use slightly fluid selectors for location & time
  const location = $("span.topcard__flavor--bullet, .topcard__flavor--last")
    .first()
    .text()
    .trim();
  const postedAt = $("span.posted-time-ago__text, .topcard__flavor--metadata")
    .first()
    .text()
    .trim();
  const applicantsCount = $(
    "span.num-applicants__caption, .topcard__flavor--applicants",
  )
    .text()
    .trim();

  const descContainer = $(".description__text");
  const descriptionHtml = descContainer.length
    ? descContainer.html().trim()
    : null;
  const descriptionText = descContainer.length
    ? descContainer.text().trim()
    : null;

  // Map the bottom criteria table items (Employment Type, Seniority, etc.)
  const criteria = {};
  $(".description__job-criteria-item").each((_, item) => {
    const header = $(item)
      .find(".description__job-criteria-subheader")
      .text()
      .trim();
    const value = $(item).find(".description__job-criteria-text").text().trim();
    if (header && value) {
      criteria[header] = value;
    }
  });

  // Safe fallback to grab Job ID from either URL format style
  let jobId = null;
  if (currentUrl.includes("/view/")) {
    jobId = currentUrl.split("/view/")[1]?.split("?")[0];
  } else {
    jobId = currentUrl.split("-").pop()?.split("?")[0];
  }

  return {
    id: jobId || currentUrl,
    link: currentUrl,
    title: title || null,
    companyName: companyName || null,
    companyLinkedinUrl: companyLinkedinUrl || null,
    companyLogo: companyLogo || null,
    location: location || null,
    postedAt: postedAt || null,
    applicantsCount: applicantsCount || null,
    descriptionHtml,
    descriptionText,
    seniorityLevel: criteria["Seniority level"] || null,
    employmentType: criteria["Employment type"] || null,
    jobFunction: criteria["Job function"] || null,
    industries: criteria["Industries"] || null,
  };
};
export const requestHandler = async ({ request, $, log, enqueueLinks }) => {
  const url = new URL(request.url);

  if (url.pathname.includes("/jobs-guest/jobs/api/seeMoreJobPostings/search")) {
    log.info(`Querying hidden API list via Residential Proxy...`);

    const jobCards = $(".base-search-card");
    if (jobCards.length === 0) {
      log.warning(
        "No jobs returned. Retrying with a fresh rotating residential IP...",
      );
      throw new Error("Empty response from endpoint"); // Forces Crawlee to rotate IP and retry
    }

    const detailUrls = [];
    jobCards.each((_, el) => {
      const targetLink = $(el).find("a.base-card__full-link").attr("href");
      if (targetLink) detailUrls.push(targetLink);
    });

    log.info(`Enqueuing ${detailUrls.length} detail pages into proxy stream.`);
    await enqueueLinks({
      urls: detailUrls,
      userData: { label: "DETAIL" },
    });
  } else if (request.userData.label === "DETAIL") {
    log.info(`Extracting job raw data payload from: ${request.url}`);

    const jobData = extractJobDetails($, request.url);

    if (jobData.title) {
      await saveJobToDatabase({ job: jobData, log });
    }

    await new Promise((res) =>
      setTimeout(res, Math.floor(Math.random() * 1000) + 1000),
    );
  }
};
