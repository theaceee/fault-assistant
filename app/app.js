(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);

  const UI = {
    en: {
      title: "Fault Assistant", sub: "Offline troubleshooting",
      qLabel: "Describe the fault", search: "Find steps", photo: "Photo",
      photoHint: "Photo is stored only on this device. Type the fault code or panel message shown in the photo above to search.",
      browse: "All procedures", footer: "All data is stored on this device. No internet needed.",
      online: "Online", offline: "Offline · works without network", noMatch: "No close match. Try other words or browse below.",
      symptoms: "Symptoms", steps: "Steps", source: "Source", match: "Match", done: "Mark done",
      emptyQ: "Please describe the fault first.", voiceNA: "Voice input is not supported on this device.",
      placeholder: "e.g. motor is overheating", listening: "Listening…",
      chips: ["Pump will not start", "Motor overheating", "Low pressure", "Vibration / noise", "Earth fault / leakage"],
      langName: "en-IN",
    },
    gu: {
      title: "ખરાબી સહાયક", sub: "ઇન્ટરનેટ વિના ખરાબી શોધ",
      qLabel: "ખરાબીનું વર્ણન કરો", search: "સ્ટેપ્સ શોધો", photo: "ફોટો",
      photoHint: "ફોટો ફક્ત આ ઉપકરણ પર સંગ્રહાય છે. ફોટામાં દેખાતો ફોલ્ટ કોડ કે પેનલ સંદેશ ઉપર લખીને શોધો.",
      browse: "બધી પ્રક્રિયાઓ", footer: "બધો ડેટા આ ઉપકરણ પર છે. ઇન્ટરનેટની જરૂર નથી.",
      online: "ઓનલાઇન", offline: "ઓફલાઇન · નેટવર્ક વિના ચાલે છે", noMatch: "નજીકનું પરિણામ નથી. બીજા શબ્દો વાપરો અથવા નીચે જુઓ.",
      symptoms: "લક્ષણો", steps: "સ્ટેપ્સ", source: "સ્રોત", match: "મેળ", done: "થઈ ગયું",
      emptyQ: "પહેલા ખરાબીનું વર્ણન કરો.", voiceNA: "આ ઉપકરણ પર વોઇસ ઇનપુટ સપોર્ટેડ નથી.",
      placeholder: "દા.ત. મોટર વધુ ગરમ થાય છે", listening: "સાંભળી રહ્યા છીએ…",
      chips: ["પંપ શરૂ થતો નથી", "મોટર વધુ ગરમ", "ઓછું દબાણ", "કંપન / અવાજ", "અર્થ ફોલ્ટ / લીકેજ"],
      langName: "gu-IN",
    },
  };

  let lang = localStorage.getItem("fa-lang") || "en";
  let index = null;
  let allDocs = [];
  let lastQuery = "";

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // In the manual, each section has an en and gu variant. Show the variant in the UI language.
  function variantFor(doc) {
    if (doc.lang === lang || doc.lang === "auto") return doc;
    const sib = allDocs.find((d) => d.section === doc.section && d.lang === lang);
    return sib || doc;
  }

  function applyLang() {
    const t = UI[lang];
    document.documentElement.lang = lang === "gu" ? "gu" : "en";
    $("#t-title").textContent = t.title;
    $("#t-sub").textContent = t.sub;
    $("#t-q-label").textContent = t.qLabel;
    $("#btn-search").textContent = t.search;
    $("#t-photo").textContent = t.photo;
    $("#t-photo-hint").textContent = t.photoHint;
    $("#t-browse").textContent = t.browse;
    $("#t-footer").textContent = t.footer;
    $("#q").placeholder = t.placeholder;
    $("#chips").innerHTML = t.chips.map((c) => `<button class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join("");
    document.querySelectorAll(".lang button").forEach((b) => b.classList.toggle("active", b.dataset.lang === lang));
    updateNet();
    renderBrowse();
    if (lastQuery) runSearch(lastQuery);
  }

  function updateNet() {
    const t = UI[lang];
    const on = navigator.onLine;
    $("#net").className = "badge" + (on ? "" : " off");
    $("#net").textContent = "● " + (on ? t.online : t.offline);
  }

  function renderBrowse() {
    const seen = new Set();
    const items = [];
    for (const d of allDocs) {
      if (d.kind !== "procedure" || seen.has(d.section)) continue;
      seen.add(d.section);
      items.push(variantFor(d));
    }
    $("#list").innerHTML = items.map((d) => `<li><button data-section="${esc(d.section)}">${esc(d.title)}</button></li>`).join("");
  }

  function renderResults(results) {
    const t = UI[lang];
    const box = $("#results");
    if (!results.length) {
      box.innerHTML = `<div class="card warn">${t.noMatch}</div>`;
      return;
    }
    box.innerHTML = results.map((r) => {
      const d = variantFor(r.doc);
      const pct = Math.round(r.confidence * 100);
      const isPassage = d.kind === "passage";
      const body = isPassage
        ? `<p>${esc(d.text)}</p>`
        : `${d.symptoms ? `<p><strong>${t.symptoms}:</strong> ${esc(d.symptoms)}</p>` : ""}
           <ol class="steps">${d.steps.map((s, i) => `<li><label><input type="checkbox" data-step="${r.doc.section}-${i}"> <span>${esc(s)}</span></label></li>`).join("")}</ol>`;
      return `<article class="card result">
        <h3>${esc(d.title)}</h3>
        <div class="meta"><span class="pill">${t.match} ${pct}%</span><span class="pill">${t.source}: ${esc(d.source)}${d.page ? " p." + d.page : ""}</span></div>
        ${body}
      </article>`;
    }).join("");
    // restore checkbox state
    box.querySelectorAll("input[data-step]").forEach((cb) => {
      cb.checked = localStorage.getItem("fa-step-" + cb.dataset.step) === "1";
      cb.closest("li").classList.toggle("done", cb.checked);
    });
  }

  function runSearch(q) {
    lastQuery = q;
    if (!q.trim()) { $("#results").innerHTML = `<div class="card warn">${UI[lang].emptyQ}</div>`; return; }
    if (!index) return;
    renderResults(index.search(q, { limit: 4, lang }));
    // remember recent queries for quick offline recall
    try {
      const h = JSON.parse(localStorage.getItem("fa-history") || "[]").filter((x) => x !== q);
      h.unshift(q); localStorage.setItem("fa-history", JSON.stringify(h.slice(0, 10)));
    } catch (_) {}
  }

  // ---------- events ----------
  document.querySelectorAll(".lang button").forEach((b) => b.addEventListener("click", () => {
    lang = b.dataset.lang; localStorage.setItem("fa-lang", lang); applyLang();
  }));
  $("#btn-search").addEventListener("click", () => runSearch($("#q").value));
  $("#q").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); runSearch($("#q").value); } });
  $("#chips").addEventListener("click", (e) => {
    const q = e.target.dataset.q; if (!q) return; $("#q").value = q; runSearch(q);
  });
  $("#list").addEventListener("click", (e) => {
    const sec = e.target.dataset.section; if (!sec) return;
    const doc = allDocs.find((d) => d.section === sec);
    $("#q").value = doc.title; runSearch(doc.section.replace(/-/g, " ") + " " + doc.title);
    window.scrollTo({ top: 0, behavior: "smooth" });
  });
  $("#results").addEventListener("change", (e) => {
    const cb = e.target; if (!cb.dataset.step) return;
    localStorage.setItem("fa-step-" + cb.dataset.step, cb.checked ? "1" : "0");
    cb.closest("li").classList.toggle("done", cb.checked);
  });
  $("#photo").addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const url = URL.createObjectURL(f);
    $("#photo-preview").src = url; $("#photo-wrap").hidden = false;
  });

  // Voice input (uses the device's built-in recognizer where available; works best on Android Chrome).
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  $("#btn-voice").addEventListener("click", () => {
    if (!SR) { alert(UI[lang].voiceNA); return; }
    const rec = new SR();
    rec.lang = UI[lang].langName; rec.interimResults = false; rec.maxAlternatives = 1;
    const btn = $("#btn-voice"); btn.classList.add("listening"); btn.textContent = "…";
    rec.onresult = (ev) => { const txt = ev.results[0][0].transcript; $("#q").value = txt; runSearch(txt); };
    rec.onend = () => { btn.classList.remove("listening"); btn.textContent = "🎤"; };
    rec.onerror = () => { btn.classList.remove("listening"); btn.textContent = "🎤"; };
    rec.start();
  });

  window.addEventListener("online", updateNet);
  window.addEventListener("offline", updateNet);

  // ---------- boot ----------
  fetch("data/manual.json").then((r) => r.json()).then((data) => {
    allDocs = data.docs;
    index = new FaultSearch.ManualIndex(data);
    applyLang();
  }).catch(() => { $("#results").innerHTML = `<div class="card warn">Manual data not found. Run tools/build_index.py.</div>`; });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  applyLang();
})();
