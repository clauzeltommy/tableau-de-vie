window.addEventListener("DOMContentLoaded", () => {
  const app = document.getElementById("app");

  const LS_TEMPLATES = "templates_v1";
  const LS_WORKOUTS  = "workouts_v1";
  const LS_THEME     = "theme_v1";

  const MONTHLY_COST_EUR = 25.00;

  const load = (key) => JSON.parse(localStorage.getItem(key) || "[]");
  const save = (key, data) => localStorage.setItem(key, JSON.stringify(data));

  const todayISO = () => new Date().toISOString().slice(0, 10);

  // ✅ ID qui marche partout (même sans crypto/randomUUID)
  function uid() {
    return (
      "id-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 10)
    );
  }

  // theme
  function applyTheme() {
    const t = localStorage.getItem(LS_THEME) || "light";
    document.body.classList.toggle("dark", t === "dark");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = (t === "dark") ? "☀️" : "🌙";
  }
  function toggleTheme() {
    const cur = localStorage.getItem(LS_THEME) || "light";
    localStorage.setItem(LS_THEME, cur === "dark" ? "light" : "dark");
    applyTheme();
  }
  const themeBtn = document.getElementById("themeToggle");
  if (themeBtn) themeBtn.onclick = toggleTheme;
  applyTheme();

  // nav
  let route = { page: "home" };
  const go = (to) => { route = to; render(); };

  // helpers
  function toggleFilled(el) {
    const v = String(el.value ?? "").trim();
    if (v !== "") el.classList.add("filled");
    else el.classList.remove("filled");
  }
  function wireFilled() {
    app.querySelectorAll("input, select").forEach(el => {
      toggleFilled(el);
      el.addEventListener("input", () => toggleFilled(el));
      el.addEventListener("change", () => toggleFilled(el));
    });
  }

  function lastWorkout(templateId) {
    return load(LS_WORKOUTS)
      .filter(w => w.templateId === templateId)
      .sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        if (d !== 0) return d;
        return (b.createdAt || 0) - (a.createdAt || 0);
      })[0] || null;
  }

  function uniqueDates(workouts) {
    return Array.from(new Set(workouts.map(w => w.date))).sort();
  }

  function countPPLForMonth(ym) {
    const workouts = load(LS_WORKOUTS);
    const templates = load(LS_TEMPLATES);
    const ymPrefix = `${ym}-`;
    const catById = new Map(templates.map(t => [t.id, t.category]));

    const seen = new Set();
    const counts = { push: 0, pull: 0, legs: 0 };

    for (const w of workouts) {
      if (!w.date || !w.date.startsWith(ymPrefix)) continue;
      const cat = catById.get(w.templateId);
      if (!cat) continue;
      const key = `${w.date}|${cat}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (counts[cat] != null) counts[cat] += 1;
    }
    return { counts };
  }

  function workoutsOnDate(dateISO) {
    const workouts = load(LS_WORKOUTS).filter(w => w.date === dateISO);
    const templates = load(LS_TEMPLATES);
    const byId = new Map(templates.map(t => [t.id, t]));

    return workouts
      .sort((a,b) => (b.createdAt||0) - (a.createdAt||0))
      .map(w => {
        const t = byId.get(w.templateId);
        return {
          workoutId: w.id,
          name: t?.name || "Séance",
          category: (t?.category || "?").toUpperCase(),
          createdAt: w.createdAt || 0
        };
      });
  }

  function formatHM(ts) {
    if (!ts) return "--:--";
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2,"0");
    const mm = String(d.getMinutes()).padStart(2,"0");
    return `${hh}:${mm}`;
  }

  function deleteWorkout(workoutId) {
    const ok = confirm("Supprimer cet enregistrement ? (si c'était un test)");
    if (!ok) return;
    const workouts = load(LS_WORKOUTS).filter(w => w.id !== workoutId);
    save(LS_WORKOUTS, workouts);
  }

  // pages
  function renderHome() {
    app.innerHTML = `
      <div class="card">
        <h2>Menu</h2>
        <button id="sport">🏋️ Sport</button>
        <button disabled>💰 Finance</button>
        <button disabled>📝 Notes</button>
      </div>
    `;
    document.getElementById("sport").onclick = () => go({ page: "sport" });
  }

  function renderSport() {
    const templates = load(LS_TEMPLATES);

    app.innerHTML = `
      <div class="actions">
        <button class="iconBtn" id="back">←</button>
        <button class="btnWide" disabled>Sport</button>
      </div>

      <div class="card">
        <div class="quickRow">
          <button id="planning">📅 Planning</button>
          <button id="new">➕ Créer une séance</button>
        </div>
      </div>

      <h2>Mes séances</h2>
      ${templates.length === 0 ? `<p class="small">Aucune séance. Crée “Push 1”.</p>` : ""}

      ${templates.map(t => `
        <div class="card">
          <div class="templateRow">
            <div class="info">
              <strong>${t.name}</strong>
              <div class="small">${t.category.toUpperCase()} • ${t.exercises.length} exos</div>
            </div>
            <button class="iconBtn" data-launch="${t.id}" title="Lancer">▶️</button>
            <button class="iconBtn" data-trash="${t.id}" title="Supprimer">🗑️</button>
          </div>
        </div>
      `).join("")}
    `;

    document.getElementById("back").onclick = () => go({ page: "home" });
    document.getElementById("new").onclick = () => go({ page: "newTemplate" });
    document.getElementById("planning").onclick = () => go({ page: "planning" });

    app.querySelectorAll("[data-launch]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-launch");
        const ok = confirm("Avant de commencer : est-ce que tu t'es bien échauffé ? 💪");
        if (!ok) return;
        go({ page: "workout", id });
      };
    });

    app.querySelectorAll("[data-trash]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-trash");
        const ok = confirm("J'espère que tu t'es juste trompé 😄\nN'abandonne pas !!\n\nTu confirmes la suppression ?");
        if (!ok) return;
        save(LS_TEMPLATES, load(LS_TEMPLATES).filter(t => t.id !== id));
        save(LS_WORKOUTS, load(LS_WORKOUTS).filter(w => w.templateId !== id));
        renderSport();
      };
    });
  }

  function renderNewTemplate() {
    let exercises = [];

    app.innerHTML = `
      <div class="actions">
        <button class="iconBtn" id="back">←</button>
        <button class="btnWide" id="saveTpl">Enregistrer</button>
      </div>

      <h2>Créer une séance</h2>

      <label>Nom</label>
      <input id="name" placeholder="Ex: Push 1" />

      <label>Type</label>
      <select id="cat">
        <option value="push">Push</option>
        <option value="pull">Pull</option>
        <option value="legs">Legs</option>
      </select>

      <div class="card">
        <strong>Exercices</strong>
        <p class="small">Nom + nombre de séries.</p>

        <div class="exerciseAddRow">
          <input id="exoName" placeholder="Ex: Développé couché" />
          <input id="exoSets" class="setsInput" type="number" min="1" value="4" />
        </div>

        <button id="addExo">Ajouter l’exercice</button>
        <div id="exoList"></div>
      </div>
    `;

    const draw = () => {
      const list = document.getElementById("exoList");
      list.innerHTML = exercises.map((e, i) => `
        <div class="card">
          <div class="templateRow">
            <div class="info">
              <strong>${e.name}</strong>
              <div class="small">${e.sets} séries</div>
            </div>
            <button class="iconBtn" data-del="${i}">🗑️</button>
          </div>
        </div>
      `).join("");

      list.querySelectorAll("[data-del]").forEach(btn => {
        btn.onclick = () => {
          const idx = Number(btn.getAttribute("data-del"));
          exercises.splice(idx, 1);
          draw();
        };
      });
    };

    document.getElementById("back").onclick = () => go({ page: "sport" });

    document.getElementById("addExo").onclick = () => {
      const exName = document.getElementById("exoName").value.trim();
      const sets = Number(document.getElementById("exoSets").value);
      if (!exName) return alert("Mets un nom d’exercice.");
      if (!sets || sets < 1) return alert("Nombre de séries invalide.");
      exercises.push({ name: exName, sets });
      document.getElementById("exoName").value = "";
      document.getElementById("exoSets").value = 4;
      draw();
    };

    document.getElementById("saveTpl").onclick = () => {
      const n = document.getElementById("name").value.trim();
      const cat = document.getElementById("cat").value;
      if (!n) return alert("Donne un nom à la séance.");
      if (exercises.length === 0) return alert("Ajoute au moins 1 exercice.");

      const templates = load(LS_TEMPLATES);
      templates.push({ id: uid(), name: n, category: cat, exercises });
      save(LS_TEMPLATES, templates);
      go({ page: "sport" });
    };

    draw();
  }

  function renderWorkout(templateId) {
    const tpl = load(LS_TEMPLATES).find(t => t.id === templateId);
    if (!tpl) return go({ page: "sport" });

    const last = lastWorkout(templateId);

    app.innerHTML = `
      <div class="actions">
        <button class="iconBtn" id="back">←</button>
        <button class="btnWide" id="saveW">Enregistrer</button>
      </div>

      <h2>${tpl.name}</h2>

      <div class="card">
        <div class="small">Type : ${tpl.category.toUpperCase()}</div>
        <label>Date</label>
        <input type="date" id="date" value="${todayISO()}" />
        <div class="small">Par défaut aujourd’hui, modifiable si besoin.</div>
      </div>

      ${tpl.exercises.map((exo, exoIndex) => {
        const lastExo = last?.exercises?.[exoIndex];
        return `
          <div class="card">
            <strong>${exo.name}</strong>
            <div class="small">Séries : ${exo.sets}</div>

            ${Array.from({ length: exo.sets }).map((_, setIndex) => {
              const ls = lastExo?.sets?.[setIndex];
              const lastKg = (ls?.kg ?? "—");
              const lastReps = (ls?.reps ?? "—");
              const lastFeel = (ls?.feel ?? "—");
              return `
                <div class="setBlock">
                  <div class="lastLine small">
                    <span>Série ${setIndex + 1} • dernière : ${lastKg} kg × ${lastReps} reps</span>
                    <span class="badge">${lastFeel}</span>
                  </div>

                  <div class="row2">
                    <input inputmode="decimal" placeholder="kg" data-kg="${exoIndex}-${setIndex}" />
                    <input inputmode="numeric" placeholder="reps" data-reps="${exoIndex}-${setIndex}" />
                  </div>

                  <select data-feel="${exoIndex}-${setIndex}">
                    <option value="" selected>—</option>
                    <option value="OK">OK</option>
                    <option value="Facile">Facile</option>
                    <option value="Dur">Dur</option>
                    <option value="Échec">Échec</option>
                    <option value="Douleurs">Douleurs</option>
                  </select>
                </div>
              `;
            }).join("")}
          </div>
        `;
      }).join("")}
    `;

    document.getElementById("back").onclick = () => go({ page: "sport" });
    wireFilled();

    document.getElementById("saveW").onclick = () => {
      const date = document.getElementById("date").value || todayISO();

      const exercises = tpl.exercises.map((exo, exoIndex) => {
        const sets = Array.from({ length: exo.sets }).map((_, setIndex) => {
          const kgVal = app.querySelector(`[data-kg="${exoIndex}-${setIndex}"]`).value.trim();
          const repsVal = app.querySelector(`[data-reps="${exoIndex}-${setIndex}"]`).value.trim();
          const feelVal = app.querySelector(`[data-feel="${exoIndex}-${setIndex}"]`).value.trim();
          return {
            kg: kgVal === "" ? null : Number(kgVal),
            reps: repsVal === "" ? null : Number(repsVal),
            feel: feelVal === "" ? null : feelVal
          };
        });
        return { name: exo.name, sets };
      });

      const hasSomething = exercises.some(e => e.sets.some(s => s.kg != null || s.reps != null));
      if (!hasSomething) return alert("Remplis au moins une série (kg ou reps).");

      const workouts = load(LS_WORKOUTS);
      workouts.push({
        id: uid(),
        templateId,
        date,
        createdAt: Date.now(),
        exercises
      });
      save(LS_WORKOUTS, workouts);

      go({ page: "sport" });
    };
  }

  function renderPlanning() {
    const workouts = load(LS_WORKOUTS);
    const dates = uniqueDates(workouts);

    const now = new Date();
    const ymDefault = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

    app.innerHTML = `
      <div class="actions">
        <button class="iconBtn" id="back">←</button>
        <button class="btnWide" disabled>Planning</button>
      </div>

      <h2>Planning</h2>

      <div class="planningWrap">
        <div class="card">
          <label>Mois</label>
          <input id="monthPick" type="month" value="${ymDefault}" />
          <div class="small">Jour validé = au moins 1 séance enregistrée.</div>
        </div>

        <div class="statsRow3">
          <div class="stat">
            <div class="small">Jours de salle ce mois</div>
            <div class="num" id="monthCount">0</div>
          </div>

          <div class="stat">
            <div class="small">Coût / séance</div>
            <div class="num" id="costPer">—</div>
            <div class="small">${MONTHLY_COST_EUR.toFixed(2)}€ / mois</div>
          </div>

          <div class="stat">
            <div class="small">Jours de salle cette année</div>
            <div class="num" id="yearCount">0</div>
          </div>
        </div>

        <div class="pplRow">
          <div class="stat">
            <div class="small">Push (mois)</div>
            <div class="num" id="pushCount">0</div>
          </div>
          <div class="stat">
            <div class="small">Pull (mois)</div>
            <div class="num" id="pullCount">0</div>
          </div>
          <div class="stat">
            <div class="small">Legs (mois)</div>
            <div class="num" id="legsCount">0</div>
          </div>
        </div>

        <div class="calendar">
          <div class="weekdays">
            <div>L</div><div>M</div><div>M</div><div>J</div><div>V</div><div>S</div><div>D</div>
          </div>
          <div class="days" id="daysGrid"></div>
        </div>

        <div class="card" id="dayDetails" style="display:none;"></div>
      </div>
    `;

    document.getElementById("back").onclick = () => go({ page: "sport" });

    const monthPick = document.getElementById("monthPick");
    const daysGrid = document.getElementById("daysGrid");

    const monthCountEl = document.getElementById("monthCount");
    const yearCountEl  = document.getElementById("yearCount");
    const costPerEl    = document.getElementById("costPer");

    const pushEl = document.getElementById("pushCount");
    const pullEl = document.getElementById("pullCount");
    const legsEl = document.getElementById("legsCount");

    const dayDetails = document.getElementById("dayDetails");
    let selectedISO = null;

    function showDay(iso) {
      selectedISO = iso;
      const list = workoutsOnDate(iso);

      dayDetails.style.display = "block";
      dayDetails.innerHTML = `
        <strong>${iso}</strong>
        <div class="small">Séances enregistrées :</div>
        ${list.length === 0 ? `<p class="small">Aucune.</p>` : `
          ${list.map(x => `
            <div class="card" style="margin:10px 0;">
              <div class="dayItemRow">
                <div class="meta">
                  <strong>${x.name}</strong>
                  <div class="small">${x.category}</div>
                </div>
                <div class="right">
                  <div class="timeTag">${formatHM(x.createdAt)}</div>
                  <button class="iconBtn" data-delwork="${x.workoutId}">🗑️</button>
                </div>
              </div>
            </div>
          `).join("")}
        `}
      `;

      dayDetails.querySelectorAll("[data-delwork]").forEach(btn => {
        btn.onclick = () => {
          const wid = btn.getAttribute("data-delwork");
          deleteWorkout(wid);
          const newDates = uniqueDates(load(LS_WORKOUTS));
          dates.length = 0; newDates.forEach(d => dates.push(d));
          showDay(iso);
          renderMonth(monthPick.value);
        };
      });
    }

    function renderMonth(ym) {
      const [Y, M] = ym.split("-").map(Number);
      const first = new Date(Y, M-1, 1);
      const last = new Date(Y, M, 0);
      const daysInMonth = last.getDate();

      let jsDay = first.getDay();
      let offset = (jsDay + 6) % 7;

      const ymPrefix = `${ym}-`;
      const monthDates = new Set(dates.filter(d => d.startsWith(ymPrefix)));
      const yearPrefix = `${Y}-`;
      const yearDates = new Set(dates.filter(d => d.startsWith(yearPrefix)));

      const monthCount = monthDates.size;
      monthCountEl.textContent = String(monthCount);
      yearCountEl.textContent = String(yearDates.size);

      costPerEl.textContent = (monthCount === 0)
        ? "—"
        : (MONTHLY_COST_EUR / monthCount).toFixed(2) + "€";

      const { counts } = countPPLForMonth(ym);
      pushEl.textContent = String(counts.push);
      pullEl.textContent = String(counts.pull);
      legsEl.textContent = String(counts.legs);

      const cells = [];
      for (let i = 0; i < offset; i++) cells.push(`<div class="day empty"></div>`);

      for (let d = 1; d <= daysInMonth; d++) {
        const dd = String(d).padStart(2,"0");
        const iso = `${ym}-${dd}`;
        const hit = monthDates.has(iso);
        const selected = (iso === selectedISO);
        cells.push(`
          <div class="day ${hit ? "hit" : ""} ${selected ? "selected" : ""}" ${hit ? `data-iso="${iso}"` : ""}>
            ${d}
          </div>
        `);
      }

      while (cells.length % 7 !== 0) cells.push(`<div class="day empty"></div>`);
      daysGrid.innerHTML = cells.join("");

      daysGrid.querySelectorAll("[data-iso]").forEach(el => {
        el.onclick = () => {
          const iso = el.getAttribute("data-iso");
          showDay(iso);
          renderMonth(monthPick.value);
        };
      });

      if (selectedISO && !selectedISO.startsWith(ymPrefix)) {
        selectedISO = null;
        dayDetails.style.display = "none";
      }
    }

    monthPick.onchange = () => {
      selectedISO = null;
      dayDetails.style.display = "none";
      renderMonth(monthPick.value);
    };

    renderMonth(monthPick.value);
  }

  function render() {
    applyTheme();
    if (route.page === "home") return renderHome();
    if (route.page === "sport") return renderSport();
    if (route.page === "newTemplate") return renderNewTemplate();
    if (route.page === "workout") return renderWorkout(route.id);
    if (route.page === "planning") return renderPlanning();
  }

  try { render(); }
  catch (e) {
    app.innerHTML = `<div class="card errorBox">Erreur JavaScript :\n${String(e && e.stack ? e.stack : e)}</div>`;
    console.error(e);
  }
});
