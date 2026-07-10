const API_URL = "https://script.google.com/macros/s/AKfycbzNW0Cr54co6OI3de5B6zMDtUB9qFw1hkl7vUQ2U6Y9rXTVLa2p7qh9OB6rVYy2xGVlyQ/exec";
let ebookCache = [];

async function initEbooks() {
  try {
    const response = await fetch(API_URL);
    const data = await response.json();
    ebookCache = data.filter((item) => item.download_url || item.url);
    renderEbooks(ebookCache);
  } catch (err) {
    console.error("Digital array stream initialization failure:", err);
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
      const targetUrl = item.download_url || item.url;
      const fileExtension = targetUrl
        .split(".")
        .pop()
        .toUpperCase()
        .substring(0, 4);
      const formatTag = ["PDF", "EPUB", "MOBI", "ZIP"].includes(fileExtension)
        ? fileExtension
        : "VIRTUAL";

      return `
            <div class="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col justify-between hover:border-gray-700 hover:shadow-lg hover:shadow-indigo-500/5 transition-all duration-200">
                <div class="space-y-2">
                    <div class="flex justify-between items-center">
                        <span class="text-[10px] text-cyan-400 bg-cyan-950/40 border border-cyan-800/30 px-2 py-0.5 rounded font-bold">
                            [${formatTag}]
                        </span>
                        <span class="text-[10px] text-gray-600">SYS_IO_READY</span>
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
    const cleaned = query.toLowerCase();
    const output = ebookCache.filter(
      (item) =>
        item.title?.toLowerCase().includes(cleaned) ||
        item.author?.toLowerCase().includes(cleaned),
    );
    renderEbooks(output);
  }, 200);
}

window.onload = initEbooks;
