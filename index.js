const API_URL = "https://script.google.com/macros/s/AKfycbzNW0Cr54co6OI3de5B6zMDtUB9qFw1hkl7vUQ2U6Y9rXTVLa2p7qh9OB6rVYy2xGVlyQ/exec";
let catalogCache = [];

document.addEventListener("DOMContentLoaded", () => {
  initCatalog();
});

async function initCatalog() {
  try {
    const response = await fetch(API_URL);
    const databasePayload = await response.json();
    
    // Matrix filtration: Store only available items in global catalog baseline state
    catalogCache = databasePayload.filter(
      (item) => String(item.status || item.Status || "").trim().toLowerCase() === "available"
    );
    
    renderCatalog(catalogCache);
  } catch (err) {
    console.error("Catalog baseline initialization fault:", err);
  }
}

function renderCatalog(items) {
  const grid = document.getElementById("catalog-grid");
  const emptyState = document.getElementById("empty-state");

  if (items.length === 0) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  grid.innerHTML = items
    .map(
      (item) => `
        <div class="bg-gray-900 border border-gray-800/80 rounded-xl p-5 flex flex-col justify-between hover:border-gray-700/80 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200">
            <div class="space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-[10px] font-mono text-indigo-400 tracking-tight">${item.id || item["Asset ID"] || "NO_ISBN"}</span>
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Available
                    </span>
                </div>
                <h3 class="font-bold text-gray-100 line-clamp-2 tracking-tight pt-1 text-base leading-snug">${item.title || item.Title || "Untitled Asset"}</h3>
                <p class="text-xs text-gray-400 line-clamp-1">by ${item.author || item.Author || "Unknown Author"}</p>
            </div>
            <div class="mt-5 pt-3 border-t border-gray-800/60 flex justify-between items-center">
                <span class="text-[10px] text-gray-600">SYS_LOG_OK</span>
                <button class="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition">
                    [Request]
                </button>
            </div>
        </div>
    `
    )
    .join("");
}

let searchDebounce;
function handleCatalogSearch(query) {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const cleaned = query.toLowerCase().trim();
    
    // Queries matching entries only within the filtered subset cache matrix
    const output = catalogCache.filter(
      (item) =>
        String(item.id || item["Asset ID"] || "").toLowerCase().includes(cleaned) ||
        String(item.title || item.Title || "").toLowerCase().includes(cleaned) ||
        String(item.author || item.Author || "").toLowerCase().includes(cleaned)
    );
    renderCatalog(output);
  }, 150);
}