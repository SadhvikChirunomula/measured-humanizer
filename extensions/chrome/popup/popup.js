/**
 * Measured Humanizer - Popup Settings Controller
 */

document.addEventListener("DOMContentLoaded", () => {
  const profileEl = document.getElementById("profile");
  const providerEl = document.getElementById("provider");
  const endpointEl = document.getElementById("endpoint");
  const modelEl = document.getElementById("model");
  const apiKeyEl = document.getElementById("apiKey");
  const btnSave = document.getElementById("btn-save");
  const toast = document.getElementById("toast");

  // Load saved preferences
  chrome.storage.sync.get(
    {
      defaultProfile: "engineering",
      provider: "ollama",
      endpoint: "http://127.0.0.1:11434/v1/chat/completions",
      model: "measured-slm",
      apiKey: "",
    },
    (items) => {
      profileEl.value = items.defaultProfile;
      providerEl.value = items.provider;
      endpointEl.value = items.endpoint;
      modelEl.value = items.model;
      apiKeyEl.value = items.apiKey;
    }
  );

  btnSave.addEventListener("click", () => {
    chrome.storage.sync.set(
      {
        defaultProfile: profileEl.value,
        provider: providerEl.value,
        endpoint: endpointEl.value.trim(),
        model: modelEl.value.trim(),
        apiKey: apiKeyEl.value.trim(),
      },
      () => {
        toast.style.display = "block";
        setTimeout(() => {
          toast.style.display = "none";
        }, 2200);
      }
    );
  });
});
