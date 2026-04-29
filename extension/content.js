function clean(value) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function absoluteUrl(value) {
  if (!value) return "";
  try {
    return new URL(value, window.location.href).toString();
  } catch {
    return "";
  }
}

function firstText(root, selectors) {
  for (const selector of selectors) {
    const value = clean(root.querySelector(selector)?.textContent);
    if (value) return value;
  }
  return "";
}

function firstHref(root, selectors) {
  for (const selector of selectors) {
    const value = root.querySelector(selector)?.getAttribute("href");
    const url = absoluteUrl(value);
    if (url) return url;
  }
  return "";
}

function sourceFromHost() {
  const host = window.location.hostname.toLowerCase();
  if (host.includes("linkedin")) return "linkedin";
  if (host.includes("seek")) return "seek";
  if (host.includes("indeed")) return "indeed";
  return "browser_extension";
}

function inferWorkMode(text) {
  const lower = text.toLowerCase();
  if (lower.includes("remote") || lower.includes("work from home")) return "remote";
  if (lower.includes("hybrid")) return "hybrid";
  if (lower.includes("onsite") || lower.includes("on-site")) return "onsite";
  return "";
}

function uniqueJobs(jobs) {
  const seen = new Set();
  return jobs.filter((job) => {
    const key = job.url || `${job.title}|${job.company}|${job.location}`;
    if (!job.title || !job.url || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractLinkedInCards() {
  const cards = [
    ...document.querySelectorAll(
      ".jobs-search-results__list-item, .job-card-container, li[data-occludable-job-id], .base-card, .job-search-card",
    ),
  ];

  return uniqueJobs(
    cards.map((card) => {
      const title = firstText(card, [
        ".job-card-list__title",
        ".base-search-card__title",
        ".job-search-card__title",
        "a[href*='/jobs/view/']",
      ]);
      const company = firstText(card, [
        ".job-card-container__primary-description",
        ".base-search-card__subtitle",
        ".job-search-card__subtitle",
      ]);
      const location = firstText(card, [
        ".job-card-container__metadata-item",
        ".job-search-card__location",
        ".base-search-card__metadata",
      ]);
      const url = firstHref(card, ["a[href*='/jobs/view/']"]);

      return {
        title,
        company,
        location,
        source: "linkedin",
        url,
        description: clean(card.textContent),
        workMode: inferWorkMode(`${location} ${card.textContent}`),
      };
    }),
  );
}

function extractSeekCards() {
  const cards = [...document.querySelectorAll("[data-automation='normalJob'], article[data-automation*='job'], article")];

  return uniqueJobs(
    cards.map((card) => {
      const title = firstText(card, ["[data-automation='jobTitle']", "a[data-automation='jobTitle']", "h3", "a[href*='/job/']"]);
      const company = firstText(card, ["[data-automation='jobCompany']", "[data-automation='advertiser-name']"]);
      const location = firstText(card, ["[data-automation='jobLocation']", "[data-automation='job-area']"]);
      const url = firstHref(card, ["a[data-automation='jobTitle']", "a[href*='/job/']"]);

      return {
        title,
        company,
        location,
        source: "seek",
        url,
        description: clean(card.textContent),
        workMode: inferWorkMode(`${location} ${card.textContent}`),
      };
    }),
  );
}

function extractIndeedCards() {
  const cards = [...document.querySelectorAll(".job_seen_beacon, .jobsearch-ResultsList .result, [data-jk]")];

  return uniqueJobs(
    cards.map((card) => {
      const title = firstText(card, [".jobTitle", "h2 a", "a[data-jk]", "a[href*='/viewjob']"]);
      const company = firstText(card, ["[data-testid='company-name']", ".companyName"]);
      const location = firstText(card, ["[data-testid='text-location']", ".companyLocation"]);
      const url = firstHref(card, ["h2 a", "a[data-jk]", "a[href*='/viewjob']"]);

      return {
        title,
        company,
        location,
        source: "indeed",
        url,
        description: clean(card.textContent),
        workMode: inferWorkMode(`${location} ${card.textContent}`),
      };
    }),
  );
}

function extractVisibleJobs() {
  const source = sourceFromHost();
  if (source === "linkedin") return extractLinkedInCards();
  if (source === "seek") return extractSeekCards();
  if (source === "indeed") return extractIndeedCards();
  return [];
}

function extractCurrentJob() {
  const source = sourceFromHost();
  const bodyText = clean(document.body.textContent);
  const title = firstText(document, [
    ".jobs-unified-top-card__job-title",
    ".top-card-layout__title",
    "[data-automation='job-detail-title']",
    ".jobsearch-JobInfoHeader-title",
    "h1",
  ]);
  const company = firstText(document, [
    ".jobs-unified-top-card__company-name",
    ".topcard__org-name-link",
    "[data-automation='advertiser-name']",
    "[data-testid='inlineHeader-companyName']",
  ]);
  const location = firstText(document, [
    ".jobs-unified-top-card__bullet",
    ".topcard__flavor--bullet",
    "[data-automation='job-detail-location']",
    "[data-testid='jobsearch-JobInfoHeader-companyLocation']",
  ]);
  const description = firstText(document, [
    ".jobs-description-content__text",
    ".show-more-less-html__markup",
    "[data-automation='jobAdDetails']",
    "#jobDescriptionText",
  ]);

  return uniqueJobs([
    {
      title,
      company,
      location,
      source,
      url: window.location.href,
      description: description || bodyText.slice(0, 5000),
      workMode: inferWorkMode(`${location} ${description || bodyText}`),
    },
  ]);
}

function escapeHtml(value) {
  return clean(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[char] || char;
  });
}

async function openOfferPilotWithImportedJobs(endpoint) {
  const offerPilotUrl = endpoint.replace(/\/api\/jobs\/import\/?$/, "") || "http://localhost:3000";
  const url = new URL(offerPilotUrl);
  url.searchParams.set("importedJobs", "1");
  window.open(url.toString(), "_blank", "noopener,noreferrer");
}

function showOfferPilotPanel({ jobs = [], endpoint = "http://localhost:3000/api/jobs/import", status = "" }) {
  document.getElementById("offerpilot-inline-panel")?.remove();
  document.documentElement.style.setProperty("--offerpilot-inline-panel-width", "420px");
  document.body.style.marginRight = "420px";

  const panel = document.createElement("aside");
  panel.id = "offerpilot-inline-panel";
  panel.innerHTML = `
    <style>
      #offerpilot-inline-panel {
        position: fixed;
        top: 0;
        right: 0;
        z-index: 2147483647;
        display: flex;
        width: 420px;
        height: 100vh;
        flex-direction: column;
        border-left: 1px solid #dbe4f0;
        background: #f8fbff;
        box-shadow: -12px 0 30px rgba(15, 23, 42, 0.18);
        color: #0f172a;
        font-family: Inter, ui-sans-serif, system-ui, sans-serif;
      }
      #offerpilot-inline-panel * { box-sizing: border-box; }
      .op-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        border-bottom: 1px solid #dbe4f0;
        padding: 16px;
        background: #ffffff;
      }
      .op-brand { color: #0052ff; font-size: 12px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; }
      .op-header h2 { margin: 3px 0 0; font-size: 22px; line-height: 1.1; }
      .op-close {
        width: 32px;
        height: 32px;
        border: 1px solid #dbe4f0;
        border-radius: 8px;
        background: #fff;
        color: #0f172a;
        cursor: pointer;
        font-size: 18px;
      }
      .op-status {
        margin: 0;
        border-bottom: 1px solid #dbe4f0;
        padding: 12px 16px;
        color: #64748b;
        font-size: 13px;
        line-height: 1.45;
      }
      .op-jobs {
        display: grid;
        flex: 1;
        align-content: start;
        gap: 10px;
        overflow: auto;
        padding: 12px;
      }
      .op-job {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 10px;
        border: 1px solid #dbe4f0;
        border-radius: 10px;
        padding: 12px;
        background: #ffffff;
      }
      .op-job h3 { margin: 0 0 4px; color: #0f172a; font-size: 15px; line-height: 1.25; }
      .op-job p { margin: 0; color: #64748b; font-size: 12px; line-height: 1.45; }
      .op-job a { color: #0052ff; font-size: 12px; font-weight: 800; text-decoration: none; }
      .op-footer {
        display: grid;
        gap: 8px;
        border-top: 1px solid #dbe4f0;
        padding: 14px;
        background: #ffffff;
      }
      .op-save {
        min-height: 42px;
        border: 0;
        border-radius: 8px;
        background: #0052ff;
        color: #ffffff;
        cursor: pointer;
        font-weight: 800;
      }
      .op-save:disabled { cursor: not-allowed; opacity: 0.58; }
    </style>
    <div class="op-header">
      <div>
        <div class="op-brand">OfferPilot</div>
        <h2>LinkedIn jobs</h2>
      </div>
      <button class="op-close" type="button" aria-label="Close OfferPilot panel">×</button>
    </div>
    <p class="op-status">${escapeHtml(status || "Review jobs while comparing LinkedIn on the left.")}</p>
    <section class="op-jobs">
      ${
        jobs.length > 0
          ? jobs
              .map(
                (job, index) => `
                  <article class="op-job">
                    <input type="checkbox" data-index="${index}" checked aria-label="Select ${escapeHtml(job.title)}" />
                    <div>
                      <h3>${escapeHtml(job.title || "Untitled role")}</h3>
                      <p>${escapeHtml(job.company || "Unknown company")} · ${escapeHtml(job.location || "Location not listed")}</p>
                      <p>${escapeHtml((job.description || "").slice(0, 180))}</p>
                      <a href="${escapeHtml(job.url)}" target="_blank" rel="noreferrer">Open job</a>
                    </div>
                  </article>
                `,
              )
              .join("")
          : "<p class=\"op-status\">No jobs found. Try changing the LinkedIn search filters, then run Search with Extension again.</p>"
      }
    </section>
    <footer class="op-footer">
      <button class="op-save" type="button" ${jobs.length === 0 ? "disabled" : ""}>Save Selected</button>
    </footer>
  `;

  document.body.appendChild(panel);

  panel.querySelector(".op-close")?.addEventListener("click", () => {
    panel.remove();
    document.body.style.marginRight = "";
    document.documentElement.style.removeProperty("--offerpilot-inline-panel-width");
  });

  panel.querySelector(".op-save")?.addEventListener("click", async () => {
    const selected = [...panel.querySelectorAll("input[type='checkbox'][data-index]:checked")]
      .map((input) => jobs[Number(input.dataset.index)])
      .filter(Boolean);
    const button = panel.querySelector(".op-save");
    const statusNode = panel.querySelector(".op-status");

    if (selected.length === 0) {
      statusNode.textContent = "Select at least one job to save.";
      return;
    }

    button.disabled = true;
    statusNode.textContent = "Saving selected jobs to OfferPilot...";

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ jobs: selected }),
      });

      if (!response.ok) {
        throw new Error(`OfferPilot returned ${response.status}.`);
      }

      const body = await response.json();
      statusNode.textContent = `Saved ${body.accepted || selected.length} jobs. Opening OfferPilot...`;
      await openOfferPilotWithImportedJobs(endpoint);
    } catch (error) {
      statusNode.textContent = error instanceof Error ? error.message : "Could not save selected jobs.";
      button.disabled = false;
    }
  });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.action === "extractVisibleJobs") {
    sendResponse({ jobs: extractVisibleJobs() });
    return true;
  }

  if (message?.action === "extractCurrentJob") {
    sendResponse({ jobs: extractCurrentJob() });
    return true;
  }

  if (message?.action === "showOfferPilotPanel") {
    showOfferPilotPanel(message);
    sendResponse({ ok: true });
    return true;
  }

  return false;
});
