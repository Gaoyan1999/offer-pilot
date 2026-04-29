const defaultEndpoint = "http://localhost:3000/api/jobs/import";
const endpointInput = document.getElementById("endpoint");
const statusText = document.getElementById("status");

function setStatus(message) {
  statusText.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getEndpoint() {
  const result = await chrome.storage.sync.get({ endpoint: defaultEndpoint });
  return result.endpoint || defaultEndpoint;
}

async function sendToContent(action) {
  const tab = await getActiveTab();
  if (!tab?.id) {
    throw new Error("No active tab found.");
  }

  return chrome.tabs.sendMessage(tab.id, { action });
}

async function importJobs(action) {
  try {
    setStatus("Reading page...");
    const result = await sendToContent(action);
    const jobs = Array.isArray(result?.jobs) ? result.jobs : [];

    if (jobs.length === 0) {
      setStatus("No jobs found on this page.");
      return;
    }

    const endpoint = await getEndpoint();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ jobs }),
    });

    if (!response.ok) {
      throw new Error(`OfferPilot returned ${response.status}.`);
    }

    const body = await response.json();
    setStatus(`Imported ${body.accepted || jobs.length} jobs. Open OfferPilot and click Load Imported Jobs.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Import failed.");
  }
}

async function init() {
  endpointInput.value = await getEndpoint();

  document.getElementById("openOfferPilot").addEventListener("click", async () => {
    const endpoint = await getEndpoint();
    const offerPilotUrl = endpoint.replace(/\/api\/jobs\/import\/?$/, "") || "http://localhost:3000";
    await chrome.tabs.create({ url: offerPilotUrl, active: true });
    setStatus("OfferPilot opened. Use Search with Extension from the Job Search panel.");
  });

  document.getElementById("saveEndpoint").addEventListener("click", async () => {
    await chrome.storage.sync.set({ endpoint: endpointInput.value.trim() || defaultEndpoint });
    setStatus("Import API saved.");
  });

  document.getElementById("importVisible").addEventListener("click", () => {
    void importJobs("extractVisibleJobs");
  });

  document.getElementById("importCurrent").addEventListener("click", () => {
    void importJobs("extractCurrentJob");
  });
}

void init();
