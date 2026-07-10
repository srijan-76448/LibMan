const API_URL = "https://script.google.com/macros/s/AKfycbzNW0Cr54co6OI3de5B6zMDtUB9qFw1hkl7vUQ2U6Y9rXTVLa2p7qh9OB6rVYy2xGVlyQ/exec";
let localCache = [];

function switchTab(targetTab) {
  const tabs = ["inventory", "scanner", "config"];
  tabs.forEach((tab) => {
    const section = document.getElementById(`tab-${tab}`);
    const button = document.getElementById(`tab-btn-${tab}`);

    if (tab === targetTab) {
      section.classList.remove("hidden");
      button.className =
        "text-indigo-400 border-b-2 border-indigo-500 pb-3 px-1 font-bold";
    } else {
      section.classList.add("hidden");
      button.className =
        "text-gray-400 hover:text-gray-200 pb-3 px-1 transition-colors";
    }
  });
}

function toggleModal(show) {
  document.getElementById("asset-modal").classList.toggle("hidden", !show);
  if (show) document.getElementById("asset-form").reset();
}

async function fetchInventory() {
  try {
    const response = await fetch(API_URL);
    localCache = await response.json();
    renderTable(localCache);
    updateStats(localCache);
  } catch (err) {
    console.error("Admin dataset evaluation fault:", err);
  }
}

function renderTable(data) {
  const tbody = document.getElementById("inventory-table");
  tbody.innerHTML = data
    .map(
      (book) => `
        <tr class="hover:bg-gray-800/30 transition-colors">
            <td class="p-4 font-bold text-indigo-400">${book.id || "N/A"}</td>
            <td class="p-4 text-gray-200 font-medium">${book.title || "N/A"}</td>
            <td class="p-4 text-gray-400">${book.author || "N/A"}</td>
            <td class="p-4">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${book.status === "Available" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20"}">
                    ${book.status || "Unknown"}
                </span>
            </td>
        </tr>
    `,
    )
    .join("");
}

function updateStats(data) {
  document.getElementById("total-books").innerText = data.length;
  document.getElementById("available-books").innerText = data.filter(
    (b) => b.status === "Available",
  ).length;
  document.getElementById("issued-books").innerText = data.filter(
    (b) => b.status === "Issued",
  ).length;
}

let searchTimeout;
function handleSearch(query) {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => {
    const normalized = query.toLowerCase();
    const filtered = localCache.filter(
      (book) =>
        book.title?.toLowerCase().includes(normalized) ||
        book.author?.toLowerCase().includes(normalized) ||
        String(book.id).toLowerCase().includes(normalized),
    );
    renderTable(filtered);
  }, 250);
}

async function submitAsset(e) {
  e.preventDefault();
  const payload = {
    action: "add",
    id: document.getElementById("form-id").value,
    title: document.getElementById("form-title").value,
    author: document.getElementById("form-author").value,
    status: "Available",
  };

  toggleModal(false);
  localCache.push(payload);
  renderTable(localCache);
  updateStats(localCache);

  try {
    await fetch(API_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setTimeout(fetchInventory, 1500);
  } catch (err) {
    console.error("Mutation pipeline runtime failure:", err);
  }
}

window.onload = fetchInventory;
