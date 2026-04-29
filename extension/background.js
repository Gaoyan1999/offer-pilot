const defaultEndpoint = "http://localhost:3000/api/jobs/import";
const maxJobsPerPlatform = 8;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function compactLocation(location) {
  return (location || "Sydney").split("/")[0].trim() || "Sydney";
}

function buildSearchUrl(platform, payload) {
  const keywords = encodeURIComponent(payload?.targetRole || "software engineer");
  const location = encodeURIComponent(compactLocation(payload?.targetLocation));

  if (platform === "linkedin") {
    return `https://www.linkedin.com/jobs/search/?keywords=${keywords}&location=${location}`;
  }

  if (platform === "seek") {
    const seekKeywords = (payload?.targetRole || "software engineer").toLowerCase().trim().replace(/\s+/g, "-");
    const seekLocation = compactLocation(payload?.targetLocation).replace(/,?\s+/g, "-");
    return `https://www.seek.com.au/${seekKeywords}-jobs/in-All-${seekLocation}`;
  }

  return `https://au.indeed.com/jobs?q=${keywords}&l=${location}`;
}

async function getEndpoint() {
  const result = await chrome.storage.sync.get({ endpoint: defaultEndpoint });
  return result.endpoint || defaultEndpoint;
}

async function extractJobsFromTab(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => window.scrollTo({ top: document.body.scrollHeight, behavior: "instant" }),
  });
  await sleep(1400);

  return chrome.tabs.sendMessage(tabId, { action: "extractVisibleJobs" });
}

function waitForTabLoad(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(tabId, (tab) => {
      if (tab?.status === "complete") {
        resolve();
        return;
      }

      const listener = (changedTabId, changeInfo) => {
        if (changedTabId === tabId && changeInfo.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      };

      chrome.tabs.onUpdated.addListener(listener);
      setTimeout(() => {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }, 9000);
    });
  });
}

function dedupeJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = job.url || `${job.title}|${job.company}|${job.location}`;
    if (!job.title || !job.url || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function startExtensionSearch(payload) {
  const endpoint = await getEndpoint();
  await chrome.storage.local.set({
    previewJobs: [],
    previewPayload: payload,
    endpoint,
    previewStatus: "Opening LinkedIn search...",
    previewCreatedAt: Date.now(),
  });

  const tab = await chrome.tabs.create({
    url: buildSearchUrl("linkedin", payload),
    active: true,
  });

  if (tab.id) {
    await waitForTabLoad(tab.id);
    await chrome.storage.local.set({ previewStatus: "Reading LinkedIn search results..." });
    await sleep(2200);

    try {
      const result = await extractJobsFromTab(tab.id);
      const jobs = dedupeJobs((Array.isArray(result?.jobs) ? result.jobs : []).slice(0, maxJobsPerPlatform));
      await chrome.storage.local.set({
        previewJobs: jobs,
        previewStatus: jobs.length > 0 ? "Review LinkedIn jobs while comparing the page on the left." : "No LinkedIn jobs found on this page.",
      });
      await chrome.tabs.sendMessage(tab.id, {
        action: "showOfferPilotPanel",
        jobs,
        endpoint,
        status: jobs.length > 0 ? `${jobs.length} jobs found. Compare with LinkedIn, then save selected jobs.` : "No LinkedIn jobs found on this page.",
      });
      return { ok: true, count: jobs.length };
    } catch (error) {
      const message = error instanceof Error ? error.message : "LinkedIn extraction failed.";
      await chrome.storage.local.set({ previewStatus: message });
      await chrome.tabs.sendMessage(tab.id, {
        action: "showOfferPilotPanel",
        jobs: [],
        endpoint,
        status: message,
      });
      return { ok: false, error: message };
    }
  }

  return { ok: false, error: "LinkedIn tab could not be opened." };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "START_EXTENSION_SEARCH") {
    startExtensionSearch(message.payload)
      .then(sendResponse)
      .catch((error) => sendResponse({ ok: false, error: error instanceof Error ? error.message : "Extension search failed." }));
    return true;
  }

  return false;
});
