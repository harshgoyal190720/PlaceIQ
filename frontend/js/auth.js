// Auto-pick API base: local backend when running on LAN/localhost, otherwise Render URL
const API_BASE = (()=>{
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(host);
  if(isLocal){
    return `http://${host}:8600`;
  }
  return "https://placeiq-ylqx.onrender.com";
})();

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

async function login(email, password) {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    throw new Error("Invalid credentials");
  }
  const data = await res.json();
  localStorage.setItem("placeiq_token", data.token);
  localStorage.setItem("placeiq_role", data.role);
  localStorage.setItem("placeiq_name", data.name || "");
  if (data.student_id) {
    localStorage.setItem("placeiq_student_id", data.student_id);
  } else {
    localStorage.removeItem("placeiq_student_id");
  }
  if (data.role === "admin") {
    window.location.href = "admin.html";
  } else {
    window.location.href = "student.html";
  }
}

function logout() {
  localStorage.removeItem("placeiq_token");
  localStorage.removeItem("placeiq_role");
  localStorage.removeItem("placeiq_student_id");
  localStorage.removeItem("placeiq_name");
  window.location.href = "index.html";
}

function getToken() { return localStorage.getItem("placeiq_token"); }
function getRole() { return localStorage.getItem("placeiq_role"); }
function getHeaders() { return { "Authorization": `Bearer ${getToken()}`, "Content-Type": "application/json" }; }

function isLoggedIn() {
  if (!getToken()) {
    window.location.href = "index.html";
    return false;
  }
  return true;
}

// expose for inline onclick
window.logout = logout;
window.showToast = showToast;
window.API_BASE = API_BASE;
window.getHeaders = getHeaders;
window.isLoggedIn = isLoggedIn;
window.getRole = getRole;
window.login = login;
window.getToken = getToken;

