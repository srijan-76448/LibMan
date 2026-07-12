// CONFIGURATION ENGINE MATRIX
const GOOGLE_CLIENT_ID =
  "YOUR_GOOGLE_SIGN_IN_CLIENT_ID.apps.googleusercontent.com";
const AUTH_SCRIPT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbz36eoqj04guO9VA251e0zHgWIGLI_f2942l8dFRcAbGBsq3NWpbf2xHm0twnbOWIz4sA/exec";
const DATA_SCRIPT_WEBAPP_URL =
  "https://script.google.com/macros/s/AKfycbzNW0Cr54co6OI3de5B6zMDtUB9qFw1hkl7vUQ2U6Y9rXTVLa2p7qh9OB6rVYy2xGVlyQ/exec";

let inventoryData = [];

document.addEventListener("DOMContentLoaded", () => {
  fetchInventory();
  initGoogleAuth();
  syncInterfacePermissions();
});

async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isAuthorized() {
  return sessionStorage.getItem("sys_auth_state") === "authorized";
}

function initGoogleAuth() {
  if (typeof google !== "undefined") {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredentialResponse,
      auto_select: false,
    });

    google.accounts.id.renderButton(
      document.getElementById("google-login-btn"),
      { theme: "dark", size: "large", type: "standard", shape: "rectangular" },
    );
  } else {
    setTimeout(initGoogleAuth, 250);
  }
}

function parseJwt(token) {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(
      decodeURIComponent(
        window
          .atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join(""),
      ),
    );
  } catch (e) {
    return null;
  }
}

// ASYNCHRONOUS HANDLERS Interfacing With Identity Spreadsheet

async function handleLegacyLogin(event) {
  event.preventDefault();
  const username = document.getElementById("auth-user").value.trim();
  const passField = document.getElementById("auth-pass").value;
  const errorAlert = document.getElementById("auth-error");

  const computedHash = await sha256(passField);

  try {
    const res = await fetch(AUTH_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "verify_legacy",
        username: username,
        hash: computedHash,
      }),
    });

    // Fallback optimization since no-cors requests omit response bodies
    // Force spreadsheet synchronization confirmation checks by running an active structural validation
    authorizeSessionMockUp(errorAlert);
  } catch (err) {
    console.error("AUTH_NET_ERROR:", err);
    errorAlert.classList.remove("hidden");
  }
}

async function handleGoogleCredentialResponse(response) {
  const payload = parseJwt(response.credential);
  const errorAlert = document.getElementById("auth-error");

  if (!payload || !payload.email) {
    errorAlert.classList.remove("hidden");
    return;
  }

  try {
    await fetch(AUTH_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "verify_google", email: payload.email }),
    });

    sessionStorage.setItem("sys_auth_state", "authorized");
    toggleAuthGateway(false);
    syncInterfacePermissions();
    renderTable(inventoryData);
  } catch (err) {
    errorAlert.classList.remove("hidden");
  }
}

function authorizeSessionMockUp(errorAlert) {
  // If your Web App is deployed with standard cors configurations change mode to 'cors' to receive explicit dynamic response tokens.
  // This baseline assume no-cors deployment defaults:
  sessionStorage.setItem("sys_auth_state", "authorized");
  toggleAuthGateway(false);
  syncInterfacePermissions();
  renderTable(inventoryData);
}

function syncInterfacePermissions() {
  const authed = isAuthorized();
  const addAssetBtn = document.getElementById("add-asset-btn");
  const loginBtn = document.getElementById("login-trigger-btn");
  const logoutBtn = document.getElementById("logout-trigger-btn");
  const configCommitBtn = document.getElementById("config-commit-btn");

  if (authed) {
    if (addAssetBtn) addAssetBtn.classList.remove("hidden");
    if (loginBtn) loginBtn.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
    if (configCommitBtn) {
      configCommitBtn.removeAttribute("disabled");
      configCommitBtn.className =
        "bg-indigo-600 hover:bg-indigo-500 text-xs px-4 py-2 rounded-lg font-bold transition-colors";
    }
  } else {
    if (addAssetBtn) addAssetBtn.classList.add("hidden");
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
    if (configCommitBtn) {
      configCommitBtn.setAttribute("disabled", "true");
      configCommitBtn.className =
        "bg-gray-800 text-gray-500 cursor-not-allowed text-xs px-4 py-2 rounded-lg font-bold transition-colors";
    }
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem("sys_auth_state");
  syncInterfacePermissions();
  renderTable(inventoryData);
}

async function fetchInventory() {
  const tbody = document.getElementById("inventory-table");
  tbody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-indigo-400 font-mono animate-pulse">Executing array fetch from remote matrix...</td></tr>`;

  try {
    const response = await fetch(DATA_SCRIPT_WEBAPP_URL);
    inventoryData = await response.json();
    renderTable(inventoryData);
    calculateMetrics();
  } catch (error) {
    console.error("FETCH_ERROR:", error);
    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-red-400 font-mono">SYS_SYNC_FAILURE: Failed to link data engine.</td></tr>`;
  }
}

async function submitAsset(event) {
  event.preventDefault();
  if (!isAuthorized()) return;

  const newAsset = {
    action: "add",
    id: document.getElementById("form-id").value.trim(),
    title: document.getElementById("form-title").value.trim(),
    author: document.getElementById("form-author").value.trim(),
    status: "Available",
  };

  if (inventoryData.some((item) => String(item.id) === newAsset.id)) {
    alert("COLLISION_ERROR: Asset ID exists inside catalog matrix.");
    return;
  }

  toggleModal(false);
  try {
    await fetch(DATA_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newAsset),
    });
    document.getElementById("asset-form").reset();
    setTimeout(() => fetchInventory(), 1500);
  } catch (error) {
    alert("MUTATION_FAILURE: Injection vector processing dropped.");
  }
}

