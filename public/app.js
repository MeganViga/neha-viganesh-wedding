const app = document.getElementById("app");
const canvas = document.getElementById("celebrate");
const ctx = canvas.getContext("2d");

const PEOPLE = {
  neha: {
    path: "/for-neha",
    who: "neha",
    title: "For Neha",
    question: "Do you want to marry Viganesh?",
    waitingFor: "Viganesh",
    partner: "viganesh",
  },
  viganesh: {
    path: "/for-viganesh",
    who: "viganesh",
    title: "For Viganesh",
    question: "Do you want to marry Neha?",
    waitingFor: "Neha",
    partner: "neha",
  },
};

let lastMarried = false;
let lastFingerprint = "";
let confetti = [];
let confettiTimer = 0;

function route() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/";
  if (path === "/for-neha") return PEOPLE.neha;
  if (path === "/for-viganesh") return PEOPLE.viganesh;
  return null;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function currentUrl(path) {
  return `${window.location.origin}${path}`;
}

async function fetchState() {
  const response = await fetch("/api/state", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load vows");
  return response.json();
}

async function sayYes(who) {
  const response = await fetch("/api/yes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ who }),
  });
  if (!response.ok) throw new Error("Could not save the vow");
  return response.json();
}

async function resetVows() {
  const response = await fetch("/api/reset", { method: "POST" });
  if (!response.ok) throw new Error("Could not reset");
  return response.json();
}

function ornament() {
  return `
    <p class="ornament">Neha &nbsp;·&nbsp; Viganesh</p>
    <div class="monogram">N &amp; V</div>
    <div class="rule"><span></span>♥<span></span></div>
  `;
}

function renderHome(state) {
  const marriedNote = state.married
    ? `<p class="status">Both hearts have already said yes.</p>`
    : "";

  app.innerHTML = `
    <section class="card">
      ${ornament()}
      <p class="kicker">Two questions. One forever.</p>
      <h1>Will you marry each other?</h1>
      <p class="lede">
        Send Neha her link. Send Viganesh his. When both check yes,
        both pages turn into a wedding.
      </p>
      <div class="links">
        <a class="invite" href="/for-neha">
          <strong>Neha’s question</strong>
          <p>Do you want to marry Viganesh?</p>
          <div class="copy-row">
            <button class="chip" data-copy="${escapeHtml(currentUrl("/for-neha"))}" type="button">Copy her link</button>
          </div>
        </a>
        <a class="invite" href="/for-viganesh">
          <strong>Viganesh’s question</strong>
          <p>Do you want to marry Neha?</p>
          <div class="copy-row">
            <button class="chip" data-copy="${escapeHtml(currentUrl("/for-viganesh"))}" type="button">Copy his link</button>
          </div>
        </a>
      </div>
      ${marriedNote}
    </section>
  `;
}

function renderQuestion(page, state) {
  const alreadyYes = state[page.who];
  const partnerYes = state[page.partner];
  const locked = alreadyYes ? "is-locked" : "";
  let status = "";

  if (alreadyYes && !partnerYes) {
    status = `<p class="status"><span class="waiting-dot"></span>You said yes. Waiting for ${escapeHtml(page.waitingFor)}.</p>`;
  } else if (!alreadyYes && partnerYes) {
    status = `<p class="status">${escapeHtml(page.waitingFor)} is already waiting for your answer.</p>`;
  } else if (!alreadyYes) {
    status = `<p class="status">One checkbox. One vow.</p>`;
  }

  app.innerHTML = `
    <section class="card">
      ${ornament()}
      <p class="kicker">${escapeHtml(page.title)}</p>
      <h2 class="question">${escapeHtml(page.question)}</h2>
      <label class="vow ${locked}">
        <input id="vow" type="checkbox" ${alreadyYes ? "checked disabled" : ""} />
        <span class="heart" aria-hidden="true"></span>
        <span class="vow-copy">Yes, I do</span>
      </label>
      <div>
        <button class="yes-btn" id="yes-btn" type="button" ${alreadyYes ? "disabled" : ""}>
          ${alreadyYes ? "Vow saved" : "Seal this vow"}
        </button>
      </div>
      ${status}
    </section>
  `;
}

