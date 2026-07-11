// Target verification values
const TARGET_USER = "admin";
// SHA-256 hash representation of your master administrative passphrase key
const TARGET_PASS_HASH =
  "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"; // Default text signature value of: "admin123"

// Helper function to convert text strings to a cryptographic SHA-256 hexadecimal string
async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Initial session intercept check loop execution
document.addEventListener("DOMContentLoaded", () => {
  if (sessionStorage.getItem("sys_auth_state") === "authorized") {
    unlockWorkspace();
  }
});

function unlockWorkspace() {
  document.getElementById("auth-gateway").classList.add("hidden");
  document.getElementById("admin-workspace").classList.remove("hidden");
  // Run your initial data inventory fetch calls natively here
  if (typeof fetchInventory === "function") {
    fetchInventory();
  }
}

async function handleAdminLogin(event) {
  event.preventDefault();
  const userField = document.getElementById("auth-user").value.trim();
  const passField = document.getElementById("auth-pass").value;
  const errorAlert = document.getElementById("auth-error");

  const inputHash = await sha256(passField);

  if (userField === TARGET_USER && inputHash === TARGET_PASS_HASH) {
    errorAlert.classList.add("hidden");
    sessionStorage.setItem("sys_auth_state", "authorized");
    unlockWorkspace();
  } else {
    errorAlert.classList.remove("hidden");
    document.getElementById("auth-pass").value = "";
    document.getElementById("auth-pass").focus();
  }
}

function handleAdminLogout() {
  sessionStorage.removeItem("sys_auth_state");
  window.location.reload();
}
