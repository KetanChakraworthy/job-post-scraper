export const requestHandler = async ({ request, $, log, enqueueLinks }) => {
  log.info("=".repeat(50));
  const { originalUrl, handle } = request.userData;
  log.info(`Reading Google search index for LinkedIn profile: ${handle}`);

  // 1. Verify Google didn't hit a block or block your proxy node
  const pageTitle = $("title").text().toLowerCase();
  if (
    pageTitle.includes("captcha") ||
    pageTitle.includes("detected unusual traffic")
  ) {
    throw new Error(
      "Google flagged the proxy node with a CAPTCHA block. Rotating IP...",
    );
  }

  // 2. Isolate the very first organic search result container
  const firstResult = $("#search .g").first();

  if (firstResult.length === 0) {
    log.warning(
      `Google index returned no matching public hits for target handle: ${handle}`,
    );
    return;
  }

  // 3. Extract the clean SEO title header text
  // Format usually: "Pranav Pathak - Software Engineer - Company | LinkedIn"
  const googleTitle = firstResult.find("h3").text().trim();

  // 4. Extract the clean text snippet (This contains their bio summary / recent post activity text)
  const snippetText = firstResult
    .find('.VwiC3b, [style*="-webkit-line-clamp"]')
    .text()
    .trim();

  if (!googleTitle) {
    throw new Error(
      "Google search result layout extraction failed. Retrying...",
    );
  }

  // 5. Structure and normalize the scraped metadata
  const titleParts = googleTitle.split(" - ");
  const name = titleParts[0] || null;
  const headline = titleParts[1] ? titleParts[1].split(" | ")[0] : null;

  const profilePayload = {
    targetUrl: originalUrl,
    handle: handle,
    extractedName: name,
    extractedHeadline: headline,
    publicActivitySnippet:
      snippetText || "No public snippet or recent post activity indexed.",
    capturedAt: new Date(),
  };

  log.info(`==================================================`);
  log.info(`🎉 SUCCESS (NO COOKIES USED)`);
  log.info(`👤 Name: ${profilePayload.extractedName}`);
  log.info(`💼 Title: ${profilePayload.extractedHeadline}`);
  log.info(`📝 Activity/Bio Snippet: ${profilePayload.publicActivitySnippet}`);
  log.info(`==================================================`);
  log.info("=".repeat(50));
  await new Promise((res) =>
    setTimeout(res, Math.floor(Math.random() * 1000) + 1000),
  );
};

export const errorHandler = async ({ session, log }, error) => {
  const errorMessage = error.message.toLowerCase();

  if (
    errorMessage.includes("999") ||
    errorMessage.includes("econnreset") ||
    errorMessage.includes("closed") ||
    errorMessage.includes("blocked")
  ) {
    log.warning(
      `🚨 Proxy IP flagged or connection dropped by LinkedIn. Retiring proxy session...`,
    );
    session?.retire();
  }
};
