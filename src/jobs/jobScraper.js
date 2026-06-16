import { saveJobToDatabase } from "../db/db.js";

export const handleSearchPage = async ({ page, enqueueLinks, log }) => {
  log.info("Processing search listing page via Tor...");

  try {
    await page.waitForSelector("ul.jobs-search__results-list", {
      timeout: 15000,
    });
  } catch (err) {
    log.error(
      "Could not load search results wrapper. LinkedIn might have flagged this Tor node.",
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

const extractJobDetails = async (page, url) => {
  return await page.evaluate((currentUrl) => {
    const title = document
      .querySelector("h1.top-card-layout__title")
      ?.innerText?.trim();
    const companyName = document
      .querySelector("a.topcard__org-name-link")
      ?.innerText?.trim();
    const companyLinkedinUrl = document.querySelector(
      "a.topcard__org-name-link",
    )?.href;
    const companyLogo = document.querySelector("img.artdeco-entity-image")?.src;
    const location = document
      .querySelector("span.topcard__flavor--bullet")
      ?.innerText?.trim();
    const postedAt = document
      .querySelector("span.posted-time-ago__text")
      ?.innerText?.trim();
    const applicantsCount = document
      .querySelector("span.num-applicants__caption")
      ?.innerText?.trim();

    const descContainer = document.querySelector(".description__text");
    const descriptionHtml = descContainer
      ? descContainer.innerHTML.trim()
      : null;
    const descriptionText = descContainer
      ? descContainer.innerText.trim()
      : null;

    const criteriaItems = Array.from(
      document.querySelectorAll(".description__job-criteria-item"),
    );
    const criteria = {};
    criteriaItems.forEach((item) => {
      const header = item
        .querySelector(".description__job-criteria-subheader")
        ?.innerText?.trim();
      const value = item
        .querySelector(".description__job-criteria-text")
        ?.innerText?.trim();
      if (header && value) {
        criteria[header] = value;
      }
    });

    return {
      id: currentUrl.split("/view/")[1]?.split("?")[0] || null,
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
  }, url);
};
export const requestHandler = async (context) => {
  const { page, request, log } = context;
  const url = new URL(request.url);
  const naturalDelay = Math.floor(Math.random() * 2000) + 1500;
  await new Promise((res) => setTimeout(res, naturalDelay));

  if (url.pathname.includes("/jobs/search")) {
    await handleSearchPage(context);
  } else if (url.pathname.includes("/jobs/view")) {
    log.info(`Scraping detailed job view via Tor: ${request.url}`);

    try {
      await page.waitForSelector(".main-content", { timeout: 10000 });
    } catch (err) {
      log.warning(
        `Timeout waiting for content on ${request.url}. Attempting extraction anyway.`,
      );
    }

    const jobData = await extractJobDetails(page, request.url);

    if (jobData && jobData.id) {
      await saveJobToDatabase({ job: jobData, log });
    } else {
      log.warning(
        `Skipped database insert: Could not parse a valid Job ID from ${request.url}`,
      );
    }
  }
};
