window.addEventListener("message", (event) => {
  if (event.source !== window || event.data?.source !== "offerpilot-web") return;

  if (event.data.type === "OFFERPILOT_START_EXTENSION_SEARCH") {
    chrome.runtime.sendMessage(
      {
        type: "START_EXTENSION_SEARCH",
        payload: event.data.payload,
      },
      (response) => {
        window.postMessage(
          {
            source: "offerpilot-extension",
            type: "OFFERPILOT_EXTENSION_SEARCH_STARTED",
            payload: response || { ok: false, error: chrome.runtime.lastError?.message || "Extension did not respond." },
          },
          "*",
        );
      },
    );
  }
});
