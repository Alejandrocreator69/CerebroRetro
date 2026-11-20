/* =========================================================
   CEREBRO 3D · escena, anatomía procedural y shader propio
   Expone window.__BRAIN3D__.init(opts) → api
   ========================================================= */
(function () {
  "use strict";
  var THREE = window.THREE;

  /* ---------- Ruido Perlin (determinista) ---------- */
  var P = new Uint8Array(512);
  (function () {
    var p = [], i, s = 1337;
    for (i = 0; i < 256; i++) p.push(i);
    var rnd = function () { return (s = (s * 16807) % 2147483647) / 2147483647; };
    for (i = 255; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var t = p[i]; p[i] = p[j]; p[j] = t; }
    for (i = 0; i < 512; i++) P[i] = p[i & 255];
  })();
  function fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a, b, t) { return a + t * (b - a); }
  function grad(h, x, y, z) { var u = h < 8 ? x : y, v = h < 4 ? y : (h === 12 || h === 14 ? x : z); return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); }
  function noise(x, y, z) {
    var X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
    x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
    var u = fade(x), v = fade(y), w = fade(z);
    var A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
    return lerp(lerp(lerp(grad(P[AA] & 15, x, y, z), grad(P[BA] & 15, x - 1, y, z), u),
                     lerp(grad(P[AB] & 15, x, y - 1, z), grad(P[BB] & 15, x - 1, y - 1, z), u), v),
                lerp(lerp(grad(P[AA + 1] & 15, x, y, z - 1), grad(P[BA + 1] & 15, x - 1, y, z - 1), u),
                     lerp(grad(P[AB + 1] & 15, x, y - 1, z - 1), grad(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
  }
  function smooth(a, b, x) { var t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); }

  /* Soldar vértices duplicados para normales suaves (sustituye a BufferGeometryUtils) */
  function mergeVerts(geo) {
    var p = geo.attributes.position.array, n = p.length / 3;
    var map = new Map(), verts = [], idx = new Uint32Array(n);
    for (var i = 0; i < n; i++) {
      var k = Math.round(p[i * 3] * 1e4) + "," + Math.round(p[i * 3 + 1] * 1e4) + "," + Math.round(p[i * 3 + 2] * 1e4);
      var j = map.get(k);
      if (j === undefined) { j = verts.length / 3; map.set(k, j); verts.push(p[i * 3], p[i * 3 + 1], p[i * 3 + 2]); }
      idx[i] = j;
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.dispose();
    return g;
  }
  function ensureAO(geo) {
    if (!geo.attributes.ao) {
      var a = new Float32Array(geo.attributes.position.count); a.fill(1);
      geo.setAttribute("ao", new THREE.BufferAttribute(a, 1));
    }
    return geo;
  }

  /* ---------- Shader: tejido realista + modo holograma ---------- */
  var VERT = [
    "attribute float ao;",
    "varying vec3 vN; varying vec3 vV; varying float vAO; varying vec3 vWP;",
    "void main(){",
    "  vec4 wp = modelMatrix * vec4(position,1.0);",
    "  vWP = wp.xyz;",
    "  vec4 mv = viewMatrix * wp;",
    "  vV = -mv.xyz;",
    "  vN = normalize(normalMatrix * normal);",
    "  vAO = ao;",
    "  gl_Position = projectionMatrix * mv;",
    "}"
  ].join("\n");

  var FRAG = [
    "uniform vec3 uTissue; uniform vec3 uRegion; uniform float uTint; uniform float uOpacity;",
    "uniform float uGlow; uniform float uMode; uniform float uTime; uniform float uHover;",
    "varying vec3 vN; varying vec3 vV; varying float vAO; varying vec3 vWP;",
    "void main(){",
    "  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;",
    "  vec3 V = normalize(vV);",
    "  float ao = vAO;",
    "  float ndv = max(dot(N,V),0.0);",
    "  float fres = pow(1.0-ndv, 2.6);",
    /* --- anatómico --- */
    "  vec3 base = mix(uTissue, uRegion, uTint);",
    "  base *= mix(vec3(0.42,0.16,0.2), vec3(1.0), smoothstep(0.1,0.95,ao));",   // surcos rojizos y oscuros
    "  vec3 L1 = normalize(vec3(-0.45,0.75,0.55));",
    "  vec3 L2 = normalize(vec3(0.75,-0.15,0.35));",
    "  float w = 0.45;",
    "  float d1 = max(0.0,(dot(N,L1)+w)/(1.0+w));",                              // luz envolvente (aspecto húmedo/subsuperficial)
    "  float d2 = max(0.0,dot(N,L2));",
    "  vec3 H = normalize(L1+V);",
    "  float spec = pow(max(dot(N,H),0.0),48.0)*0.32*ao;",
    "  vec3 col = base*(0.16 + d1*vec3(1.0,0.95,0.93) + d2*0.38*vec3(0.55,0.35,1.0));",
    "  col += spec;",
    "  col += fres*(vec3(1.0,0.17,0.68)*0.55 + uRegion*0.25);",                    // contraluz synthwave
    "  col += uRegion*uGlow*(0.45+0.8*fres);",
    "  col += uRegion*uHover*0.22;",
    /* --- holograma --- */
    "  float scan = 0.78+0.22*sin(vWP.y*90.0 - uTime*4.0);",
    "  float edge = clamp(fres*1.7 + (1.0-ao)*1.1, 0.0, 1.0);",
    "  vec3 holo = uRegion*(0.10 + edge*1.25)*scan + uRegion*uGlow*0.45 + uRegion*uHover*0.3;",
    "  vec3 c = mix(col, holo, uMode);",
    "  float a = uOpacity * mix(1.0, clamp(0.12 + edge*0.95 + uGlow*0.3, 0.0, 1.0), uMode);",
    "  gl_FragColor = vec4(c, a);",
    "  #include <tonemapping_fragment>",
    "  #include <colorspace_fragment>",
    "}"
  ].join("\n");

  /* ---------- Controles de órbita (propios, sin módulos) ---------- */
  function Orbit(camera, dom, opts) {
    var self = this;
    this.target = new THREE.Vector3();
    this.autoRotate = false; this.autoRotateSpeed = 0.55;
    this.minDistance = 2.2; this.maxDistance = 14; this.damping = 0.09;
    var dT = 0, dP = 0, zoom = 1, pointers = new Map(), pinch0 = 0, dragging = false, startFns = [];
    var sph = new THREE.Spherical(), off = new THREE.Vector3();
    this.onStart = function (fn) { startFns.push(fn); };
    this.zoomBy = function (f) { zoom *= f; };
    this.stop = function () { dT = dP = 0; zoom = 1; };
    this.isDragging = function () { return dragging; };
    function pinchDist() { var a = Array.from(pointers.values()); return Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); }
    function start() { if (!dragging) { dragging = true; startFns.forEach(function (f) { f(); }); } }

    dom.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY });
      if (pointers.size === 2) pinch0 = pinchDist();
    });
    window.addEventListener("pointermove", function (e) {
      var p = pointers.get(e.pointerId); if (!p) return;
      var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
      if (pointers.size === 1) {
        if (Math.hypot(p.x - p.sx, p.y - p.sy) > 4) start();
        if (!dragging) return;
        var h = dom.clientHeight || 600;
        dT -= 2 * Math.PI * dx / h * 0.9;
        dP -= 2 * Math.PI * dy / h * 0.9;
      } else if (pointers.size === 2) {
        start();
        var d = pinchDist();
        if (pinch0 > 0) zoom *= pinch0 / d;
        pinch0 = d;
      }
    });
    function up(e) { pointers.delete(e.pointerId); if (pointers.size === 0) dragging = false; if (pointers.size < 2) pinch0 = 0; }
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    dom.addEventListener("wheel", function (e) {
      if (!(e.ctrlKey || (opts.wheelZoom && opts.wheelZoom()))) return;
      e.preventDefault(); start(); dragging = false;
      zoom *= Math.pow(1.0018, e.deltaY * (e.ctrlKey ? 3 : 1));
    }, { passive: false });

    this.update = function (dt) {
      off.copy(camera.position).sub(self.target);
      sph.setFromVector3(off);
      if (self.autoRotate && !dragging) sph.theta += (2 * Math.PI / 60 / 60) * self.autoRotateSpeed * (dt * 60);
      var k = 1 - Math.pow(1 - self.damping, dt * 60);
      sph.theta += dT * k; sph.phi += dP * k; dT *= 1 - k; dP *= 1 - k;
      var zk = Math.pow(zoom, k); sph.radius *= zk; zoom /= zk;
      sph.phi = Math.max(0.12, Math.min(Math.PI - 0.12, sph.phi));
      sph.radius = Math.max(self.minDistance, Math.min(self.maxDistance, sph.radius));
      off.setFromSpherical(sph);
      camera.position.copy(self.target).add(off);
      camera.lookAt(self.target);
    };
  }

  var SNAP = /[?&]snap\b/.test(location.search);   // solo para pruebas: sin transiciones

  /* =========================================================
     INIT
     ========================================================= */
  function init(opts) {
    var app = opts.app, canvas = opts.canvas, COLORS = opts.colors;
    var CAMS = opts.cams, reduceMotion = opts.reduceMotion;
    var isMobile = function () { return app.clientWidth <= 760; };

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(-6.5, 1.6, 3.8);

    var controls = new Orbit(camera, canvas, { wheelZoom: opts.wheelZoom });
    controls.target.set(0, -0.35, 0);
    controls.autoRotate = !reduceMotion;

    var brain = new THREE.Group();
    scene.add(brain);

    var uTime = { value: 0 }, uMode = { value: 0 };
    var TISSUE = { cortex: "#e7aca6", cerebellum: "#d39098", brainstem: "#ebc4b4", callosum: "#f3e6dc", limbic: "#e9b39b" };

    function makeMat(region, tissue, tint) {
      return new THREE.ShaderMaterial({
        uniforms: {
          uTissue: { value: new THREE.Color(tissue) }, uRegion: { value: new THREE.Color(COLORS[region]) },
          uTint: { value: tint }, uOpacity: { value: 1 }, uGlow: { value: 0 }, uHover: { value: 0 },
          uMode: uMode, uTime: uTime
        },
        vertexShader: VERT, fragmentShader: FRAG, transparent: true
      });
    }

    var pickables = [], parts = {};
    function register(mesh, region, part) {
      mesh.userData = { region: region, part: part, flash: 0, op: 1 };
      ensureAO(mesh.geometry);
      pickables.push(mesh); (parts[part] = parts[part] || []).push(mesh);
      return mesh;
    }

    /* ---------- Hemisferio cerebral ---------- */
    function buildHemisphere(side, detail) {
      var g = mergeVerts(new THREE.IcosahedronGeometry(1, detail));
      var pos = g.attributes.position, n = pos.count, ao = new Float32Array(n);
      var o = side > 0 ? 11.3 : 47.9;
      for (var i = 0; i < n; i++) {
        var vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
        var lat = vx * side, medial = lat < 0;
        var rx = medial ? 0.17 : 0.74, rz = 1.16, ry, temporal = 0;
        if (vy >= 0) {
          ry = 0.74;
          ry *= 1 - 0.12 * Math.max(0, vz - 0.25);                 // el frontal desciende hacia el polo
          if (vz < 0) ry *= 1 - 0.24 * vz * vz;                    // occipital más estrecho
        } else {
          temporal = smooth(0.55, 0.22, vz) * smooth(-0.95, -0.45, vz) * smooth(0.0, 0.5, lat);
          ry = 0.30 + 0.31 * temporal;                              // frontal plano · temporal colgando
        }
        if (vz < -0.55) rx *= 1 - 0.25 * (-vz - 0.55);              // polo occipital afilado
        var x = vx * rx * (1 + 0.06 * temporal), y = vy * ry, z = vz * rz;
        if (vz > 0.35 && vy < 0) y *= 1 - 0.25 * smooth(0.35, 0.9, vz);   // superficie orbitaria
        var nx = vx / rx, ny = vy / ry, nz = vz / rz, nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;

        // circunvoluciones: ruido con dominio deformado → giros anchos, surcos estrechos
        var w = 0.45 * noise(x * 1.6 + o, y * 1.6, z * 1.6);
        var f = 3.35;
        var n1 = noise(x * f + o + w, y * f + w, z * f - w);
        var n2 = noise(x * f * 2.1 - o, y * f * 2.1 + w, z * f * 2.1 + 3.1);
        var h1 = smooth(0, 0.14, Math.abs(n1)), h2 = smooth(0, 0.09, Math.abs(n2));
        var groove = Math.max(1 - h1, (1 - h2) * 0.42);
        var extra = 0;

        if (!medial) {
          var latF = Math.min(1, lat * 1.7);
          // Cisura de Silvio: sube hacia atrás y separa el lóbulo temporal
          var sy = -0.07 - 0.3 * (z - 0.05) + 0.03 * noise(z * 4, o, 1.0);
          var fadeS = smooth(-0.6, -0.32, z) * smooth(0.66, 0.42, z);
          var sylv = (1 - smooth(0, 0.055, Math.abs(y - sy))) * latF * fadeS;
          // Surco central (Rolando): de la cima hacia abajo y adelante
          var cz = -0.14 + (0.66 - y) * 0.27 + 0.045 * noise(y * 5, o, 2.0);
          var above = smooth(sy - 0.02, sy + 0.14, y);
          var cent = (1 - smooth(0, 0.032, Math.abs(z - cz))) * above * smooth(-0.2, 0.15, y);
          groove = Math.max(groove, sylv, cent * 0.95);
          extra = -0.05 * sylv - 0.015 * cent;
        }
        var mf = medial ? 0.45 : 1;
        var d = (-0.066 * groove + 0.013 * (1 - groove)) * mf + extra;
        pos.setXYZ(i, x + nx * d, y + ny * d, z + nz * d);
        ao[i] = 1 - 0.92 * Math.min(1, groove + (extra < -0.02 ? 0.2 : 0));
      }
      g.setAttribute("ao", new THREE.BufferAttribute(ao, 1));
      g.computeVertexNormals();
      var m = new THREE.Mesh(g, makeMat("cortex", TISSUE.cortex, 0.08));
      m.position.x = side * 0.22;
      m.renderOrder = 10;
      return m;
    }

    /* ---------- Cerebelo ---------- */
    function buildCerebellum(detail) {
      var g = mergeVerts(new THREE.IcosahedronGeometry(1, detail));
      var pos = g.attributes.position, n = pos.count, ao = new Float32Array(n);
      for (var i = 0; i < n; i++) {
        var vx = pos.getX(i), vy = pos.getY(i), vz = pos.getZ(i);
        var ry = vy > 0 ? 0.27 : 0.36;
        var x = vx * 0.6, y = vy * ry, z = vz * 0.42;
        var nx = vx / 0.6, ny = vy / ry, nz = vz / 0.42, nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
        var ph = vy + 0.25 * vz * vz + 0.06 * noise(vx * 3, vy * 3, vz * 3);
        var g1 = smooth(0.35, 1, Math.sin(ph * 46));
        var verm = (1 - smooth(0, 0.1, Math.abs(vx))) * (vz < 0.2 ? 1 : 0.3);
        var d = -0.017 * g1 - 0.05 * verm;
        pos.setXYZ(i, x + nx * d, y + ny * d, z + nz * d);
        ao[i] = 1 - 0.75 * Math.max(g1, verm * 0.8);
      }
      g.setAttribute("ao", new THREE.BufferAttribute(ao, 1));
      g.computeVertexNormals();
      var m = new THREE.Mesh(g, makeMat("reptilian", TISSUE.cerebellum, 0.12));
      m.position.set(0, -0.6, -0.8); m.rotation.x = 0.15;
      return m;
    }

    /* ---------- Tronco encefálico (mesencéfalo · protuberancia · bulbo) ---------- */
    function buildBrainstem() {
      var prof = [[0, 0.25], [0.16, 0.22], [0.2, 0.1], [0.21, -0.05], [0.28, -0.2], [0.3, -0.32], [0.26, -0.45], [0.19, -0.55], [0.17, -0.75], [0.14, -0.95], [0.12, -1.2], [0.11, -1.45], [0, -1.46]]
        .map(function (a) { return new THREE.Vector2(a[0], a[1]); });
      var m = new THREE.Mesh(new THREE.LatheGeometry(prof, 56), makeMat("reptilian", TISSUE.brainstem, 0.14));
      m.position.set(0, -0.25, -0.2); m.rotation.x = 0.3;
      return m;
    }

    /* ---------- Sistema límbico ---------- */
    function buildLimbic() {
      var grp = new THREE.Group(), list = [];
      [-1, 1].forEach(function (s) {
        var pts = [[0.10, -0.22, 0.38], [0.12, 0.12, 0.62], [0.13, 0.45, 0.35], [0.13, 0.5, -0.1], [0.14, 0.4, -0.5], [0.2, 0.12, -0.68], [0.32, -0.18, -0.55], [0.4, -0.36, -0.25], [0.42, -0.42, 0.05]]
          .map(function (a) { return new THREE.Vector3(s * a[0], a[1], a[2]); });
        var tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 140, 0.055, 16, false), makeMat("limbic", TISSUE.limbic, 0.5));
        list.push([tube, "hippocampus"]);
        var cap = new THREE.Mesh(ensureAO(new THREE.SphereGeometry(0.055, 16, 12)), tube.material);
        cap.position.copy(pts[pts.length - 1]); tube.add(cap);
        var amy = new THREE.Mesh(new THREE.SphereGeometry(0.095, 32, 24), makeMat("limbic", "#e59a7f", 0.6));
        amy.position.set(s * 0.42, -0.44, 0.2); amy.scale.set(1, 0.9, 1.15);
        list.push([amy, "amygdala"]);
        var thal = new THREE.Mesh(new THREE.SphereGeometry(1, 40, 30), makeMat("limbic", TISSUE.limbic, 0.45));
        thal.position.set(s * 0.13, 0, -0.1); thal.scale.set(0.13, 0.12, 0.19);
        list.push([thal, "thalamus"]);
      });
      var hypo = new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 18), makeMat("limbic", "#e8a487", 0.55));
      hypo.position.set(0, -0.2, 0.12);
      list.push([hypo, "hypothalamus"]);
      list.forEach(function (it) { grp.add(it[0]); register(it[0], "limbic", it[1]); });
      return grp;
    }

    function buildCallosum() {
      var pts = [[0, -0.02, 0.52], [0, 0.2, 0.56], [0, 0.33, 0.25], [0, 0.35, -0.15], [0, 0.25, -0.48], [0, 0.08, -0.55]].map(function (a) { return new THREE.Vector3(a[0], a[1], a[2]); });
      var m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 80, 0.06, 12, false), makeMat("cortex", TISSUE.callosum, 0.15));
      m.scale.x = 2.6; m.renderOrder = 5;
      return m;
    }

    /* ---------- Partículas tipo "polvo de estrellas" ---------- */
    function buildDust() {
      var n = 600, arr = new Float32Array(n * 3);
      for (var i = 0; i < n; i++) {
        var r = 4 + Math.random() * 8, th = Math.random() * Math.PI * 2, ph = Math.acos(2 * Math.random() - 1);
        arr[i * 3] = r * Math.sin(ph) * Math.cos(th); arr[i * 3 + 1] = r * Math.cos(ph) * 0.7; arr[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      }
      var g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      return new THREE.Points(g, new THREE.PointsMaterial({ color: 0xff7ad9, size: 0.03, transparent: true, opacity: 0.6, depthWrite: false }));
    }

    var glowTex = (function () {
      var c = document.createElement("canvas"); c.width = c.height = 128;
      var x = c.getContext("2d"), gr = x.createRadialGradient(64, 64, 0, 64, 64, 64);
      gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.25, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
      x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
      var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
    })();
    function makeGlow(color, scale) {
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: color, blending: THREE.AdditiveBlending, transparent: true, depthTest: false, depthWrite: false }));
      s.scale.setScalar(scale); s.renderOrder = 30; return s;
    }

    var hemiL, hemiR, anchors = {};
    function buildBrain() {
      var detail = isMobile() ? 60 : 84;
      hemiL = register(buildHemisphere(-1, detail), "cortex", "hemiL");
      hemiR = register(buildHemisphere(1, detail), "cortex", "hemiR");
      brain.add(hemiL, hemiR);
      brain.add(register(buildCallosum(), "cortex", "callosum"));
      brain.add(register(buildCerebellum(isMobile() ? 44 : 60), "reptilian", "cerebellum"));
      brain.add(register(buildBrainstem(), "reptilian", "brainstem"));
      brain.add(buildLimbic());
      scene.add(buildDust());
      var mk = function (parent, x, y, z) { var o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
      anchors.cortex = mk(hemiL, -0.5, 0.55, 0.35);
      anchors.limbic = mk(brain, -0.42, -0.44, 0.2);
      anchors.reptilian = mk(brain, 0, -1.25, -0.55);
    }

    /* ---------- Estado visual ---------- */
    var EMPTY = { cortex: { op: 1, glow: 0 }, limbic: { op: 1, glow: 0 }, reptilian: { op: 1, glow: 0 }, open: 0 };
    var target = JSON.parse(JSON.stringify(EMPTY)), cur = JSON.parse(JSON.stringify(EMPTY));
    var modeTarget = 0, xray = 0;
    function setLook(look) {
      ["cortex", "limbic", "reptilian"].forEach(function (k) { target[k].op = look[k].op; target[k].glow = look[k].glow; });
      target.open = look.open;
      if (xray > 0) applyXray();
    }
    function applyXray() {
      target.cortex.op = Math.min(target.cortex.op, 1 - xray * 0.88);
      target.open = Math.max(target.open, xray * 0.5);
      if (xray > 0.3) target.limbic.op = 1;
    }
    function flashPart(name, amt) { (parts[name] || []).forEach(function (m) { m.userData.flash = Math.max(m.userData.flash, amt || 1); }); }
    function flashRegion(region, amt) { pickables.forEach(function (m) { if (m.userData.region === region) m.userData.flash = Math.max(m.userData.flash, amt || 1); }); }

    /* ---------- Cámara ---------- */
    var camTween = null;
    var ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    function flyTo(id, dur) {
      var v = CAMS[id]; if (!v) return;
      var t1 = new THREE.Vector3().fromArray(v.target), p1 = new THREE.Vector3().fromArray(v.pos);
      var aspect = app.clientWidth / Math.max(1, app.clientHeight);
      var f = aspect < 1 ? Math.min(3.2, (app.classList.contains("panel-open") ? 1.35 : 1.1) / aspect) : 1;
      p1.sub(t1).multiplyScalar(f).add(t1);
      controls.stop();
      camTween = { p0: camera.position.clone(), q0: controls.target.clone(), p1: p1, q1: t1, t: 0, dur: (reduceMotion || SNAP) ? 0.01 : (dur || 1.7) };
    }
    controls.onStart(function () { camTween = null; controls.autoRotate = false; });

    /* ---------- Pulso de decisión ---------- */
    var V3 = function (a) { return new THREE.Vector3(a[0], a[1], a[2]); };
    var PATHS = {
      A: new THREE.CatmullRomCurve3([[0, -1.6, -0.62], [0, -1.0, -0.44], [0, -0.5, -0.28], [-0.13, 0, -0.12]].map(V3)),
      B: new THREE.CatmullRomCurve3([[-0.13, 0, -0.12], [-0.3, -0.2, 0.05], [-0.42, -0.44, 0.2]].map(V3)),
      C: new THREE.CatmullRomCurve3([[-0.13, 0, -0.12], [-0.4, 0.15, -0.7], [-0.52, 0.55, -0.3], [-0.47, 0.6, 0.3], [-0.35, 0.3, 0.95]].map(V3))
    };
    var SEGS = [
      { path: "A", t0: 0, t1: 1.3, color: COLORS.reptilian, end: 1, flash: "brainstem" },
      { path: "B", t0: 1.3, t1: 2.1, color: COLORS.limbic, end: 2, flash: "amygdala" },
      { path: "C", t0: 2.6, t1: 5.6, color: COLORS.cortex, end: 3, flash: "cortex" }
    ];
    var PULSE_END = 6.1;
    var pulse = { on: false, time: 0, hist: [], fired: {}, onStage: null, onDone: null, curSeg: null };
    var head = makeGlow(0xffffff, 0.42); head.visible = false; brain.add(head);
    var core = new THREE.Mesh(new THREE.SphereGeometry(0.03, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
    core.renderOrder = 31; head.add(core); core.scale.setScalar(1 / 0.42);
    var TRAIL_N = 26, trail = [];
    for (var ti = 0; ti < TRAIL_N; ti++) { var sp = makeGlow(0xffffff, 0.3 * (1 - ti / TRAIL_N) + 0.04); sp.visible = false; brain.add(sp); trail.push(sp); }

    function startPulse(onStage, onDone) {
      pulse.on = true; pulse.time = 0; pulse.hist = []; pulse.fired = {}; pulse.onStage = onStage; pulse.onDone = onDone; pulse.curSeg = null;
      if (onStage) onStage(0);
    }
    function stopPulse() { pulse.on = false; pulse.hist = []; head.visible = false; trail.forEach(function (s) { s.visible = false; }); }
    function updatePulse(dt) {
      if (!pulse.on) return;
      pulse.time += dt;
      var T = pulse.time, seg = null;
      SEGS.forEach(function (s) {
        if (T >= s.t0 && T <= s.t1) seg = s;
        if (T > s.t1 && !pulse.fired[s.end]) {
          pulse.fired[s.end] = true;
          if (s.flash === "cortex") flashRegion("cortex", 1.1); else flashPart(s.flash, 1.6);
          if (pulse.onStage) pulse.onStage(s.end);
        }
      });
      if (seg) {
        if (pulse.curSeg !== seg) { pulse.hist = []; pulse.curSeg = seg; }
        var p = PATHS[seg.path].getPointAt(ease((T - seg.t0) / (seg.t1 - seg.t0)));
        head.position.copy(p); head.visible = true; head.material.color.set(seg.color);
        pulse.hist.unshift(p.clone()); if (pulse.hist.length > TRAIL_N * 2) pulse.hist.length = TRAIL_N * 2;
        trail.forEach(function (s, i) {
          var h = pulse.hist[i * 2]; s.visible = !!h;
          if (h) { s.position.copy(h); s.material.color.set(seg.color); s.material.opacity = (1 - i / TRAIL_N) * 0.8; }
        });
      } else {
        head.visible = false;
        trail.forEach(function (s) { s.material.opacity *= 0.9; });
      }
      if (T > PULSE_END) { stopPulse(); if (pulse.onDone) pulse.onDone(); }
    }

    /* ---------- Selección ---------- */
    var raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
    var hovered = null, downAt = null, pickFns = [], hoverFns = [];
    function pick(ev) {
      var r = canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      var hits = raycaster.intersectObjects(pickables, false);
      for (var i = 0; i < hits.length; i++) { var o = hits[i].object; if (o.visible && o.userData.op > 0.35) return o; }
      return null;
    }
    canvas.addEventListener("pointermove", function (ev) {
      if (ev.pointerType !== "mouse" || controls.isDragging()) return;
      var h = pick(ev);
      if (h !== hovered) { hovered = h; }
      hoverFns.forEach(function (f) { f(hovered ? hovered.userData : null, ev); });
    });
    canvas.addEventListener("pointerleave", function (ev) { hovered = null; hoverFns.forEach(function (f) { f(null, ev); }); });
    canvas.addEventListener("pointerdown", function (ev) { downAt = [ev.clientX, ev.clientY]; });
    canvas.addEventListener("pointerup", function (ev) {
      if (!downAt) return;
      var moved = Math.hypot(ev.clientX - downAt[0], ev.clientY - downAt[1]); downAt = null;
      if (moved > 6) return;
      var hit = pick(ev);
      if (hit) { flashPart(hit.userData.part, 0.9); pickFns.forEach(function (f) { f(hit.userData); }); }
    });

    /* ---------- Desplazamiento por el panel ---------- */
    var shift = { x: 0, y: 0 }, shiftFn = function () { return { x: 0, y: 0 }; };

    function resize() {
      var w = app.clientWidth, h = app.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(app); else window.addEventListener("resize", resize);

    /* Pausar el render cuando la sección no está en pantalla */
    var onScreen = true;
    if (window.IntersectionObserver) new IntersectionObserver(function (e) { onScreen = e[0].isIntersecting; }, { threshold: 0.01 }).observe(app);

    var clock = new THREE.Clock(), frameFns = [], tmpV = new THREE.Vector3(), started = false;
    function frame() {
      requestAnimationFrame(frame);
      var raw = clock.getDelta();
      if (!onScreen) return;
      var dt = Math.min(raw, 0.05), t = clock.elapsedTime;
      var k = SNAP ? 1 : 1 - Math.exp(-dt * 3.2);
      ["cortex", "limbic", "reptilian"].forEach(function (r) {
        cur[r].op += (target[r].op - cur[r].op) * k;
        cur[r].glow += (target[r].glow - cur[r].glow) * k;
      });
      cur.open += (target.open - cur.open) * k;
      uMode.value += (modeTarget - uMode.value) * k;
      uTime.value = t;
      if (hemiL) { hemiL.position.x = -(0.22 + cur.open * 0.5); hemiR.position.x = 0.22 + cur.open * 0.5; }

      pickables.forEach(function (m) {
        var r = cur[m.userData.region], u = m.material.uniforms;
        m.userData.op = r.op;
        u.uOpacity.value = r.op;
        m.material.depthWrite = r.op > 0.75 && uMode.value < 0.5;
        u.uGlow.value = r.glow * 0.6 + m.userData.flash * 0.9;
        u.uHover.value = hovered && hovered.userData.region === m.userData.region ? 1 : 0;
        m.userData.flash *= Math.exp(-dt * 2.2);
        m.visible = r.op > 0.02;
      });

      updatePulse(Math.min(raw, 0.25));

      if (camTween) {
        camTween.t += Math.min(raw, 0.25) / camTween.dur;
        var e = ease(Math.min(1, camTween.t));
        camera.position.lerpVectors(camTween.p0, camTween.p1, e);
        controls.target.lerpVectors(camTween.q0, camTween.q1, e);
        if (camTween.t >= 1) camTween = null;
      }
      brain.position.y = reduceMotion ? 0 : Math.sin(t * 0.6) * 0.025;

      var d = shiftFn(), k2 = 1 - Math.exp(-dt * 5);
      shift.x += (d.x - shift.x) * k2; shift.y += (d.y - shift.y) * k2;
      var w = app.clientWidth, h = app.clientHeight;
      camera.setViewOffset(w, h, shift.x, shift.y, w, h);

      controls.update(dt);
      frameFns.forEach(function (f) { f(dt, t); });
      renderer.render(scene, camera);
    }

    var api = {
      build: function () { buildBrain(); resize(); if (!started) { started = true; frame(); } },
      setLook: setLook,
      setXray: function (v) { xray = v; applyXray(); return xray; },
      getXray: function () { return xray; },
      setMode: function (m) { modeTarget = m; },
      getMode: function () { return modeTarget; },
      flyTo: flyTo, flashPart: flashPart, flashRegion: flashRegion,
      startPulse: startPulse, stopPulse: stopPulse,
      zoomBy: function (f) { controls.zoomBy(f); camTween = null; },
      setAutoRotate: function (b) { controls.autoRotate = !!b && !reduceMotion; },
      setShiftFn: function (fn) { shiftFn = fn; },
      onPick: function (fn) { pickFns.push(fn); },
      onHover: function (fn) { hoverFns.push(fn); },
      onFrame: function (fn) { frameFns.push(fn); },
      projectAnchor: function (k) {
        if (!anchors[k]) return null;
        anchors[k].getWorldPosition(tmpV).project(camera);
        return { x: (tmpV.x * 0.5 + 0.5) * app.clientWidth, y: (-tmpV.y * 0.5 + 0.5) * app.clientHeight, visible: tmpV.z < 1 };
      },
      resize: resize
    };
    return api;
  }

  window.__BRAIN3D__ = { init: init };
})();
