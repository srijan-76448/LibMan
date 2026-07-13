// CONFIGURATION ENGINE MATRIX
const GOOGLE_CLIENT_ID = "YOUR_GOOGLE_SIGN_IN_CLIENT_ID.apps.googleusercontent.com";
const AUTH_SCRIPT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycby45UI59eWRHVH5tPoLvjrNJtIM4r1gaHFQao66TJsRkzHRBXg5FO4vFlbW2_AVbQp8xw/exec";
const DATA_SCRIPT_WEBAPP_URL = "https://script.google.com/macros/s/AKfycbzrj0nKP-MIP2YT9Crvuc-zgSVcyKuEUex75eO-RuQCCecWqMSca3jymS72l99DyNb4_A/exec";

let physicalInventory = [];
let digitalInventory = [];
let activePartition = "books"; // Tracks current subpart view ("books" or "ebooks")

document.addEventListener("DOMContentLoaded", () => {
  fetchInventories();
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
        window.atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join(""),
      ),
    );
  } catch (e) {
    return null;
  }
}

// Switches partitions between Normal Books and E-Books
function switchPartition(partitionId) {
  activePartition = partitionId;
  const btnBooks = document.getElementById("tab-btn-books");
  const btnEbooks = document.getElementById("tab-btn-ebooks");
  const columnHeaderExtra = document.getElementById("column-header-extra");
  const formExtraContainer = document.getElementById("form-extra-container");
  const modalFormTitle = document.getElementById("modal-form-title");

  // Reset the query search field filter when swapping sections
  document.getElementById("search-bar").value = "";

  if (partitionId === "books") {
    btnBooks.className = "text-indigo-400 border-b-2 border-indigo-500 pb-3 px-1 font-bold tracking-tight";
    btnEbooks.className = "text-gray-400 hover:text-gray-200 pb-3 px-1 transition-colors tracking-tight";
    columnHeaderExtra.textContent = "Status Mapping";
    
    if (formExtraContainer) formExtraContainer.classList.add("hidden");
    if (modalFormTitle) modalFormTitle.textContent = "Ingest New Catalog Item";
    
    renderTable(physicalInventory);
    calculateMetrics(physicalInventory);
  } else {
    btnEbooks.className = "text-indigo-400 border-b-2 border-indigo-500 pb-3 px-1 font-bold tracking-tight";
    btnBooks.className = "text-gray-400 hover:text-gray-200 pb-3 px-1 transition-colors tracking-tight";
    columnHeaderExtra.textContent = "Download Target Vector";
    
    if (formExtraContainer) formExtraContainer.classList.remove("hidden");
    if (modalFormTitle) modalFormTitle.textContent = "Ingest New E-Book Node";
    
    renderTable(digitalInventory);
    calculateMetrics(digitalInventory);
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
    await fetch(AUTH_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({
        action: "verify_legacy",
        username: username,
        hash: computedHash,
      }),
    });
    authorizeSessionMockUp();
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
    switchPartition(activePartition);
  } catch (err) {
    errorAlert.classList.remove("hidden");
  }
}

function authorizeSessionMockUp() {
  sessionStorage.setItem("sys_auth_state", "authorized");
  toggleAuthGateway(false);
  syncInterfacePermissions();
  switchPartition(activePartition);
}