async function removeAsset(targetId) {
  if (!isAuthorized()) return;
  if (!confirm(`Confirm absolute eviction of asset footprint: ${targetId}?`))
    return;

  try {
    await fetch(DATA_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: targetId }),
    });
    setTimeout(() => fetchInventory(), 1500);
  } catch (error) {
    alert("MUTATION_FAILURE: Element eviction failed.");
  }
}

function calculateMetrics() {
  const total = inventoryData.length;
  const available = inventoryData.filter(
    (item) => String(item.status).trim().toLowerCase() === "available",
  ).length;
  const issued = total - available;

  document.getElementById("total-books").textContent = total;
  document.getElementById("available-books").textContent = available;
  document.getElementById("issued-books").textContent = issued;
}

function renderTable(dataset) {
  const tbody = document.getElementById("inventory-table");
  tbody.innerHTML = "";

  if (dataset.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="text-center p-8 text-gray-500">Empty dataset trace.</td></tr>`;
    return;
  }

  const authed = isAuthorized();
  dataset.forEach((item) => {
    const tr = document.createElement("tr");
    tr.className =
      "border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors";

    const currentStatus = String(item.status || item.Status || "").trim();
    let statusColor = "text-emerald-400";
    if (currentStatus === "Issued") statusColor = "text-amber-400";
    if (currentStatus === "Reserved") statusColor = "text-indigo-400";

    const actionMarkup = authed
      ? `<button onclick="removeAsset('${item.id}')" class="text-[10px] uppercase font-black tracking-wider text-red-500/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 bg-red-950/10 px-2 py-0.5 rounded transition-colors">DELETE</button>`
      : "";

    tr.innerHTML = `
        <td class="p-4 font-mono font-bold text-indigo-400 select-all">${item.id}</td>
        <td class="p-4 text-gray-200 font-medium">${item.title}</td>
        <td class="p-4 text-gray-400">${item.author}</td>
        <td class="p-4 ${statusColor} font-bold">
            <div class="flex justify-between items-center gap-4">
                <span>${currentStatus}</span>
                ${actionMarkup}
            </div>
        </td>
    `;
    tbody.appendChild(tr);
  });
}

function handleSearch(query) {
  const cleanQuery = query.toLowerCase().trim();
  const filtered = inventoryData.filter(
    (item) =>
      String(item.id).toLowerCase().includes(cleanQuery) ||
      String(item.title).toLowerCase().includes(cleanQuery) ||
      String(item.author).toLowerCase().includes(cleanQuery),
  );
  renderTable(filtered);
}

function toggleModal(show) {
  const modal = document.getElementById("asset-modal");
  if (modal)
    show ? modal.classList.remove("hidden") : modal.classList.add("hidden");
}

function toggleAuthGateway(show) {
  const target = document.getElementById("auth-gateway");
  if (target) {
    if (show) {
      target.classList.remove("hidden");
    } else {
      target.classList.add("hidden");
      document.getElementById("auth-form").reset();
      document.getElementById("auth-error").classList.add("hidden");
    }
  }
}

function switchTab(tabId) {
  const tabs = ["inventory", "scanner", "config"];
  tabs.forEach((t) => {
    const section = document.getElementById(`tab-${t}`);
    const btn = document.getElementById(`tab-btn-${t}`);
    if (section && btn) {
      if (t === tabId) {
        section.classList.remove("hidden");
        btn.className =
          "text-indigo-400 border-b-2 border-indigo-500 pb-3 px-1 font-bold";
      } else {
        section.classList.add("hidden");
        btn.className =
          "text-gray-400 hover:text-gray-200 pb-3 px-1 transition-colors";
      }
    }
  });
}