function renderMarried() {
  app.innerHTML = `
    <section class="card married">
      ${ornament()}
      <p class="kicker">From this day forward</p>
      <h1>Congratulations, you people are married</h1>
      <p class="lede">
        Neha said yes. Viganesh said yes. Two links, two hearts,
        and now one answer.
      </p>
      <button class="reset-btn" id="reset" type="button">Start the questions over</button>
    </section>
  `;
}

function renderError(message) {
  app.innerHTML = `
    <section class="card">
      <h1>Something paused the vows</h1>
      <p class="lede">${escapeHtml(message)}</p>
    </section>
  `;
}

async function copyLink(url, button) {
  try {
    await navigator.clipboard.writeText(url);
    button.textContent = "Copied";
    setTimeout(() => {
      button.textContent = button.dataset.copy.includes("for-neha")
        ? "Copy her link"
        : "Copy his link";
    }, 1400);
  } catch {
    window.prompt("Copy this link", url);
  }
}

function bindHome() {
  app.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      copyLink(button.dataset.copy, button);
    });
  });
}

function bindQuestion(page) {
  const checkbox = document.getElementById("vow");
  const button = document.getElementById("yes-btn");
  const submit = async () => {
    if (!checkbox || checkbox.disabled) return;
    checkbox.checked = true;
    checkbox.disabled = true;
    if (button) button.disabled = true;
    const next = await sayYes(page.who);
    paint(next);
  };

  checkbox?.addEventListener("change", () => {
    if (checkbox.checked) submit();
  });
  button?.addEventListener("click", submit);
}

function bindMarried() {
  document.getElementById("reset")?.addEventListener("click", async () => {
    lastMarried = false;
    const next = await resetVows();
    paint(next);
  });
}

function fingerprint(state) {
  const page = route();
  return JSON.stringify({
    path: page ? page.path : "/",
    neha: state.neha,
    viganesh: state.viganesh,
    married: state.married,
  });
}

function paint(state, force = false) {
  const nextFingerprint = fingerprint(state);
  if (!force && nextFingerprint === lastFingerprint) return;
  lastFingerprint = nextFingerprint;

  const page = route();

  if (state.married) {
    if (!lastMarried) burstConfetti();
    lastMarried = true;
    renderMarried();
    bindMarried();
    return;
  }

  lastMarried = false;
  if (!page) {
    renderHome(state);
    bindHome();
    return;
  }

  renderQuestion(page, state);
  bindQuestion(page);
}

function spawnPetals() {
  const field = document.getElementById("petals");
  for (let i = 0; i < 18; i += 1) {
    const petal = document.createElement("span");
    petal.className = "petal";
    petal.style.left = `${Math.random() * 100}%`;
    petal.style.animationDuration = `${8 + Math.random() * 10}s`;
    petal.style.animationDelay = `${Math.random() * -12}s`;
    petal.style.transform = `scale(${0.6 + Math.random() * 0.8})`;
    field.appendChild(petal);
  }
}

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}

function burstConfetti() {
  resizeCanvas();
  confetti = Array.from({ length: 140 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * canvas.height * 0.3,
    r: 3 + Math.random() * 4,
    c: ["#6d1c2a", "#c4a35a", "#e7c3b4", "#fff8ef", "#9a7430"][Math.floor(Math.random() * 5)],
    s: 1.4 + Math.random() * 2.4,
    a: Math.random() * Math.PI,
  }));
  confettiTimer = 220;
}

function tickConfetti() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (confettiTimer <= 0) {
    requestAnimationFrame(tickConfetti);
    return;
  }
  confettiTimer -= 1;
  confetti.forEach((bit) => {
    bit.y += bit.s;
    bit.x += Math.sin(bit.a);
    bit.a += 0.04;
    ctx.fillStyle = bit.c;
    ctx.fillRect(bit.x, bit.y, bit.r, bit.r * 1.5);
  });
  requestAnimationFrame(tickConfetti);
}

async function refresh() {
  try {
    paint(await fetchState());
  } catch (error) {
    lastFingerprint = "";
    renderError(error.message);
  }
}

spawnPetals();
resizeCanvas();
window.addEventListener("resize", resizeCanvas);
tickConfetti();
refresh();
setInterval(refresh, 1200);
