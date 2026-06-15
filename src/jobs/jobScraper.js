import { saveJobToDatabase } from "../db/db.js";

const handleSearchPage = async ({ page, enqueueLinks, log }) => {
  log.info("Processing search listing page...");
  try {
    await page.waitForSelector("ul.jobs-search__results-list", {
      timeout: 10000,
    });
  } catch (err) {
    log.error("Could not load search results.");
    return;
  }

  await page.evaluate(async () => {
    window.scrollBy(0, window.innerHeight);
    await new Promise((res) => setTimeout(res, 1000));
  });

  const initialLinks = await page.$$eval(
    "ul.jobs-search__results-list li a.base-card__full-link",
    (links) => {
      return links.map((a) => a.href);
    },
  );

  log.info(`Enqueuing ${initialLinks.length} job details pages.`);
  await enqueueLinks({ urls: initialLinks });
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

  if (url.pathname.includes("/jobs/search")) {
    await handleSearchPage(context);
  } else if (url.pathname.includes("/jobs/view")) {
    log.info(`Scraping detailed job view: ${request.url}`);

    try {
      await page.waitForSelector(".main-content", { timeout: 8000 });
    } catch (err) {
      log.warning(`Timeout waiting for content on ${request.url}`);
    }

    const jobData = await extractJobDetails(page, request.url);

    if (jobData.id) {
      await saveJobToDatabase({ job: jobData, log });
    }
  }
};
