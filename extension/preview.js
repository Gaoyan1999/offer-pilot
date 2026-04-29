const statusText = document.getElementById("status");
const jobsContainer = document.getElementById("jobs");
const saveButton = document.getElementById("saveSelected");

let jobs = [];
let endpoint = "http://localhost:3000/api/jobs/import";

function setStatus(message) {
  statusText.textContent = message;
}

function renderJobs() {
  jobsContainer.innerHTML = "";

  if (jobs.length === 0) {
    if (!statusText.textContent || statusText.textContent === "Loading search results...") {
      setStatus("Waiting for LinkedIn results...");
    }
    return;
  }

  setStatus(`${jobs.length} jobs found. Compare with LinkedIn on the left, then save selected jobs.`);

  jobs.forEach((job, index) => {
    const item = document.createElement("article");
    item.className = "job";
    item.innerHTML = `
      <input type="checkbox" data-index="${index}" checked aria-label="Select ${job.title}" />
      <div>
        <h2>${job.title || "Untitled role"}</h2>
        <p>${job.company || "Unknown company"} - ${job.location || "Location not listed"} - ${job.source || "browser"}</p>
        <p>${(job.description || "").slice(0, 240)}</p>
        <a href="${job.url}" target="_blank" rel="noreferrer">Open job</a>
      </div>
    `;
    jobsContainer.appendChild(item);
  });
}

async function loadPreview() {
  const result = await chrome.storage.local.get({
    previewJobs: [],
    endpoint,
    previewStatus: "",
  });
  jobs = Array.isArray(result.previewJobs) ? result.previewJobs : [];
  endpoint = result.endpoint || endpoint;
  if (result.previewStatus) setStatus(result.previewStatus);
  renderJobs();
}

async function saveSelected() {
  const selected = [...document.querySelectorAll("input[type='checkbox'][data-index]:checked")]
    .map((input) => jobs[Number(input.dataset.index)])
    .filter(Boolean);

  if (selected.length === 0) {
    setStatus("Select at least one job to save.");
    return;
  }

  saveButton.disabled = true;
  setStatus("Saving selected jobs to OfferPilot...");

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
    await chrome.storage.local.set({ previewJobs: selected });
    setStatus(`Saved ${body.accepted || selected.length} jobs. Opening OfferPilot...`);
    await openOfferPilotWithImportedJobs();
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Could not save selected jobs.");
  } finally {
    saveButton.disabled = false;
  }
}

async function openOfferPilotWithImportedJobs() {
  const offerPilotUrl = endpoint.replace(/\/api\/jobs\/import\/?$/, "") || "http://localhost:3000";
  const url = new URL(offerPilotUrl);
  url.searchParams.set("importedJobs", "1");

  const tabs = await chrome.tabs.query({});
  const existingTab = tabs.find((tab) => tab.url && tab.url.startsWith(offerPilotUrl));

  if (existingTab?.id) {
    await chrome.tabs.update(existingTab.id, { url: url.toString(), active: true });
    if (existingTab.windowId) {
      await chrome.windows.update(existingTab.windowId, { focused: true });
    }
    return;
  }

  await chrome.tabs.create({ url: url.toString(), active: true });
}

saveButton.addEventListener("click", () => {
  void saveSelected();
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local") return;

  if (changes.previewJobs) {
    jobs = Array.isArray(changes.previewJobs.newValue) ? changes.previewJobs.newValue : [];
    renderJobs();
  }

  if (changes.previewStatus?.newValue) {
    setStatus(changes.previewStatus.newValue);
  }
});

void loadPreview();