function syncInterfacePermissions() {
  const authed = isAuthorized();
  const addAssetBtn = document.getElementById("add-asset-btn");
  const loginBtn = document.getElementById("login-trigger-btn");
  const logoutBtn = document.getElementById("logout-trigger-btn");

  if (authed) {
    if (addAssetBtn) addAssetBtn.classList.remove("hidden");
    if (loginBtn) loginBtn.classList.add("hidden");
    if (logoutBtn) logoutBtn.classList.remove("hidden");
  } else {
    if (addAssetBtn) addAssetBtn.classList.add("hidden");
    if (loginBtn) loginBtn.classList.remove("hidden");
    if (logoutBtn) logoutBtn.classList.add("hidden");
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem("sys_auth_state");
  syncInterfacePermissions();
  switchPartition(activePartition);
}

// Dual Array Synchronization Sequence
async function fetchInventories() {
  const tbody = document.getElementById("inventory-table");
  tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-indigo-400 font-mono animate-pulse">Synchronizing unified data storage matrices...</td></tr>`;

  try {
    // Phase A: Fetch Physical Sheet Stream
    const responseBooks = await fetch(`${DATA_SCRIPT_WEBAPP_URL}?stream=books`);
    physicalInventory = await responseBooks.json();

    // Phase B: Fetch E-Books Sheet Stream
    const responseEbooks = await fetch(`${DATA_SCRIPT_WEBAPP_URL}?stream=ebooks`);
    digitalInventory = await responseEbooks.json();

    switchPartition(activePartition);
  } catch (error) {
    console.error("FETCH_ERROR:", error);
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-red-400 font-mono">SYS_SYNC_FAILURE: Failed to link data engine partitions.</td></tr>`;
  }
}

async function submitAsset(event) {
  event.preventDefault();
  if (!isAuthorized()) return;

  const targetId = document.getElementById("form-id").value.trim();
  const currentSet = activePartition === "books" ? physicalInventory : digitalInventory;

  if (currentSet.some((item) => String(item.asset_id || item.id) === targetId)) {
    alert("COLLISION_ERROR: Asset ID exists inside target catalog partition matrix.");
    return;
  }

  const newAsset = {
    action: "add",
    id: targetId,
    title: document.getElementById("form-title").value.trim(),
    author: document.getElementById("form-author").value.trim(),
    status: "Available",
    stream: activePartition
  };

  if (activePartition === "ebooks") {
    newAsset.download_url = document.getElementById("form-extra").value.trim();
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
    setTimeout(() => fetchInventories(), 1500);
  } catch (error) {
    alert("MUTATION_FAILURE: Injection vector processing dropped.");
  }
}

async function removeAsset(targetId) {
  if (!isAuthorized()) return;
  if (!confirm(`Confirm absolute eviction of asset footprint: ${targetId}?`)) return;

  try {
    await fetch(DATA_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete", id: targetId, stream: activePartition }),
    });

    // Optimistic UI update: instantly drop from current arrays locally
    if (activePartition === "books") {
      physicalInventory = physicalInventory.filter(item => String(item.asset_id || item.id) !== String(targetId));
      renderTable(physicalInventory);
      calculateMetrics(physicalInventory);
    } else {
      digitalInventory = digitalInventory.filter(item => String(item.asset_id || item.id) !== String(targetId));
      renderTable(digitalInventory);
      calculateMetrics(digitalInventory);
    }
  } catch (error) {
    console.error("EVICTION_ERROR:", error);
    alert("MUTATION_FAILURE: Element eviction failed.");
  }
}

function calculateMetrics(dataset) {
  const total = dataset.length;
  const available = dataset.filter(
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
    tbody.innerHTML = `<tr><td colspan="5" class="text-center p-8 text-gray-500 font-mono">Empty target partition trace data.</td></tr>`;
    return;
  }

  const authed = isAuthorized();
  dataset.forEach((item) => {
    const tr = document.createElement("tr");
    tr.className = "border-b border-gray-800/50 hover:bg-gray-900/30 transition-colors text-xs";

    const itemId = item.asset_id || item.id || "0";
    const itemTitle = item.title || "Binary Object";
    const itemAuthor = item.author || "Unknown";
    const currentStatus = String(item.status || "").trim() || "Available";
    
    // Determine target value column base layout logic
    let extraFieldMarkup = "";
    if (activePartition === "books") {
      let statusColor = "text-emerald-400";
      if (currentStatus === "Issued") statusColor = "text-amber-400";
      if (currentStatus === "Reserved") statusColor = "text-indigo-400";
      extraFieldMarkup = `<span class="${statusColor} font-bold">${currentStatus}</span>`;
    } else {
      const urlStr = item.download_url || item.url || "---";
      extraFieldMarkup = `<span class="text-gray-500 max-w-[180px] truncate select-all block font-mono" title="${urlStr}">${urlStr}</span>`;
    }

    let dynamicActionControl = "";
    if (authed) {
      let statusColor = "text-emerald-400";
      if (currentStatus === "Issued") statusColor = "text-amber-400";
      if (currentStatus === "Reserved") statusColor = "text-indigo-400";

      dynamicActionControl = `
        <div class="flex items-center justify-end gap-3">
          <select onchange="handleStatusChange('${itemId}', this.value)" class="bg-gray-950 border border-gray-800 text-[11px] rounded px-1 py-0.5 custom-select target-status focus:outline-none focus:border-indigo-500 ${statusColor} font-bold bg-none">
            <option value="Available" ${currentStatus === 'Available' ? 'selected' : ''} class="text-emerald-400 font-bold">Available</option>
            <option value="Issued" ${currentStatus === 'Issued' ? 'selected' : ''} class="text-amber-400 font-bold">Issued</option>
            <option value="Reserved" ${currentStatus === 'Reserved' ? 'selected' : ''} class="text-indigo-400 font-bold">Reserved</option>
          </select>
          <button onclick="removeAsset('${itemId}')" class="text-[10px] uppercase font-black tracking-wider text-red-500/70 hover:text-red-400 border border-red-500/20 hover:border-red-500/40 bg-red-950/10 px-2 py-0.5 rounded transition-colors">[Drop]</button>
        </div>
      `;
    }

    tr.innerHTML = `
        <td class="p-4 font-mono font-bold text-indigo-400 select-all">${itemId}</td>
        <td class="p-4 text-gray-200 font-medium">${itemTitle}</td>
        <td class="p-4 text-gray-400">${itemAuthor}</td>
        <td class="p-4">${extraFieldMarkup}</td>
        <td class="p-4 text-right">${dynamicActionControl}</td>
    `;
    tbody.appendChild(tr);
  });
}

