/* =========================================================
   ¿QUIÉN ERES? ¿TE CONOCES? · lógica del juego y de la web
   ========================================================= */
(function () {
  "use strict";

  var D = window.__BRAND__ || {};
  var COLORS = D.COLORS, REGIONS = D.REGIONS, PART_NAMES = D.PART_NAMES;
  var QUIZ = D.QUIZ, EMOTIONS = D.EMOTIONS, ACH = D.ACHIEVEMENTS;
  var AUDIO = window.__AUDIO__ || { sfx: function () {}, startMusic: function () {}, unlock: function () {}, toggleMusic: function () { return false; }, toggleSfx: function () { return false; }, isMusicOn: function () { return false; }, isSfxOn: function () { return false; } };
  var reduceMotion = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;

  function safe(fn, name) { try { fn(); } catch (e) { if (window.console) console.warn("[" + name + "]", e); } }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function pad6(n) { return String(Math.max(0, Math.floor(n))).padStart(6, "0"); }

  /* =========================================================
     NIVELES, VISTAS DEL CEREBRO Y CÁMARAS
     ========================================================= */
  var STEPS = [
    { id: "overview", title: "INICIO" },
    { id: "reptilian", title: "INSTINTO", c: COLORS.reptilian },
    { id: "limbic", title: "EMOCIÓN", c: COLORS.limbic },
    { id: "cortex", title: "RAZÓN", c: COLORS.cortex },
    { id: "pulse", title: "LA SEÑAL" },
    { id: "quiz", title: "¿QUIÉN DECIDIÓ?" },
    { id: "shadow", title: "LA SOMBRA" },
    { id: "observer", title: "OBSERVADOR" },
    { id: "science", title: "FINAL" }
  ];
  function L(c, cg, l, lg, r, rg, open) { return { cortex: { op: c, glow: cg }, limbic: { op: l, glow: lg }, reptilian: { op: r, glow: rg }, open: open }; }
  var LOOKS = {
    overview: L(1, 0, 1, 0, 1, 0, 0),
    reptilian: L(0.16, 0, 0.25, 0, 1, 0.75, 0.15),
    limbic: L(0.12, 0, 1, 0.7, 0.3, 0, 0.55),
    cortex: L(1, 0.55, 1, 0, 0.45, 0, 0),
    pulse: L(0.15, 0, 0.75, 0, 0.75, 0, 0.2),
    quiz: L(1, 0, 1, 0, 1, 0, 0),
    shadow: L(0.18, 0, 1, 0.5, 1, 0.4, 0.35),
    observer: L(0.45, 0.1, 1, 0.9, 0.45, 0, 0.3),
    science: L(1, 0, 1, 0, 1, 0, 0),
    free: L(1, 0, 1, 0, 1, 0, 0)
  };
  var CAMS = {
    overview: { pos: [-4.3, 1.0, 2.4], target: [0, -0.35, 0] },
    reptilian: { pos: [-3.1, -0.35, -2.7], target: [0, -0.75, -0.45] },
    limbic: { pos: [-3.5, 1.5, 2.1], target: [0, -0.2, 0] },
    cortex: { pos: [-3.0, 2.3, 2.4], target: [0, 0.05, 0.05] },
    pulse: { pos: [-4.4, 0.15, 0.25], target: [0, -0.45, 0] },
    quiz: { pos: [-3.6, 1.6, -2.6], target: [0, -0.3, 0] },
    shadow: { pos: [3.4, 0.4, 2.6], target: [0, -0.5, -0.1] },
    observer: { pos: [-1.0, 0.7, 4.3], target: [0, -0.15, 0] },
    science: { pos: [-4.6, 0.6, 1.6], target: [0, -0.35, 0] }
  };

  /* =========================================================
     ESTADO DEL JUEGO: puntos, logros
     ========================================================= */
  var game = { score: 0, hi: 0, ach: {}, visited: {}, touched: {} };
  try { game.hi = parseInt(localStorage.getItem("brain.hi") || "0", 10) || 0; } catch (e) {}

  function renderHUD(bump) {
    var s = $("#score"), h = $("#hiscore"), a = $("#hud-ach");
    if (s) { s.textContent = pad6(game.score); if (bump) { s.classList.remove("bump"); void s.offsetWidth; s.classList.add("bump"); } }
    if (h) h.textContent = pad6(game.hi);
    if (a) a.textContent = "★ " + Object.keys(game.ach).length + "/" + Object.keys(ACH).length;
  }
  function addScore(n) {
    game.score += n;
    if (game.score > game.hi) { game.hi = game.score; try { localStorage.setItem("brain.hi", String(game.hi)); } catch (e) {} }
    renderHUD(true);
  }
  function toast(title, sub, pts) {
    var box = $("#toasts"); if (!box) return;
    var t = document.createElement("div");
    t.className = "toast";
    t.innerHTML = "<em>" + title + "</em>" + (pts ? "<strong>+" + pts + "</strong>" : "") + sub;
    box.appendChild(t);
    setTimeout(function () { t.remove(); }, 3800);
  }
  function unlock(id) {
    if (!ACH[id] || game.ach[id]) return;
    game.ach[id] = true;
    addScore(ACH[id][1]);
    toast("★ LOGRO DESBLOQUEADO", ACH[id][0], ACH[id][1]);
    AUDIO.sfx("power");
    markDock();
  }

  /* =========================================================
     ARRANQUE (pantalla de carga)
     ========================================================= */
  var bootDone = false;
  function hideBoot() {
    if (bootDone) return; bootDone = true;
    var b = $("#boot"); if (b) b.classList.add("is-out");
  }
  function initBoot() {
    var n = $("#boot-neurons"), bar = $("#boot-bar"), t0 = performance.now();
    (function tick() {
      if (bootDone) return;
      var p = Math.min(1, (performance.now() - t0) / 1400);
      if (n) n.textContent = "CARGANDO NEURONAS: " + Math.floor(p * 86000000000).toLocaleString("es");
      if (bar) bar.style.width = (p * 100) + "%";
      requestAnimationFrame(tick);
    })();
    setTimeout(hideBoot, 4000);   // red de seguridad extra
  }

  /* =========================================================
     JUEGO 3D
     ========================================================= */
  var api = null, app, panel, body, dock, labelsEl, tooltip;
  var stepIndex = -1, currentId = "overview", pulseTimer = null, observerCalm = true, countdownTimer = null;

  function initGame() {
    app = $("#brain-app"); panel = $("#panel"); body = $("#panel-body"); dock = $("#dock"); labelsEl = $("#labels"); tooltip = $("#tooltip");

    if (!window.THREE || !window.__BRAIN3D__) throw new Error("Three.js no cargó");
    try {
      api = window.__BRAIN3D__.init({
        app: app, canvas: $("#scene"), colors: COLORS, cams: CAMS, reduceMotion: reduceMotion,
        wheelZoom: function () { return false; }
      });
    } catch (e) {
      $("#fallback").style.display = "grid"; hideBoot();
      throw e;
    }

    api.setShiftFn(function () {
      if (!app.classList.contains("panel-open")) return { x: 0, y: 0 };
      if (app.clientWidth <= 760) return { x: 0, y: panel.offsetHeight * 0.5 };
      return { x: (panel.offsetWidth + 18) / 2, y: 0 };
    });

    buildLabels();
    buildDock();
    bindTools();
    bindPanelNav();
    bindIntro();

    api.onHover(function (info, ev) {
      var cv = $("#scene");
      cv.classList.toggle("hovering", !!info);
      if (!info) { tooltip.classList.remove("show"); return; }
      var names = PART_NAMES[info.part], reg = REGIONS[info.region];
      tooltip.innerHTML = '<b style="color:' + COLORS[info.region] + '">' + names[0].toUpperCase() + "</b>" + names[1] + "<br><small>" + reg.tag + " · clic para explorar</small>";
      var r = app.getBoundingClientRect();
      tooltip.style.left = (ev.clientX - r.left) + "px"; tooltip.style.top = (ev.clientY - r.top) + "px";
      tooltip.classList.add("show");
    });
    api.onPick(function (info) {
      AUDIO.sfx("select");
      touchPart(info.part);
      goTo(indexOf(info.region));
    });
    api.onFrame(function (dt, t) {
      if (currentId === "observer" && !observerCalm) api.flashPart("amygdala", 0.55 + 0.45 * Math.sin(t * 6));
      updateLabels();
    });

    // Construir el cerebro después de pintar la pantalla de carga
    requestAnimationFrame(function () {
      setTimeout(function () {
        safe(function () { api.build(); }, "build");
        hideBoot();
        labelsEl.classList.add("hidden");
        api.flyTo("overview", 2.6);
        // Enlace directo a un nivel: index.html#nivel-3
        var m = (location.hash || "").match(/^#nivel-(\d+)/);
        if (m) goTo(Math.min(STEPS.length, Math.max(1, parseInt(m[1], 10))) - 1);
        if (/[?&]holo\b/.test(location.search)) { api.setMode(1); $("#t-mode").textContent = "REAL"; $("#t-mode").setAttribute("aria-pressed", "true"); }
      }, 60);
    });
  }

  function indexOf(id) { for (var i = 0; i < STEPS.length; i++) if (STEPS[i].id === id) return i; return 0; }

  function touchPart(part) {
    if (game.touched[part]) return;
    game.touched[part] = true;
    addScore(25);
    if (Object.keys(game.touched).length >= 5) unlock("anatomist");
  }

  /* ---------- Etiquetas que siguen al modelo ---------- */
  var labelEls = {};
  function buildLabels() {
    if (labelsEl.children.length > 0) return;
    ["cortex", "limbic", "reptilian"].forEach(function (k) {
      var b = document.createElement("button");
      b.className = "label"; b.style.setProperty("--c", COLORS[k]);
      b.innerHTML = "<i></i><span><b>" + REGIONS[k].tag.toUpperCase() + "</b>" + REGIONS[k].name + "</span>";
      b.addEventListener("click", function () { AUDIO.sfx("select"); goTo(indexOf(k)); });
      b.addEventListener("mouseover", function (e) { if (!b.contains(e.relatedTarget)) AUDIO.sfx("blip"); });
      labelsEl.appendChild(b); labelEls[k] = b;
    });
  }
  function updateLabels() {
    if (labelsEl.classList.contains("hidden")) return;
    for (var k in labelEls) {
      var p = api.projectAnchor(k); if (!p) continue;
      labelEls[k].style.transform = "translate(" + (p.x - 5) + "px," + (p.y - 5) + "px)";
      labelEls[k].style.visibility = p.visible ? "visible" : "hidden";
    }
  }

  /* ---------- Dock de niveles ---------- */
  function buildDock() {
    if (dock.children.length > 0) return;
    STEPS.forEach(function (s, i) {
      var b = document.createElement("button");
      b.innerHTML = (s.c ? '<i style="--c:' + s.c + '"></i>' : "") + (i + 1) + "·" + s.title;
      b.addEventListener("click", function () { AUDIO.sfx("select"); goTo(i); });
      dock.appendChild(b);
    });
    $("#dots").innerHTML = STEPS.map(function () { return "<i></i>"; }).join("");
  }
  function markDock() {
    STEPS.forEach(function (s, i) {
      var done = !!game.visited[s.id] && (!ACH[s.id] || game.ach[s.id]);
      if (dock.children[i]) dock.children[i].classList.toggle("done", done);
      var d = $("#dots").children[i]; if (d) d.classList.toggle("done", done);
    });
  }

  /* ---------- Herramientas ---------- */
  function bindTools() {
    var mBtn = $("#t-music"), sBtn = $("#t-sfx"), modeBtn = $("#t-mode"), xBtn = $("#t-xray");
    var sync = function () {
      mBtn.setAttribute("aria-pressed", AUDIO.isMusicOn() ? "true" : "false");
      sBtn.setAttribute("aria-pressed", AUDIO.isSfxOn() ? "true" : "false");
      var ip = $("#intro-sound");
      if (ip) { ip.setAttribute("aria-pressed", AUDIO.isMusicOn() ? "true" : "false"); ip.querySelector("b").textContent = AUDIO.isMusicOn() ? "SÍ" : "NO"; }
    };
    sync();
    mBtn.addEventListener("click", function () { AUDIO.toggleMusic(); sync(); AUDIO.sfx("blip"); });
    sBtn.addEventListener("click", function () { AUDIO.toggleSfx(); sync(); AUDIO.sfx("blip"); });
    $("#intro-sound").addEventListener("click", function () { AUDIO.unlock(); AUDIO.toggleMusic(); sync(); AUDIO.sfx("blip"); });

    modeBtn.addEventListener("click", function () {
      var holo = api.getMode() < 0.5;
      api.setMode(holo ? 1 : 0);
      modeBtn.setAttribute("aria-pressed", holo ? "true" : "false");
      modeBtn.textContent = holo ? "REAL" : "HOLO";
      AUDIO.sfx(holo ? "zap" : "blip");
    });
    var xLevels = [0, 0.5, 1], xi = 0;
    xBtn.addEventListener("click", function () {
      xi = (xi + 1) % xLevels.length;
      api.setXray(xLevels[xi]);
      if (xi === 0) api.setLook(LOOKS[stepIndex >= 0 ? STEPS[stepIndex].id : "free"]);
      xBtn.setAttribute("data-level", String(xi));
      xBtn.setAttribute("aria-pressed", xi > 0 ? "true" : "false");
      AUDIO.sfx("blip");
    });
    $("#t-zin").addEventListener("click", function () { api.zoomBy(0.8); AUDIO.sfx("blip"); });
    $("#t-zout").addEventListener("click", function () { api.zoomBy(1.25); AUDIO.sfx("blip"); });
  }

  /* =========================================================
     PANEL: CONTENIDO DE CADA NIVEL
     ========================================================= */
  function regionHTML(k) {
    var R = REGIONS[k], n = indexOf(k) + 1;
    return '<p class="kicker">NIVEL ' + n + " · " + R.name + " · " + R.tag + "</p>" +
      "<h2>" + R.motto + "</h2>" +
      '<div class="facts"><div><span>DÓNDE</span>' + R.where + '</div><div><span>EDAD EVOLUTIVA*</span>' + R.age + "</div></div>" +
      R.body.map(function (p) { return "<p>" + p + "</p>"; }).join("") +
      '<ul class="chips">' + R.functions.map(function (f) { return "<li>" + f + "</li>"; }).join("") + "</ul>" +
      (R.parts ? '<div class="parts">' + R.parts.map(function (p) { return '<button class="part" data-part="' + p[0] + '"><i></i><span><b>' + p[1] + "</b><small>" + p[2] + "</small></span></button>"; }).join("") + "</div>" : "") +
      '<div class="fact"><b>DETENTE UN SEGUNDO</b>' + R.fact + "</div>" +
      '<div class="question"><span>PREGÚNTATE</span>' + R.question + "</div>" +
      '<p class="footnote">* Según el modelo del “cerebro triuno” de Paul MacLean. En el nivel final verás qué dice hoy la ciencia.</p>';
  }

  var VIEWS = {
    overview: function () {
      return {
        html:
          '<p class="kicker">NIVEL 1 · EMPIEZA AQUÍ</p>' +
          "<h2>Esto eres tú.<br><em>¿O no?</em></h2>" +
          "<p>Pesa cerca de <b>1,4 kg</b>, tiene unos <b>86.000 millones de neuronas</b> y consume alrededor del <b>20 % de tu energía</b>. Piensa, siente, recuerda y decide.</p>" +
          "<p>Y casi todo lo hace <b>sin avisarte</b>.</p>" +
          '<div class="meter"><div class="meter-bar"><div class="meter-fill" id="mfill"></div><span>PILOTO AUTOMÁTICO</span><span class="r">CONSCIENTE</span></div>' +
          '<div class="meter-legend"><span>Instinto + emoción · 85–95 %</span><span>Razón · 5–15 %</span></div></div>' +
          '<p class="small">Los esquemas populares dicen que entre el 85 % y el 95 % de tus decisiones no son conscientes. Nadie lo ha medido con exactitud, pero la idea de fondo se sostiene: <b>la mayor parte de tu vida ocurre en piloto automático</b>.</p>' +
          "<p>Según el modelo del <b>cerebro triuno</b>, dentro de ti conviven tres jugadores. Elige uno:</p>" +
          '<div class="trio">' + ["reptilian", "limbic", "cortex"].map(function (k) {
            return '<button data-go="' + k + '" style="--c:' + COLORS[k] + '"><b>' + REGIONS[k].tag.toUpperCase() + "</b><small>" + REGIONS[k].name + "<br>" + REGIONS[k].age.replace(" (forma humana)", "") + "</small></button>";
          }).join("") + "</div>" +
          '<div class="question"><span>ANTES DE SEGUIR</span>Si tuvieras que adivinar: ¿cuál de los tres tomó tu última decisión?</div>',
        mount: function () { requestAnimationFrame(function () { var f = $("#mfill"); if (f) f.style.width = "88%"; }); }
      };
    },
    reptilian: function () { return { html: regionHTML("reptilian"), c: COLORS.reptilian, mount: function () { unlock("reptilian"); } }; },
    limbic: function () { return { html: regionHTML("limbic"), c: COLORS.limbic, mount: function () { unlock("limbic"); } }; },
    cortex: function () { return { html: regionHTML("cortex"), c: COLORS.cortex, mount: function () { unlock("cortex"); } }; },

    pulse: function () {
      return {
        html:
          '<p class="kicker">NIVEL 5 · CÓMO DECIDES</p>' +
          "<h2>La razón llega <em>tarde</em></h2>" +
          "<p>Imagina un ruido fuerte a tu espalda. Mira el recorrido de la señal dentro de tu cerebro.</p>" +
          '<ol class="timeline" id="tl">' +
          '<li style="--c:#fff"><b>0 MS · ESTÍMULO</b>Un ruido fuerte detrás de ti.</li>' +
          '<li style="--c:' + COLORS.reptilian + '"><b>≈20 MS · TRONCO ENCEFÁLICO</b>El cuerpo se tensa y el corazón se acelera.</li>' +
          '<li style="--c:' + COLORS.limbic + '"><b>≈100 MS · AMÍGDALA</b>“¡Peligro!” Ya saltaste.</li>' +
          '<li style="--c:' + COLORS.cortex + '"><b>≈300–500 MS · CORTEZA</b>Te das cuenta de lo que pasó… y te lo explicas.</li>' +
          "</ol>" +
          '<div class="conclusion hidden" id="concl">' +
          "<p>En las situaciones rápidas primero reacciona el cuerpo, luego la emoción y al final la razón. Muchas veces la razón no decide: <b>explica lo que ya pasó</b>.</p>" +
          '<div class="question" style="--c:' + COLORS.cortex + '"><span>PREGÚNTATE</span>¿Cuántas de tus “decisiones” son explicaciones que llegaron después?</div>' +
          "</div>" +
          '<div class="row"><button class="btn ghost" id="replay">▶ VER OTRA VEZ</button></div>' +
          '<p class="footnote">Los tiempos son aproximados y varían entre personas y situaciones.</p>',
        mount: function () {
          var run = function () {
            var lis = $$("#tl li", body);
            lis.forEach(function (li) { li.classList.remove("on"); });
            $("#concl").classList.add("hidden");
            AUDIO.sfx("zap");
            api.startPulse(function (i) { if (lis[i]) lis[i].classList.add("on"); if (i > 0) AUDIO.sfx("tick"); },
              function () { var c = $("#concl"); if (c) c.classList.remove("hidden"); unlock("pulse"); });
          };
          $("#replay").addEventListener("click", run);
          pulseTimer = setTimeout(run, reduceMotion ? 100 : 1500);
        }
      };
    },

    quiz: function () {
      return {
        html:
          '<p class="kicker">NIVEL 6 · UN ESPEJO, NO UN EXAMEN</p>' +
          "<h2>¿Quién decidió <em>hoy</em>?</h2>" +
          "<p>Piensa en tu día. Para cada situación, elige quién crees que estaba al volante. No hay respuestas correctas.</p>" +
          '<div id="quiz"></div>',
        mount: function () { mountQuiz($("#quiz")); }
      };
    },

    shadow: function () {
      return {
        html:
          '<p class="kicker">NIVEL 7 · JEFE FINAL</p>' +
          "<h2>Lo que rechazas <em>también eres tú</em></h2>" +
          "<p><b>Carl Jung</b> llamó Sombra a los impulsos que rechazamos de nosotros mismos. Biológicamente, muchos nacen en el <b>tronco encefálico</b> y el <b>sistema límbico</b>.</p>" +
          '<div class="fact" style="--c:' + COLORS.limbic + '"><b>CIRCUITO DE RECOMPENSA</b>Con estrés o cansancio, tu cerebro busca un pico rápido de dopamina: las pantallas, el azúcar, una compra. Cualquier atajo.</div>' +
          "<p><b>Llega un impulso.</b> ¿Qué haces?</p>" +
          '<div class="gauges">' +
          '<div class="gauge" style="--c:' + "#ff4d6d" + '">ESTRÉS · AMÍGDALA<div><i id="g-stress"></i></div></div>' +
          '<div class="gauge" style="--c:' + COLORS.cortex + '">VOLUNTAD<div><i id="g-will"></i></div></div>' +
          "</div>" +
          '<div class="row"><button class="btn danger" id="sh-fight">⚔ PELEAR</button><button class="btn" id="sh-observe">◉ OBSERVAR</button></div>' +
          '<p class="sh-msg" id="sh-msg">Elige y mira qué pasa en tu cerebro.</p>' +
          '<div class="question"><span>PREGÚNTATE</span>¿Qué impulso tuyo estás peleando en lugar de escuchar?</div>',
        mount: function () {
          var stress = 45, will = 55, obs = 0, fi = 0, oi = 0;
          var FIGHT = ["Pelear contra el impulso activa la alarma: más estrés.", "La amígdala se enciende y tu voluntad se agota. Irónico, ¿no?", "Cuanto más lo combates, más fuerte vuelve."];
          var OBS = ["«Siento este impulso porque mi cuerpo busca alivio, no porque yo sea débil.»", "Al nombrarlo, la energía sube del tronco encefálico a la corteza prefrontal.", "No lo obedeces ni lo combates: lo miras pasar."];
          var draw = function () { $("#g-stress").style.width = stress + "%"; $("#g-will").style.width = will + "%"; };
          draw();
          $("#sh-fight").addEventListener("click", function () {
            stress = Math.min(100, stress + 20); will = Math.max(0, will - 18);
            api.flashPart("amygdala", 1.9); api.flashRegion("reptilian", 1.2);
            api.setLook(L(0.18, 0, 1, 0.9, 1, 0.8, 0.35));
            $("#sh-msg").textContent = FIGHT[fi++ % FIGHT.length];
            AUDIO.sfx("buzz"); draw();
          });
          $("#sh-observe").addEventListener("click", function () {
            stress = Math.max(0, stress - 18); will = Math.min(100, will + 15); obs++;
            api.flashRegion("cortex", 1.2);
            api.setLook(L(0.55, 0.7, 1, 0.15, 1, 0, 0.35));
            $("#sh-msg").textContent = OBS[oi++ % OBS.length];
            AUDIO.sfx("calm"); draw();
            if (obs >= 3) unlock("shadow");
          });
        }
      };
    },

    observer: function () {
      return {
        html:
          '<p class="kicker">NIVEL 8 · EL OBSERVADOR</p>' +
          "<h2>No eres tus pensamientos. <em>Eres quien los observa.</em></h2>" +
          '<p class="quote">“Entre el estímulo y la respuesta hay un espacio. En ese espacio reside nuestra libertad.”</p>' +
          '<p class="quote-by">— IDEA ATRIBUIDA A VIKTOR FRANKL</p>' +
          "<p>Ese espacio se ensancha cuando dejas de ser el <b>soldado</b> que pelea contra lo que siente y te vuelves el <b>científico</b> que observa. Pruébalo ahora:</p>" +
          "<p><b>¿Qué sientes en este momento?</b> Nómbralo.</p>" +
          '<div class="emos" id="emos">' + EMOTIONS.map(function (e) { return '<button data-e="' + e + '">' + e.charAt(0).toUpperCase() + e.slice(1) + "</button>"; }).join("") + "</div>" +
          '<div class="reveal-box" id="rev1">' +
          '<div class="fact" style="--c:' + COLORS.cortex + '"><b>ETIQUETADO AFECTIVO</b>Mira la amígdala: se calma. Ponerle nombre a una emoción se asocia con menos actividad en la amígdala y más en la corteza prefrontal (Lieberman y col., UCLA, 2007).</div>' +
          "<p><b>Ahora, el tercer observador.</b> Escribe tu nombre:</p>" +
          '<input class="name-input" id="nm" placeholder="Tu nombre" maxlength="30" autocomplete="off" />' +
          '<div class="mirror" id="mirror"></div>' +
          '<p class="small">Léelo otra vez. ¿Notas la distancia? Ese impulso es un evento biológico pasajero, no una orden que debas obedecer.</p>' +
          '<ol class="steps3">' +
          "<li><b>Nombra</b> la sensación en lugar de luchar contra ella.</li>" +
          "<li><b>Háblate en tercera persona</b> para crear distancia.</li>" +
          "<li><b>Cambia la prohibición por curiosidad:</b> de “no debo hacer esto” a “¿qué está intentando decirme mi cuerpo?”.</li>" +
          "</ol></div>",
        mount: function () {
          observerCalm = false;
          var emo = "", named = false;
          var nm = $("#nm"), mirror = $("#mirror");
          var write = function () { mirror.textContent = "«" + (nm.value.trim() || "Tú") + " está sintiendo " + emo + " ahora mismo.»"; };
          $$("#emos button", body).forEach(function (b) {
            b.addEventListener("click", function () {
              $$("#emos button", body).forEach(function (x) { x.classList.remove("sel"); });
              b.classList.add("sel"); emo = b.getAttribute("data-e");
              observerCalm = true;
              api.setLook({ cortex: { op: 0.55, glow: 0.75 }, limbic: { op: 1, glow: 0.1 }, reptilian: { op: 0.45, glow: 0 }, open: 0.3 });
              api.flashRegion("cortex", 0.8);
              AUDIO.sfx("calm");
              $("#rev1").classList.add("show"); write();
            });
          });
          nm.addEventListener("input", function () {
            write();
            if (!named && nm.value.trim().length >= 2) { named = true; unlock("observer"); }
          });
        }
      };
    },

    science: function () {
      return {
        html:
          '<p class="kicker">NIVEL 9 · LO QUE LA CIENCIA SABE HOY</p>' +
          "<h2>Incluso el mapa <em>es incompleto</em></h2>" +
          '<div class="truths">' +
          "<div><b>EL “CEREBRO TRIUNO” ES UNA METÁFORA</b>La neurociencia actual muestra que estas tres “capas” evolucionaron juntas y trabajan en red, todo el tiempo. Aun así, la metáfora sirve para observarte.</div>" +
          "<div><b>EMOCIÓN Y RAZÓN NO COMPITEN</b>Personas con daño en zonas emocionales pueden razonar perfectamente… y aun así no logran decidir (Antonio Damasio).</div>" +
          "<div><b>TU CEREBRO CAMBIA A CADA SEGUNDO</b>Se llama neuroplasticidad: lo que repites se fortalece, lo que dejas de usar se debilita. No estás terminado.</div>" +
          "<div><b>EL 85 % O EL 95 % SON APROXIMACIONES</b>Lo que sí está claro es que la mayor parte de tu procesamiento ocurre fuera de tu conciencia.</div>" +
          "</div>" +
          '<div class="continue" id="cont"><p class="ct">¿CONTINUAR?</p><p class="cn" id="cn">9</p><button class="btn" id="cont-yes">SÍ, SEGUIR MIRÁNDOME</button></div>' +
          '<div class="final-msg reveal-box" id="final"><h3>No hay game over.<br><em>Conocerse es no dejar de mirar.</em></h3></div>',
        mount: function () {
          var n = 9, cn = $("#cn");
          clearInterval(countdownTimer);
          countdownTimer = setInterval(function () {
            n--; if (!cn || !document.body.contains(cn)) { clearInterval(countdownTimer); return; }
            if (n >= 0) { cn.textContent = n; AUDIO.sfx("tick"); }
            if (n <= 0) {
              clearInterval(countdownTimer);
              cn.textContent = "0";
              $(".ct", body).textContent = "GAME OVER… ES BROMA";
              $("#cont-yes").textContent = "AQUÍ NADIE PIERDE · SEGUIR";
            }
          }, 1000);
          $("#cont-yes").addEventListener("click", function () {
            clearInterval(countdownTimer);
            $("#cont").style.display = "none";
            $("#final").classList.add("show");
            AUDIO.sfx("coin");
            api.flashRegion("cortex", 1.2); api.flashRegion("limbic", 1.2); api.flashRegion("reptilian", 1.2);
            unlock("final");
          });
        }
      };
    }
  };

  function mountQuiz(root) {
    var i = 0, counts = { reptilian: 0, limbic: 0, cortex: 0 };
    var render = function () {
      if (i < QUIZ.length) {
        root.innerHTML =
          '<div class="q-progress">' + (i + 1) + " / " + QUIZ.length + '<i style="--p:' + (i / QUIZ.length) * 100 + '%"></i></div>' +
          '<p class="q-text">' + QUIZ[i] + "</p>" +
          '<div class="q-opts">' + ["reptilian", "limbic", "cortex"].map(function (k) {
            return '<button class="q-opt" data-k="' + k + '" style="--c:' + COLORS[k] + '"><b>' + REGIONS[k].tag.toUpperCase() + "</b><small>" + REGIONS[k].short + "</small></button>";
          }).join("") + "</div>";
        $$(".q-opt", root).forEach(function (b) {
          b.addEventListener("click", function () {
            var k = b.getAttribute("data-k");
            counts[k]++; api.flashRegion(k, 1.3); AUDIO.sfx("select"); addScore(10); i++; render();
          });
        });
        return;
      }
      var total = QUIZ.length;
      var top = Object.keys(counts).sort(function (a, b) { return counts[b] - counts[a]; })[0];
      var msg = {
        reptilian: "Buena parte de tu día la manejó el piloto automático: hábitos, reflejos, impulsos. No es un defecto, es eficiencia. Pero lo que no ves, no lo puedes elegir.",
        limbic: "Tus emociones tuvieron el volante buena parte del día. No son el enemigo: son información. La pregunta es si las escuchas… o solo las obedeces.",
        cortex: "La razón aparece como protagonista… o al menos eso dice ella. Recuerda el recorrido de la señal: a veces la razón llega después, a explicarlo todo."
      }[top];
      root.innerHTML =
        '<div class="bars">' + ["reptilian", "limbic", "cortex"].map(function (k) {
          return '<div class="bar-row" style="--c:' + COLORS[k] + '">' + REGIONS[k].tag.toUpperCase() + " · " + counts[k] + " DE " + total + '<div><i data-w="' + (counts[k] / total) * 100 + '"></i></div></div>';
        }).join("") + "</div>" +
        "<p>" + msg + "</p>" +
        '<div class="question" style="--c:' + COLORS[top] + '"><span>PREGÚNTATE</span>Si mañana observaras tu día con esta misma atención, ¿qué crees que descubrirías?</div>' +
        '<div class="row"><button class="btn ghost" id="qagain">↺ REPETIR</button></div>';
      requestAnimationFrame(function () { $$(".bar-row i", root).forEach(function (el) { el.style.width = el.getAttribute("data-w") + "%"; }); });
      api.setLook({ cortex: { op: 1, glow: counts.cortex / total }, limbic: { op: 1, glow: counts.limbic / total }, reptilian: { op: 1, glow: counts.reptilian / total }, open: counts.limbic > 0 ? 0.25 : 0 });
      unlock("quiz");
      $("#qagain").addEventListener("click", function () { i = 0; counts.reptilian = counts.limbic = counts.cortex = 0; api.setLook(LOOKS.quiz); render(); });
    };
    render();
  }

  /* ---------- Navegación entre niveles ---------- */
  function goTo(i) {
    if (!api || i < 0 || i >= STEPS.length) return;
    stepIndex = i;
    var s = STEPS[i];
    currentId = s.id;
    clearTimeout(pulseTimer); clearInterval(countdownTimer); api.stopPulse(); observerCalm = true;

    $("#intro").classList.add("gone");
    var v = VIEWS[s.id]();
    panel.style.setProperty("--c", v.c || COLORS.cortex);
    body.innerHTML = v.html;
    body.scrollTop = 0;
    $("#panel-step").textContent = "NIVEL " + (i + 1) + " DE " + STEPS.length;
    $("#hud-level").textContent = "NIVEL " + (i + 1) + "-" + STEPS.length;
    $$("#dots i").forEach(function (d, j) { d.classList.toggle("on", j === i); });
    Array.prototype.forEach.call(dock.children, function (d, j) { d.classList.toggle("active", j === i); });
    if (dock.children[i] && dock.scrollTo) {
      var b = dock.children[i];
      dock.scrollTo({ left: b.offsetLeft - dock.clientWidth / 2 + b.offsetWidth / 2, behavior: "smooth" });
    }
    $("#prev").disabled = i === 0;
    $("#next").textContent = i === STEPS.length - 1 ? "↺ JUGAR OTRA VEZ" : STEPS[i + 1].title + " ▶";

    $$("[data-go]", body).forEach(function (b) {
      b.addEventListener("click", function () { AUDIO.sfx("select"); goTo(indexOf(b.getAttribute("data-go"))); });
    });
    $$(".part", body).forEach(function (b) {
      b.style.setProperty("--c", COLORS.limbic);
      b.addEventListener("mouseover", function (e) { if (!b.contains(e.relatedTarget)) { api.flashPart(b.getAttribute("data-part"), 1.4); AUDIO.sfx("blip"); } });
      b.addEventListener("click", function () { var p = b.getAttribute("data-part"); api.flashPart(p, 1.8); touchPart(p); AUDIO.sfx("select"); });
    });

    app.classList.add("panel-open");
    labelsEl.classList.toggle("hidden", s.id !== "overview");
    $("#hint").classList.add("hidden");
    api.setLook(LOOKS[s.id]);
    api.setAutoRotate(["overview", "quiz", "science"].indexOf(s.id) >= 0);
    api.flyTo(s.id);

    if (!game.visited[s.id]) { game.visited[s.id] = true; addScore(100); }
    markDock();
    if (v.mount) safe(v.mount, "mount:" + s.id);
  }

  function closePanel() {
    if (!api) return;
    clearTimeout(pulseTimer); clearInterval(countdownTimer); api.stopPulse();
    stepIndex = -1; currentId = "free"; observerCalm = true;
    app.classList.remove("panel-open");
    Array.prototype.forEach.call(dock.children, function (d) { d.classList.remove("active"); });
    $("#hud-level").textContent = "MODO LIBRE";
    labelsEl.classList.remove("hidden");
    $("#hint").classList.remove("hidden");
    api.setLook(LOOKS.free);
    api.setAutoRotate(true);
    api.flyTo("overview");
  }

  function bindPanelNav() {
    $("#panel-close").addEventListener("click", function () { AUDIO.sfx("back"); closePanel(); });
    $("#prev").addEventListener("click", function () { AUDIO.sfx("back"); goTo(stepIndex - 1); });
    $("#next").addEventListener("click", function () { AUDIO.sfx("select"); goTo(stepIndex === STEPS.length - 1 ? 0 : stepIndex + 1); });
    document.addEventListener("keydown", function (e) {
      var tag = e.target && e.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      var r = app.getBoundingClientRect();
      if (r.bottom < window.innerHeight * 0.5 || r.top > window.innerHeight * 0.5) return;   // solo si el juego está en pantalla
      if (e.key === "Escape" && stepIndex >= 0) closePanel();
      if (stepIndex >= 0 && e.key === "ArrowRight") { AUDIO.sfx("select"); goTo(Math.min(STEPS.length - 1, stepIndex + 1)); }
      if (stepIndex >= 0 && e.key === "ArrowLeft") { AUDIO.sfx("back"); goTo(Math.max(0, stepIndex - 1)); }
    });
  }

  function bindIntro() {
    var begin = function (free) {
      AUDIO.unlock();
      AUDIO.sfx("coin");
      AUDIO.startMusic();
      $("#intro").classList.add("gone");
      if (free) closePanel(); else goTo(0);
    };
    $("#start").addEventListener("click", function () { begin(false); });
    $("#free").addEventListener("click", function () { begin(true); });
    $("#start").addEventListener("mouseover", function (e) { if (!e.currentTarget.contains(e.relatedTarget)) AUDIO.sfx("blip"); });
  }

  /* =========================================================
     MANUAL: revelado, contadores, sprites, ¿continuar?
     ========================================================= */
  function initReveal() {
    var els = $$("[data-reveal]");
    if (!("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-revealed"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add("is-revealed"); io.unobserve(e.target); countUp(e.target); }
      });
    }, { threshold: 0.01, rootMargin: "0px 0px -4% 0px" });
    els.forEach(function (el) { io.observe(el); });
    setTimeout(function () {
      $$("[data-reveal]:not(.is-revealed)").forEach(function (el) { if (el.getBoundingClientRect().top < window.innerHeight) { el.classList.add("is-revealed"); countUp(el); } });
    }, 6000);
  }

  function countUp(root) {
    $$("[data-count]", root).forEach(function (el) {
      if (el.getAttribute("data-counted")) return;
      el.setAttribute("data-counted", "1");
      var to = parseFloat(el.getAttribute("data-count")), dec = parseInt(el.getAttribute("data-dec") || "0", 10), suf = el.getAttribute("data-suffix") || "";
      var t0 = performance.now(), dur = 1200;
      (function step(now) {
        var p = Math.min(1, (now - t0) / dur), v = to * (1 - Math.pow(1 - p, 3));
        el.textContent = v.toFixed(dec).replace(".", ",") + suf;
        if (p < 1) requestAnimationFrame(step);
      })(t0);
    });
  }

  /* Sprite pixel de un cerebrito (decorativo) */
  var SPRITE = [
    "....######....",
    "..##..#...##..",
    ".#..#..#.#..#.",
    "#..#...#..#..#",
    "#.#..#.#.#...#",
    "#...#..#..#.##",
    ".#.#..##...#.#",
    "..###....###..",
    ".....#######..",
    ".......##....."
  ];
  function initSprites() {
    $$("[data-sprite]").forEach(function (el) {
      if (el.children.length > 0) return;
      var rects = "";
      SPRITE.forEach(function (row, y) {
        for (var x = 0; x < row.length; x++) if (row[x] === "#") rects += '<rect x="' + x + '" y="' + y + '" width="1" height="1"/>';
      });
      el.innerHTML = '<svg viewBox="0 0 14 10" shape-rendering="crispEdges" fill="currentColor" style="color:var(--c)" aria-hidden="true">' + rects + "</svg>";
    });
  }

  function initManualButtons() {
    $$("[data-play]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.getAttribute("data-play");
        AUDIO.unlock(); AUDIO.sfx("coin"); AUDIO.startMusic();
        window.scrollTo({ top: 0, behavior: "smooth" });
        setTimeout(function () { goTo(indexOf(id)); }, 350);
      });
    });
    var replay = $("#replay-top");
    if (replay) replay.addEventListener("click", function () {
      AUDIO.unlock(); AUDIO.sfx("coin"); AUDIO.startMusic();
      window.scrollTo({ top: 0, behavior: "smooth" });
      setTimeout(function () { goTo(0); }, 350);
    });
  }

  function initContinue() {
    var sec = $("#continue"), num = $("#cont-num");
    if (!sec || !num || !("IntersectionObserver" in window)) return;
    var timer = null;
    new IntersectionObserver(function (e) {
      if (e[0].isIntersecting && !timer) {
        var n = 9; num.textContent = n;
        timer = setInterval(function () {
          n--; num.textContent = Math.max(0, n);
          if (n <= 0) { clearInterval(timer); num.textContent = "∞"; }
        }, 900);
      }
    }, { threshold: 0.05 }).observe(sec);
  }

  function initVHS() {
    var el = $("#vhs-time"), t0 = Date.now();
    if (!el) return;
    setInterval(function () {
      if ($("#intro").classList.contains("gone")) return;
      var s = Math.floor((Date.now() - t0) / 1000);
      el.textContent = "SP 0:" + String(Math.floor(s / 60)).padStart(2, "0") + ":" + String(s % 60).padStart(2, "0");
    }, 1000);
  }

  /* =========================================================
     ARRANQUE
     ========================================================= */
  function boot() {
    renderHUD(false);
    safe(initBoot, "boot");
    safe(initGame, "game");
    safe(initReveal, "reveal");
    safe(initSprites, "sprites");
    safe(initManualButtons, "manual");
    safe(initContinue, "continue");
    safe(initVHS, "vhs");
    if (!api) hideBoot();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
