import { saveJobToDatabase } from "../db/db.js";

const QUEUE_LINK_LABEL = "DETAIL";

export const handleSearchPage = async ({ $, enqueueLinks, log }) => {
  log.info("Processing search listing page via Cheerio...");
  const jobCards = $(".base-search-card");

  if (jobCards.length === 0) {
    log.warning(
      "No jobs returned on search feed. Checking fallback layouts...",
    );
  }

  const initialLinks = [];

  jobCards.each((_, el) => {
    const targetLink = $(el).find("a.base-card__full-link").attr("href");
    if (targetLink) {
      initialLinks.push(targetLink);
    }
  });

  if (initialLinks.length === 0) {
    log.warning("Primary selectors empty. Scraping public fallback links...");
    $("a[href*='/jobs/view/']").each((_, el) => {
      const fallbackLink = $(el).attr("href");
      if (fallbackLink) {
        initialLinks.push(fallbackLink);
      }
    });
  }

  const uniqueLinks = [...new Set(initialLinks)];

  if (uniqueLinks.length === 0) {
    throw new Error("LinkedIn blocked: Empty search page payload received.");
  }

  log.info(
    `Enqueuing ${uniqueLinks.length} unique job details pages into proxy stream.`,
  );

  await enqueueLinks({
    urls: uniqueLinks,
    userData: { label: QUEUE_LINK_LABEL },
    strategy: "all",
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
    await handleSearchPage({ $, enqueueLinks, log });
  } else if (request.userData.label === QUEUE_LINK_LABEL) {
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

export const errorHandler = async ({ error, session, log }) => {
  const errorMessage = error.message.toLowerCase();

  if (
    errorMessage.includes("linkedin blocked") ||
    errorMessage.includes("login wall") ||
    errorMessage.includes("econnreset") ||
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("connection closed")
  ) {
    log.warning(
      `🚨 Proxy IP flagged or connection dropped by LinkedIn. Retiring proxy session...`,
    );
    session?.retire();
  }
};