function handleSearch(query) {
  const cleanQuery = query.toLowerCase().trim();
  const currentSet = activePartition === "books" ? physicalInventory : digitalInventory;

  const filtered = currentSet.filter(
    (item) =>
      String(item.asset_id || item.id || "").toLowerCase().includes(cleanQuery) ||
      String(item.title || "").toLowerCase().includes(cleanQuery) ||
      String(item.author || "").toLowerCase().includes(cleanQuery),
  );
  renderTable(filtered);
}

function toggleModal(show) {
  const modal = document.getElementById("asset-modal");
  if (modal) show ? modal.classList.remove("hidden") : modal.classList.add("hidden");
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

function toggleAuthMode(switchToSignUp) {
  const loginInterface = document.getElementById("login-mode-interface");
  const signupInterface = document.getElementById("signup-mode-interface");
  const title = document.getElementById("auth-title");
  const errorAlert = document.getElementById("auth-error");

  errorAlert.classList.add("hidden");
  
  if (switchToSignUp) {
    loginInterface.classList.add("hidden");
    signupInterface.classList.remove("hidden");
    title.textContent = "Register Admin Entry";
  } else {
    signupInterface.classList.add("hidden");
    loginInterface.classList.remove("hidden");
    title.textContent = "Elevated Privileges Required";
  }
}

async function handleLegacySignUp(event) {
  event.preventDefault();
  const username = document.getElementById("signup-user").value.trim();
  const password = document.getElementById("signup-pass").value;
  const errorAlert = document.getElementById("auth-error");
  const computedHash = await sha256(password);

  try {
    await fetch(AUTH_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      body: JSON.stringify({ action: "add_legacy", username: username, hash: computedHash })
    });

    alert("Registration event dispatched. Verify entry updates inside your spreadsheet data array.");
    document.getElementById("signup-form").reset();
    toggleAuthMode(false);
    toggleAuthGateway(false);
  } catch (err) {
    console.error("SIGNUP_NET_ERROR:", err);
    errorAlert.textContent = "REGISTRATION_FAILURE: Endpoint dropped handshake.";
    errorAlert.classList.remove("hidden");
  }
}

async function handleStatusChange(targetId, newStatus) {
  if (!isAuthorized()) return;

  try {
    await fetch(DATA_SCRIPT_WEBAPP_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update_status",
        id: targetId,
        status: newStatus,
        stream: activePartition
      })
    });
    
    const currentSet = activePartition === "books" ? physicalInventory : digitalInventory;
    const asset = currentSet.find(item => String(item.asset_id || item.id) === String(targetId));
    if (asset) asset.status = newStatus;
    
    calculateMetrics(currentSet);
    renderTable(currentSet);
  } catch (error) {
    console.error("STATUS_MUTATION_FAILURE:", error);
    alert("MUTATION_FAILURE: Failed to record updated status matrix to database.");
  }
}