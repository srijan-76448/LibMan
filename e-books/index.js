const API_URL = "https://script.google.com/macros/s/AKfycbyqpEr_siBoA-xmOfy9IlQ_7kv297gj1YiT36TXaO1Y0VUdYKOTFq62OlSlrrqSSabNZg/exec";
let ebookCache = [];

async function initEbooks() {
  try {
    const response = await fetch(API_URL);
    ebookCache = await response.json();
    renderEbooks(ebookCache);
  } catch (err) {
    console.error("Digital array stream initialization failure:", err);
    document.getElementById("ebook-grid").innerHTML = `
      <div class="col-span-full text-center py-8 text-red-400 font-mono text-xs">
        SYS_SYNC_FAILURE: Failed to route remote e-book catalog data stream.
      </div>`;
  }
}

function renderEbooks(items) {
  const grid = document.getElementById("ebook-grid");
  const emptyState = document.getElementById("empty-state");

  if (items.length === 0) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  grid.innerHTML = items
    .map((item) => {
      // Keys are automatically normalized to lowercase snake_case by the updated script
      const targetUrl = item.download_url || item.url || "#";
      const fileExtension = targetUrl.split(".").pop().toUpperCase().substring(0, 4);
      const formatTag = ["PDF", "EPUB", "MOBI", "ZIP"].includes(fileExtension) ? fileExtension : "VIRTUAL";

      return `
            <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between hover:border-gray-700 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200">
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded font-bold">
                            [${formatTag}]
                        </span>
                        <span class="text-[10px] ${item.status === 'Available' ? 'text-emerald-400' : 'text-amber-400'}">
                          ${item.status ? item.status.toUpperCase() : 'UNKNOWN'}
                        </span>
                    </div>
                    <h3 class="font-bold text-gray-100 line-clamp-2 tracking-tight pt-1 text-base leading-snug">${item.title || "Binary Object"}</h3>
                    <p class="text-xs text-gray-400 line-clamp-1">by ${item.author || "Unknown"}</p>
                </div>
                <div class="mt-5 pt-3 border-t border-gray-800/60 flex justify-end">
                    <a href="${targetUrl}" target="_blank" class="w-full text-center text-xs font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 border border-indigo-500/20 py-2 rounded-lg transition-colors">
                        [GET /stream_file]
                    </a>
                </div>
            </div>
        `;
    })
    .join("");
}

let searchDebounce;
function handleEbookSearch(query) {
  clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => {
    const cleaned = query.toLowerCase().trim();
    const output = ebookCache.filter(
      (item) =>
        String(item.title || "").toLowerCase().includes(cleaned) ||
        String(item.author || "").toLowerCase().includes(cleaned)
    );
    renderEbooks(output);
  }, 150);
}

window.onload = initEbooks;
