/* ============ CASA 3D in stile cartoon (three.js r128) ============
   House3D.create(el, {rooms, onSelect, onFloor, pinHTML}) → api | null se WebGL non c'è */
(function () {
  const INK = 0x2E3A59;

  // posizione di ogni zona: piano (0 terra, 1 primo, -1 esterno), centro e distanza della camera
  const PLACES = {
    bagno:     { f: 0, x: -4, z: 2 },
    ingresso:  { f: 0, x: 0, z: 2 },
    soggiorno: { f: 0, x: 4, z: 2 },
    garage:    { f: 0, x: -4, z: -2 },
    cucina:    { f: 0, x: 0, z: -2 },
    animali:   { f: 0, x: 4, z: -2 },
    cameretta: { f: 1, x: -4, z: 0 },
    scale:     { f: 1, x: 0, z: 1.5 },
    emergenze: { f: 1, x: 4, z: 0 },
    giardino:  { f: -1, x: 12, z: 3, r: 17 },
    vialetto:  { f: -1, x: -3, z: 9, r: 18 },
    cortile:   { f: -1, x: 0, z: -10, r: 17 },
    ascensore: { f: -1, x: 7.2, z: -3, y: 3, r: 13 },
    vicini:    { f: -1, x: -21, z: 1, r: 18 },
  };

  function supported() {
    if (!window.THREE) return false;
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl') || c.getContext('experimental-webgl')); }
    catch (e) { return false; }
  }

  function create(el, opts) {
    if (!supported()) return null;
    const THREE = window.THREE;
    const rooms = opts.rooms;

    /* ---- renderer, scena, camera ---- */
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0xBFE9FF);
    el.appendChild(renderer.domElement);
    renderer.domElement.className = 'h3d-canvas';
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0xBFE9FF, 60, 120);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.3, 300);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xB9C7A8, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.75);
    sun.position.set(12, 25, 14);
    scene.add(sun);

    /* ---- materiali cartoon ---- */
    const grad = new THREE.DataTexture(new Uint8Array([90, 170, 255]), 3, 1, THREE.LuminanceFormat);
    grad.minFilter = grad.magFilter = THREE.NearestFilter;
    grad.needsUpdate = true;
    const mats = {};
    const M = (c) => mats[c] || (mats[c] = new THREE.MeshToonMaterial({ color: c, gradientMap: grad }));
    const inkMat = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });
    const glassMat = new THREE.MeshToonMaterial({ color: 0xBDEBFF, gradientMap: grad, transparent: true, opacity: 0.35 });

    const outline = (m, geo) => { const o = new THREE.Mesh(geo, inkMat); m.add(o); return o; };
    // y = base dell'oggetto
    function box(p, w, h, d, c, x, y, z, o = {}) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), o.mat || M(c));
      m.position.set(x, y + h / 2, z);
      if (o.ol !== false) outline(m, new THREE.BoxGeometry(w + .07, h + .07, d + .07));
      if (o.ry) m.rotation.y = o.ry;
      p.add(m); return m;
    }
    function cyl(p, rt, rb, h, c, x, y, z, o = {}) {
      const s = o.seg || 18;
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, s), M(c));
      m.position.set(x, y + h / 2, z);
      if (o.ol !== false) outline(m, new THREE.CylinderGeometry(rt + .04, rb + .04, h + .06, s));
      p.add(m); return m;
    }
    function ball(p, r, c, x, y, z, o = {}) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), M(c));
      m.position.set(x, y, z);
      if (o.ol !== false) outline(m, new THREE.SphereGeometry(r + .05, 16, 12));
      p.add(m); return m;
    }
    function group(p, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); p.add(g); return g; }
    // emoji come sprite (persone, animali piccoli, decorazioni)
    const emoCache = {};
    function emo(p, ch, x, y, z, s = 1) {
      let tex = emoCache[ch];
      if (!tex) {
        const cv = document.createElement('canvas'); cv.width = cv.height = 128;
        const g = cv.getContext('2d');
        g.font = '100px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
        g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(ch, 64, 70);
        tex = emoCache[ch] = new THREE.CanvasTexture(cv);
      }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      sp.position.set(x, y + s / 2, z); sp.scale.set(s, s, s);
      p.add(sp); return sp;
    }

    const anims = [];   // funzioni (t, dt) per le animazioni d'ambiente
    const pickables = []; // mesh che, toccate, selezionano una zona
    const pick = (m, id) => { m.userData.room = id; pickables.push(m); return m; };

    /* ================= ESTERNO ================= */
    const O = group(scene);
    // prato e strada
    pick(box(O, 90, .2, 70, 0x8FD46B, 0, -.4, 0, { ol: false }), null);
    box(O, 90, .12, 4.2, 0x5B6474, 0, -.22, 14.6, { ol: false });
    for (let i = -40; i < 40; i += 4) box(O, 1.8, .02, .25, 0xffffff, i, -.1, 14.6, { ol: false });
    box(O, 90, .16, 1.2, 0xD9D3C7, 0, -.24, 11.9, { ol: false }); // marciapiede
    // strisce pedonali
    for (let i = 0; i < 5; i++) box(O, .5, .03, 3.6, 0xffffff, -1.6 + i * .8, -.1, 14.6, { ol: false });

    // vialetto pedonale + vialetto del garage
    pick(box(O, 2.4, .1, 7.4, 0xE8D9BF, 0, -.25, 7.9), 'vialetto');
    pick(box(O, 4, .1, 4, 0xC9C3B6, -8, -.25, -2), 'vialetto');
    pick(box(O, 3.4, .1, 12.6, 0xC9C3B6, -8.3, -.25, 5.7), 'vialetto');
    // recinzione con cancelli
    const fence = (x1, x2) => {
      for (let x = x1; x <= x2; x += .7) box(O, .14, 1, .14, 0xffffff, x, -.2, 11.2);
      box(O, x2 - x1, .12, .1, 0xffffff, (x1 + x2) / 2, .5, 11.2);
    };
    fence(-30, -10.2); fence(-6.4, -1.4); fence(1.4, 30);
    const gate = group(O, -8.3, 0, 11.2);
    for (let i = 0; i < 6; i++) box(gate, .1, 1.2, .1, 0x3A4766, -1.5 + i * .6, -.2, 0);
    box(gate, 3.4, .14, .14, 0x3A4766, 0, .9, 0);
    box(gate, 3.4, .14, .14, 0x3A4766, 0, .1, 0);
    anims.push((t) => { gate.position.x = -8.3 - Math.max(0, Math.sin(t * .35)) * 3.2; }); // cancello automatico
    box(O, .2, 1.4, .2, 0xFFC23D, -10.1, -.2, 11.2);
    ball(O, .14, 0xFF7062, -10.1, 1.32, 11.2).userData.blink = true;
    box(O, .9, 1.1, .3, 0xE8604C, 2.2, -.2, 11); // cassetta posta
    emo(O, '🚶', 3.5, -.2, 12, 1.2);
    // auto parcheggiata
    function car(p, c, x, z, ry = 0) {
      const g = group(p, x, 0, z); g.rotation.y = ry;
      box(g, 1.7, .7, 3.4, c, 0, .25, 0);
      box(g, 1.5, .6, 1.8, c, 0, .95, -.2);
      box(g, 1.52, .45, 1.6, 0xBDEBFF, 0, 1.0, -.2, { ol: false });
      for (const [wx, wz] of [[-.85, 1.1], [.85, 1.1], [-.85, -1.1], [.85, -1.1]]) {
        const w = cyl(g, .38, .38, .3, 0x2E3A59, wx, -.15, wz, { ol: false });
        w.rotation.z = Math.PI / 2; w.position.y = .3;
      }
      ball(g, .14, 0xFFF3A0, -.55, .6, 1.72, { ol: false }); ball(g, .14, 0xFFF3A0, .55, .6, 1.72, { ol: false });
      return g;
    }
    car(O, 0xFF7062, -8.3, 3.5);
    const runner = car(O, 0x4FA3F7, 0, 13.6, Math.PI / 2);
    anims.push((t) => { runner.position.x = ((t * 6) % 80) - 40; });
    const runner2 = car(O, 0xFFC23D, 0, 15.6, -Math.PI / 2);
    anims.push((t) => { runner2.position.x = 40 - ((t * 4.5 + 30) % 80); });

    // giardino: piscina, albero, barbecue, fiori
    const G = group(O);
    pick(box(G, 11, .06, 12, 0x7FCB5B, 13, -.28, 4, { ol: false }), 'giardino');
    box(G, 5.6, .5, 3.6, 0xffffff, 12.5, -.3, 5);
    const water = box(G, 5, .1, 3, 0x46C6F0, 12.5, .12, 5, { ol: false });
    pick(water, 'giardino');
    const duck = emo(G, '🦆', 12, .1, 5, .9);
    anims.push((t) => {
      water.position.y = .17 + Math.sin(t * 2) * .03;
      duck.position.x = 12.5 + Math.sin(t * .6) * 1.8; duck.position.y = .62 + Math.sin(t * 3) * .05;
    });
    const tree = group(G, 16, 0, -1);
    cyl(tree, .35, .45, 2.2, 0x9A6A3F, 0, -.2, 0);
    const crown = group(tree, 0, 2.4, 0);
    ball(crown, 1.5, 0x4DB85A, 0, .4, 0); ball(crown, 1.1, 0x5CC96A, .9, -.1, .4); ball(crown, 1, 0x45A852, -.8, 0, -.3);
    ball(crown, .18, 0xFF5A4F, .6, .9, 1.2); ball(crown, .18, 0xFF5A4F, -.9, .5, .8);
    anims.push((t) => { crown.rotation.z = Math.sin(t * 1.1) * .05; crown.rotation.x = Math.sin(t * .8) * .03; });
    cyl(G, .5, .4, .9, 0x3A4766, 9, -.2, 9.2); box(G, 1.1, .1, 1.1, 0x666666, 9, .7, 9.2); // barbecue
    for (let i = 0; i < 9; i++) {
      const fx = 8.2 + (i % 5) * 2.2, fz = -3 + Math.floor(i / 5) * 1.2;
      cyl(G, .04, .04, .5, 0x3E9E4A, fx, -.2, fz, { ol: false });
      ball(G, .2, [0xFF7062, 0xFFC23D, 0xC77DFF, 0xffffff][i % 4], fx, .4, fz);
    }
    emo(G, '🐝', 10, 1.4, -2.5, .6).userData.fly = true;
    // siepe di confine
    for (let z = -6; z < 11; z += 1.2) ball(O, .75, 0x3E9E4A, 19.5, .4, z);

    // cortile sul retro: altalena, scivolo, canestro, bidoni
    const C = group(O);
    pick(box(C, 16, .08, 9, 0xF0E1BE, 0, -.27, -10.5, { ol: false }), 'cortile');
    const sw = group(C, -4, 0, -10);
    box(sw, .15, 2.6, .15, 0xFF7062, -1.2, -.2, 0); box(sw, .15, 2.6, .15, 0xFF7062, 1.2, -.2, 0);
    box(sw, 2.6, .15, .15, 0xFF7062, 0, 2.35, 0);
    const seat = group(sw, 0, 2.4, 0);
    box(seat, .04, 1.7, .04, 0x2E3A59, -.35, -1.7, 0, { ol: false }); box(seat, .04, 1.7, .04, 0x2E3A59, .35, -1.7, 0, { ol: false });
    box(seat, .9, .1, .4, 0xFFC23D, 0, -1.8, 0);
    anims.push((t) => { seat.rotation.x = Math.sin(t * 2) * .45; });
    const sl = group(C, 1.5, 0, -11);
    box(sl, .9, 1.8, .9, 0x8E7CF0, 0, -.2, -1.2);
    const slide = box(sl, .9, .12, 2.8, 0x21A99A, 0, .5, 0.1); slide.rotation.x = .55;
    const hoop = group(C, 6, 0, -13);
    cyl(hoop, .1, .1, 3, 0x9AA3B5, 0, -.2, 0);
    box(hoop, 1.4, 1, .1, 0xffffff, 0, 2.6, .2);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.32, .04, 6, 16), M(0xFF7062));
    ring.rotation.x = Math.PI / 2; ring.position.set(0, 2.75, .6); hoop.add(ring);
    const bb = ball(C, .25, 0xFF8A3D, 5, .1, -11);
    anims.push((t) => { const k = (t * 1.3) % 1; bb.position.y = .05 + Math.abs(Math.sin(k * Math.PI)) * 1.6; });
    box(C, .9, 1.1, .9, 0x3E9E4A, -7, -.2, -14); box(C, .9, 1.1, .9, 0x4FA3F7, -5.9, -.2, -14); box(C, .9, 1.1, .9, 0xFFC23D, -4.8, -.2, -14);
    emo(C, '🧒', -2, -.2, -8.5, 1.3); emo(C, '👧', 3, -.2, -9, 1.3);

    // casa del vicino con il suo cane
    const N = group(O, -22, 0, 0);
    pick(box(N, 12, .06, 14, 0x86CF63, 0, -.28, 2, { ol: false }), 'vicini');
    box(N, 7, 3.2, 6, 0xC8E6F5, 0, -.2, 0);
    const nroof = new THREE.Mesh(new THREE.ConeGeometry(5.4, 2.4, 4), M(0x4FA3F7));
    nroof.position.set(0, 4.2, 0); nroof.rotation.y = Math.PI / 4; nroof.scale.set(1, 1, .85); N.add(nroof);
    outline(nroof, new THREE.ConeGeometry(5.5, 2.5, 4));
    box(N, 1.1, 2, .1, 0x9A6A3F, 0, -.2, 3.02);
    box(N, 1.2, 1, .1, 0xBDEBFF, -2.2, 1, 3.02); box(N, 1.2, 1, .1, 0xBDEBFF, 2.2, 1, 3.02);
    emo(N, '👵', 1.6, -.2, 4.4, 1.5);
    box(N, 1.4, 1.1, 1.3, 0xE8604C, 3.6, -.2, 5.5); // cuccia
    const ndog = emo(N, '🐕', 2.4, -.2, 6.2, 1.1);
    anims.push((t) => { ndog.position.y = .35 + Math.abs(Math.sin(t * 3)) * .15; });
    emo(N, '🐈', -3, 2.95, 1.5, .9); // gatto sul tetto basso
    for (let z = -5; z < 11; z += 1.2) ball(O, .7, 0x3E9E4A, -14.6, .4, z);

    // nuvole
    const clouds = [];
    for (let i = 0; i < 6; i++) {
      const c = group(scene, -40 + i * 15, 16 + (i % 3) * 2, -25 + (i % 2) * 12);
      for (let k = 0; k < 4; k++) ball(c, 1.4 + (k % 2) * .6, 0xffffff, k * 1.6 - 2.4, (k % 2) * .5, 0, { ol: false });
      clouds.push(c);
    }
    anims.push((t, dt) => { for (const c of clouds) { c.position.x += dt * .8; if (c.position.x > 50) c.position.x = -50; } });
    // uccellino
    const bird = emo(scene, '🐦', 0, 9, 0, .9);
    anims.push((t) => { bird.position.set(Math.cos(t * .4) * 16, 9 + Math.sin(t * 2) * .4, Math.sin(t * .4) * 12); });

    /* ================= CASA ================= */
    const H = group(scene);
    const F0 = group(H), F1 = group(H, 0, 3, 0), ROOF = group(H);
    const extWalls = [];
    const WALL = 0xFFF3DD;

    function floorTile(p, id, x, z, w, d) {
      const c = parseInt((rooms.find(r => r.id === id) || { color: '#EEE' }).color.slice(1), 16);
      pick(box(p, w, .2, d, c, x, -.2, z), id);
    }
    // muro esterno: si nasconde quando la camera lo guarda da fuori
    function extWall(p, x1, z1, x2, z2, nx, nz) {
      const len = Math.hypot(x2 - x1, z2 - z1), along = Math.abs(x2 - x1) > .01;
      const w = box(p, along ? len : .2, 3, along ? .2 : len, WALL, (x1 + x2) / 2, 0, (z1 + z2) / 2);
      w.userData.n = new THREE.Vector3(nx, 0, nz);
      extWalls.push(w); return w;
    }
    // finestra o porta attaccata a un muro (si nasconde con lui)
    function opening(wall, off, y, w, h, c, out = .13) {
      const n = wall.userData.n;
      const g = new THREE.Mesh(new THREE.BoxGeometry(n.x ? .06 : w, h, n.z ? .06 : w), M(c));
      g.position.set(n.x ? n.x * out : off, y - 1.5 + h / 2, n.z ? n.z * out : off);
      outline(g, new THREE.BoxGeometry((n.x ? .06 : w) + .1, h + .1, (n.z ? .06 : w) + .1));
      wall.add(g); return g;
    }
    function lowWall(p, x1, z1, x2, z2) {
      const len = Math.hypot(x2 - x1, z2 - z1), along = Math.abs(x2 - x1) > .01;
      box(p, along ? len : .16, 1, along ? .16 : len, 0xFFFFFF, (x1 + x2) / 2, 0, (z1 + z2) / 2);
    }

    /* ---- piano terra ---- */
    floorTile(F0, 'bagno', -4, 2, 4, 4); floorTile(F0, 'ingresso', 0, 2, 4, 4); floorTile(F0, 'soggiorno', 4, 2, 4, 4);
    floorTile(F0, 'garage', -4, -2, 4, 4); floorTile(F0, 'cucina', 0, -2, 4, 4); floorTile(F0, 'animali', 4, -2, 4, 4);
    let w;
    w = extWall(F0, -6, 4, 6, 4, 0, 1);
    opening(w, 0, 0, 1.2, 2.2, 0x9A6A3F); opening(w, -4, 1.1, 1.4, 1.1, 0xBDEBFF); opening(w, 4, 1.1, 1.8, 1.2, 0xBDEBFF);
    w = extWall(F0, -6, -4, 6, -4, 0, -1); opening(w, 0, 1.2, 1.6, 1, 0xBDEBFF); opening(w, 4, 1.2, 1.2, 1, 0xBDEBFF);
    opening(w, -2, 0, 1, 2.1, 0x9A6A3F); // porta sul cortile
    w = extWall(F0, -6, -4, -6, 4, -1, 0); opening(w, -2, 0, 3.2, 2.4, 0xB9C2D0); opening(w, 2, 1.2, 1.2, 1, 0xBDEBFF);
    w = extWall(F0, 6, -4, 6, 4, 1, 0); opening(w, 2, 1.2, 1.4, 1, 0xBDEBFF); opening(w, -2.6, 0, 1, 2.1, 0x9A6A3F);
    lowWall(F0, -2, -4, -2, -2.6); lowWall(F0, -2, -1.4, -2, 1.4); lowWall(F0, -2, 2.6, -2, 4);
    lowWall(F0, 2, -4, 2, -2.6); lowWall(F0, 2, -1.4, 2, 1.4); lowWall(F0, 2, 2.6, 2, 4);
    lowWall(F0, -6, 0, -4.6, 0); lowWall(F0, -3.4, 0, -.6, 0); lowWall(F0, .6, 0, 3.4, 0); lowWall(F0, 4.6, 0, 6, 0);

    // bagno
    box(F0, 1.8, .6, .9, 0xffffff, -5, 0, 3.4); box(F0, 1.5, .1, .65, 0x7FD6F5, -5, .55, 3.4, { ol: false });
    cyl(F0, .28, .22, .45, 0xffffff, -2.7, 0, 3.5); box(F0, .55, .5, .2, 0xffffff, -2.7, .25, 3.85);
    box(F0, .9, .8, .5, 0xffffff, -5.6, 0, 1); box(F0, .4, .55, .06, 0xBDEBFF, -5.82, 1.2, 1, { ry: Math.PI / 2 });
    box(F0, .8, .9, .7, 0xE8EEF5, -3.5, 0, .5); const drum = cyl(F0, .25, .25, .05, 0x7FB7D9, -3.5, .45, .87, { ol: false }); drum.rotation.x = Math.PI / 2;
    anims.push((t) => { drum.rotation.y = t * 4; });
    emo(F0, '🧴', -4.4, .62, 3.1, .5); emo(F0, '🦆', -5.3, .55, 3.4, .45);
    // ingresso + scala
    box(F0, 1.2, .05, .8, 0xE8604C, 0, 0, 3.4, { ol: false });
    box(F0, .8, .5, .35, 0x9A6A3F, -1.4, 0, 3.6); emo(F0, '👟', -1.4, .5, 3.6, .5);
    cyl(F0, .06, .06, 1.8, 0x9A6A3F, -1.5, 0, .7); emo(F0, '🧥', -1.5, 1.1, .7, .7);
    for (let i = 0; i < 10; i++) box(F0, 1.2, .3 * (i + 1), .34, 0xE8C79A, 1.2, 0, 3.43 - i * .34);
    emo(F0, '🔑', -.9, 1, .15, .4);
    // soggiorno
    box(F0, 2.3, .5, .8, 0xFF8A65, 4.2, 0, 3.4); box(F0, 2.3, .6, .25, 0xFF8A65, 4.2, .5, 3.75);
    box(F0, .3, .5, .8, 0xFF7062, 2.95, 0, 3.4); box(F0, .3, .5, .8, 0xFF7062, 5.45, 0, 3.4);
    box(F0, 1.2, .35, .6, 0x9A6A3F, 4.2, 0, 2.2);
    box(F0, 1.6, .5, .4, 0x7A5A3F, 4.2, 0, .45); box(F0, 1.4, .8, .08, 0x2E3A59, 4.2, .5, .45);
    const tvScreen = box(F0, 1.25, .66, .02, 0x46C6F0, 4.2, .57, .5, { ol: false });
    anims.push((t) => { tvScreen.material = M([0x46C6F0, 0x7FE08A, 0xFFC23D][Math.floor(t / 1.5) % 3]); });
    cyl(F0, .05, .05, 1.5, 0x2E3A59, 5.6, 0, 1); const shade = cyl(F0, .2, .35, .4, 0xFFE08A, 5.6, 1.4, 1);
    box(F0, .3, .2, .3, 0xffffff, 2.5, 0, 1.2); emo(F0, '🔌', 2.15, .2, 1.8, .4);
    // garage
    box(F0, 2.4, .9, .7, 0x9A6A3F, -4, 0, -3.5); emo(F0, '🔧', -4.5, .9, -3.5, .5); emo(F0, '🔨', -3.6, .9, -3.5, .5);
    box(F0, .5, 1.8, 1.4, 0x8A94A8, -2.5, 0, -3.1); emo(F0, '🪣', -2.5, 1.8, -3.1, .45);
    emo(F0, '🚲', -4.5, 0, -1.2, 1.3); emo(F0, '🪜', -2.6, 0, -.6, 1.1);
    // cucina
    box(F0, 3.8, .9, .7, 0xffffff, 0, 0, -3.55); box(F0, 3.8, .08, .75, 0x21A99A, 0, .9, -3.55, { ol: false });
    box(F0, .8, .02, .55, 0x2E3A59, -.4, .98, -3.55, { ol: false });
    const flame = emo(F0, '🔥', -.4, .95, -3.5, .45);
    anims.push((t) => { flame.scale.setScalar(.4 + Math.sin(t * 12) * .05); });
    emo(F0, '🍲', .5, .95, -3.6, .5);
    box(F0, .8, 2.1, .7, 0xE8F4FF, 1.5, 0, -1); box(F0, .06, .5, .06, 0x2E3A59, 1.1, 1.2, -.62, { ol: false });
    cyl(F0, .7, .7, .08, 0xFFC23D, -.4, .75, -1.2); cyl(F0, .08, .08, .75, 0x9A6A3F, -.4, 0, -1.2);
    box(F0, .4, .45, .4, 0xFF7062, -1.4, 0, -1.2); box(F0, .4, .45, .4, 0xFF7062, .6, 0, -1.2);
    emo(F0, '🍎', -.4, .83, -1.2, .4);
    // animali: cane con la coda, gatto, acquario
    const dog = group(F0, 4.2, 0, -1.6);
    box(dog, .5, .45, .9, 0xE0A15A, 0, .3, 0);
    for (const [lx, lz] of [[-.17, .3], [.17, .3], [-.17, -.3], [.17, -.3]]) box(dog, .12, .3, .12, 0xC98A45, lx, 0, lz);
    const dhead = group(dog, 0, .8, .5);
    box(dhead, .45, .42, .45, 0xE0A15A, 0, -.1, 0);
    box(dhead, .25, .18, .2, 0xF4D0A4, 0, -.1, .3); ball(dhead, .06, 0x2E3A59, 0, .02, .42, { ol: false });
    ball(dhead, .05, 0x2E3A59, -.12, .12, .23, { ol: false }); ball(dhead, .05, 0x2E3A59, .12, .12, .23, { ol: false });
    box(dhead, .12, .3, .1, 0x9A6A3F, -.25, .0, 0); box(dhead, .12, .3, .1, 0x9A6A3F, .25, .0, 0);
    const tail = group(dog, 0, .7, -.45);
    box(tail, .08, .45, .08, 0xC98A45, 0, 0, 0); tail.rotation.x = -.6;
    anims.push((t) => { tail.rotation.z = Math.sin(t * 14) * .6; dhead.rotation.y = Math.sin(t * .9) * .35; dog.position.y = Math.abs(Math.sin(t * 1.8)) * .04; });
    cyl(F0, 1, 1, .2, 0x8E7CF0, 3.3, 0, -3.2); // cuccia morbida
    cyl(F0, .2, .25, .12, 0xFF7062, 5.4, 0, -.6); emo(F0, '🦴', 5.0, 0, -.4, .4);
    cyl(F0, .12, .12, 1.2, 0xD9B48A, 5.4, 0, -3.3); box(F0, .8, .1, .8, 0xFF8A65, 5.4, 1.2, -3.3);
    const cat = emo(F0, '🐈', 5.4, 1.3, -3.3, .8);
    anims.push((t) => { cat.position.y = 1.7 + Math.sin(t * 1.5) * .03; cat.material.rotation = Math.sin(t * .7) * .08; });
    box(F0, 1, .55, .45, 0x7FD6F5, 2.8, .6, -.3, { mat: glassMat }); box(F0, 1, .6, .45, 0x9A6A3F, 2.8, 0, -.3);
    const fish = emo(F0, '🐠', 2.8, .65, -.3, .35);
    anims.push((t) => { fish.position.x = 2.8 + Math.sin(t * 1.2) * .3; });

    /* ---- primo piano ---- */
    floorTile(F1, 'cameretta', -4, 0, 4, 8); floorTile(F1, 'emergenze', 4, 0, 4, 8);
    const sc = parseInt(rooms.find(r => r.id === 'scale').color.slice(1), 16);
    pick(box(F1, 2.6, .2, 8, sc, -.7, -.2, 0), 'scale');
    pick(box(F1, 1.2, .2, 4.2, sc, 1.2, -.2, -1.9), 'scale');
    pick(box(F1, .2, .2, 8, sc, 1.9, -.2, 0), 'scale');
    for (let z = .3; z < 3.6; z += .45) box(F1, .06, .9, .06, 0x9A6A3F, .55, 0, z, { ol: false }); // ringhiera della scala
    box(F1, .1, .08, 3.4, 0x9A6A3F, .55, .9, 1.95);
    w = extWall(F1, -6, 4, 6, 4, 0, 1); opening(w, -4, 1.4, 1.4, 1.1, 0xBDEBFF); opening(w, 0, 0, 1.2, 2.2, 0xBDEBFF); opening(w, 4, 1.4, 1.4, 1.1, 0xBDEBFF);
    w = extWall(F1, -6, -4, 6, -4, 0, -1); opening(w, -4, 1.4, 1.4, 1.1, 0xBDEBFF); opening(w, 4, 1.4, 1.4, 1.1, 0xBDEBFF);
    w = extWall(F1, -6, -4, -6, 4, -1, 0); opening(w, 0, 1.4, 1.4, 1.1, 0xBDEBFF);
    w = extWall(F1, 6, -4, 6, 4, 1, 0); opening(w, -3, 0, 1, 2.2, 0x8A94A8); // porta dell'ascensore
    lowWall(F1, -2, -4, -2, -.6); lowWall(F1, -2, .6, -2, 4);
    lowWall(F1, 2, -4, 2, -.6); lowWall(F1, 2, .6, 2, 4);
    // balcone
    pick(box(F1, 4, .2, 2, 0xE8D9BF, 0, -.2, 5), 'scale');
    for (let x = -1.9; x <= 1.95; x += .38) box(F1, .06, 1, .06, 0xffffff, x, 0, 5.95, { ol: false });
    box(F1, 4, .1, .12, 0xffffff, 0, 1, 5.95); box(F1, .1, .1, 2, 0xffffff, -1.95, 1, 5); box(F1, .1, .1, 2, 0xffffff, 1.95, 1, 5);
    emo(F1, '🪴', -1.4, 0, 5.3, .8); emo(F1, '🪑', 1.3, 0, 5.1, .8);
    emo(F1, '🪴', -1.2, 0, -3.3, .9); emo(F1, '🖼️', -1, 1.2, -3.85, .7);
    // cameretta
    box(F1, 1.2, .45, 2.2, 0x8E7CF0, -5.2, 0, -2.6); box(F1, 1.1, .2, .6, 0xffffff, -5.2, .45, -3.3);
    box(F1, 1.1, .1, 1.5, 0xFFC23D, -5.2, .45, -2.2, { ol: false });
    box(F1, 1.3, .7, .7, 0xFF7062, -3, 0, -3.5); emo(F1, '🧸', -3, .7, -3.5, .6);
    cyl(F1, 1.1, 1.1, .03, 0x7FD6F5, -4, 0, .2, { ol: false });
    emo(F1, '🧩', -4.2, 0, .3, .45); emo(F1, '🚂', -3.5, 0, .9, .5); emo(F1, '🎈', -2.6, .8, 2.8, .7);
    box(F1, .4, 1.6, 1.4, 0xFFFFFF, -5.75, 0, 2.6); emo(F1, '📚', -5.6, 1.6, 2.6, .5);
    const lamp = ball(F1, .18, 0xFFF3A0, -5.2, 1.2, -1.4, { ol: false });
    anims.push((t) => { lamp.scale.setScalar(1 + Math.sin(t * 3) * .1); });
    // emergenze / studio
    box(F1, 1.8, .75, .8, 0x9A6A3F, 4.3, 0, -3.4); emo(F1, '☎️', 3.8, .75, -3.4, .55); emo(F1, '📒', 4.8, .75, -3.4, .45);
    box(F1, .5, .45, .5, 0x4FA3F7, 4.3, 0, -2.6);
    box(F1, .8, .55, .35, 0xffffff, 5.7, 1.2, -1.2); box(F1, .06, .3, .1, 0xFF4D4D, 5.5, 1.32, -1.2, { ol: false }); box(F1, .06, .1, .3, 0xFF4D4D, 5.5, 1.42, -1.2, { ol: false });
    cyl(F1, .16, .16, .7, 0xFF4D4D, 2.4, 0, 3.4);
    const det = cyl(F1, .25, .25, .08, 0xffffff, 4, 2.9, 0);
    const detLed = ball(F1, .05, 0xFF4D4D, 4, 2.85, .18, { ol: false });
    anims.push((t) => { detLed.visible = (t % 2) < .2; });
    emo(F1, '🔦', 5.4, 0, 2.2, .5); emo(F1, '🗺️', 5.9, 1.4, 1.5, .7);
    box(F1, 1.6, .45, .8, 0x21A99A, 4.3, 0, 3.2); box(F1, 1.6, .5, .2, 0x21A99A, 4.3, .45, 3.55);

    /* ---- tetto, camino, fumo ---- */
    const roofMat = 0xE8604C;
    const slope = Math.atan2(2.4, 4.6), sl2 = Math.hypot(4.6, 2.4);
    for (const s of [1, -1]) {
      const r = box(ROOF, 13, .28, sl2 + .2, roofMat, 0, 0, 0);
      r.position.set(0, 6 + 1.2, s * 2.3); r.rotation.x = s * slope;
    }
    const tri = new THREE.Shape(); tri.moveTo(-4, 0); tri.lineTo(4, 0); tri.lineTo(0, 2.1); tri.lineTo(-4, 0);
    const gable = new THREE.Mesh(new THREE.ExtrudeGeometry(tri, { depth: 12, bevelEnabled: false }), M(WALL));
    gable.rotation.y = Math.PI / 2; gable.position.set(-6, 6, 0); ROOF.add(gable);
    box(ROOF, .8, 2.4, .8, 0xB0503F, 3.5, 6.6, -1.5);
    const smoke = [];
    for (let i = 0; i < 4; i++) { const s = ball(ROOF, .35, 0xEEEEEE, 3.5, 9, -1.5, { ol: false }); s.userData.o = i / 4; smoke.push(s); }
    anims.push((t) => {
      for (const s of smoke) {
        const k = (t * .25 + s.userData.o) % 1;
        s.position.set(3.5 + Math.sin(k * 6) * .3 + k * 1.2, 9.1 + k * 3, -1.5);
        s.scale.setScalar(.6 + k * 1.2);
      }
    });

    /* ---- torre dell'ascensore in vetro ---- */
    const L = group(scene, 7.3, 0, -3);
    pick(box(L, 2.2, 6.6, 2.2, 0xBDEBFF, 0, -.2, 0, { mat: glassMat }), 'ascensore');
    for (const [px, pz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) box(L, .14, 6.8, .14, 0x8A94A8, px, -.2, pz);
    box(L, 2.4, .2, 2.4, 0x8A94A8, 0, 6.4, 0);
    const cabin = group(L);
    pick(box(cabin, 1.6, 2.2, 1.6, 0xFFC23D, 0, 0, 0), 'ascensore');
    box(cabin, .06, 1.6, 1, 0xBDEBFF, -.82, .3, 0, { ol: false });
    anims.push((t) => { const k = (Math.sin(t * .5) + 1) / 2; cabin.position.y = Math.min(1, Math.max(0, k * 1.3 - .15)) * 3; });

    /* ---- selezione: anello che pulsa ---- */
    const selRing = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.5, 32), new THREE.MeshBasicMaterial({ color: 0xFFC23D, transparent: true, opacity: .9, side: THREE.DoubleSide }));
    selRing.rotation.x = -Math.PI / 2; selRing.visible = false; scene.add(selRing);
    anims.push((t) => { const s = 1 + Math.sin(t * 5) * .12; selRing.scale.set(s, s, s); });

    /* ================= PIN HTML ================= */
    const layer = document.createElement('div'); layer.className = 'h3d-layer'; el.appendChild(layer);
    const pins = {};
    for (const r of rooms) {
      const p = PLACES[r.id]; if (!p) continue;
      const b = document.createElement('button');
      b.className = 'pin'; b.dataset.room = r.id;
      b.innerHTML = opts.pinHTML ? opts.pinHTML(r) : r.emoji;
      b.style.setProperty('--c', r.color);
      b.addEventListener('click', (e) => { e.stopPropagation(); select(r.id); });
      layer.appendChild(b);
      pins[r.id] = { el: b, p, v: new THREE.Vector3(p.x, (p.f === 1 ? 3 : 0) + (p.y || 0) + 1.6, p.z) };
    }
    const charEl = document.createElement('div'); charEl.className = 'h3d-char'; layer.appendChild(charEl);

    /* ================= CAMERA ORBITALE ================= */
    const cam = { target: new THREE.Vector3(0, 1.5, 1), r: 30, th: .55, ph: 1.0 };
    let fly = null;
    function applyCam() {
      cam.ph = Math.min(1.42, Math.max(.22, cam.ph));
      cam.r = Math.min(70, Math.max(6, cam.r));
      const sp = Math.sin(cam.ph);
      camera.position.set(cam.target.x + cam.r * sp * Math.sin(cam.th), cam.target.y + cam.r * Math.cos(cam.ph), cam.target.z + cam.r * sp * Math.cos(cam.th));
      camera.lookAt(cam.target);
    }
    function flyTo(tx, ty, tz, r, th, ph) {
      const from = { x: cam.target.x, y: cam.target.y, z: cam.target.z, r: cam.r, th: cam.th, ph: cam.ph };
      // gira dalla parte più corta
      let dth = th - from.th; dth = Math.atan2(Math.sin(dth), Math.cos(dth));
      fly = { t: 0, from, to: { x: tx, y: ty, z: tz, r, th: from.th + dth, ph } };
    }

    const ptrs = new Map(); let down = null, lastPinch = null;
    const cv = renderer.domElement;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, b: e.button });
      if (ptrs.size === 1) down = { x: e.clientX, y: e.clientY, t: performance.now() };
      else down = null;
      lastPinch = null; fly = null;
    });
    cv.addEventListener('pointermove', (e) => {
      const p = ptrs.get(e.pointerId); if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (ptrs.size === 1) {
        if (p.b === 2 || e.shiftKey) pan(dx, dy);
        else { cam.th -= dx * .008; cam.ph -= dy * .006; }
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        if (lastPinch) { cam.r *= lastPinch.d / d; pan(mx - lastPinch.mx, my - lastPinch.my); }
        lastPinch = { d, mx, my };
      }
    });
    const up = (e) => {
      ptrs.delete(e.pointerId); lastPinch = null;
      if (down && ptrs.size === 0 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 8 && performance.now() - down.t < 450) tap(e);
      down = null;
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('wheel', (e) => { e.preventDefault(); fly = null; cam.r *= Math.exp(e.deltaY * .001); }, { passive: false });
    function pan(dx, dy) {
      const k = cam.r * .0018;
      const right = new THREE.Vector3(Math.cos(cam.th), 0, -Math.sin(cam.th));
      const fwd = new THREE.Vector3(Math.sin(cam.th), 0, Math.cos(cam.th));
      cam.target.addScaledVector(right, -dx * k).addScaledVector(fwd, -dy * k);
      cam.target.x = Math.max(-35, Math.min(30, cam.target.x));
      cam.target.z = Math.max(-25, Math.min(25, cam.target.z));
    }
    const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
    function tap(e) {
      const rc = cv.getBoundingClientRect();
      ndc.set(((e.clientX - rc.left) / rc.width) * 2 - 1, -((e.clientY - rc.top) / rc.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      const hits = ray.intersectObjects(pickables.filter(visibleDeep), false);
      for (const h of hits) { if (h.object.userData.room) { select(h.object.userData.room); return; } if (h.object.userData.room === null) return; }
    }
    function visibleDeep(o) { for (let x = o; x; x = x.parent) if (!x.visible) return false; return true; }

    /* ================= PIANI ================= */
    let floor = 'g';
    function setFloor(m, silent) {
      floor = m;
      F1.visible = m !== 'g';
      ROOF.visible = m === 'out';
      if (!silent && opts.onFloor) opts.onFloor(m);
    }
    let selected = null;
    function select(id, noFly) {
      const p = PLACES[id]; if (!p) return;
      selected = id;
      if (p.f === 0 && floor !== 'g') setFloor('g');
      if (p.f === 1 && floor !== '1') setFloor('1');
      const y = (p.f === 1 ? 3 : 0) + (p.y || 0);
      selRing.position.set(p.x, y + .03, p.z); selRing.visible = p.f >= 0;
      if (!noFly) flyTo(p.x, y + .8, p.z, p.r || 12, cam.th, p.f >= 0 ? .78 : .92);
      for (const k in pins) pins[k].el.classList.toggle('sel', k === id);
      if (opts.onSelect) opts.onSelect(id);
    }
    function overview() {
      selected = null; selRing.visible = false;
      for (const k in pins) pins[k].el.classList.remove('sel');
      // più lontano e più dall'alto della vista iniziale, così si vede tutta la casa con il cortile
      flyTo(0, 1.5, 1, 44, .55, .7);
    }

    /* ================= CICLO ================= */
    let running = false, raf = 0, last = 0, W = 0, Hh = 0;
    const tmp = new THREE.Vector3(), toCam = new THREE.Vector3();
    function resize() {
      const w2 = el.clientWidth, h2 = el.clientHeight;
      if (!w2 || !h2 || (w2 === W && h2 === Hh)) return;
      W = w2; Hh = h2;
      renderer.setSize(W, Hh, false);
      camera.aspect = W / Hh; camera.fov = W < Hh ? 52 : 40; camera.updateProjectionMatrix();
    }
    function frame(now) {
      if (!running) return;
      raf = requestAnimationFrame(frame);
      const t = now / 1000, dt = Math.min(.05, last ? t - last : 0); last = t;
      resize();
      if (fly) {
        fly.t = Math.min(1, fly.t + dt / .8);
        const k = fly.t < .5 ? 4 * fly.t ** 3 : 1 - (-2 * fly.t + 2) ** 3 / 2;
        const a = fly.from, b = fly.to, L2 = (u, v) => u + (v - u) * k;
        cam.target.set(L2(a.x, b.x), L2(a.y, b.y), L2(a.z, b.z));
        cam.r = L2(a.r, b.r); cam.th = L2(a.th, b.th); cam.ph = L2(a.ph, b.ph);
        if (fly.t >= 1) fly = null;
      }
      applyCam();
      for (const f of anims) f(t, dt);
      // spaccato automatico: nascondo i muri esterni rivolti verso la camera
      for (const wl of extWalls) {
        if (floor === 'out') { wl.visible = true; continue; }
        wl.getWorldPosition(tmp);
        toCam.copy(camera.position).sub(tmp);
        wl.visible = wl.userData.n.dot(toCam) < 0;
      }
      renderer.render(scene, camera);
      // pin
      for (const id in pins) {
        const pn = pins[id], f = pn.p.f;
        const show = f === -1 || (f === 0 && floor === 'g') || (f === 1 && floor === '1');
        tmp.copy(pn.v).project(camera);
        const on = show && tmp.z < 1 && Math.abs(tmp.x) < 1.15 && Math.abs(tmp.y) < 1.15;
        pn.el.style.display = on ? '' : 'none';
        if (on) pn.el.style.transform = `translate(${(tmp.x + 1) / 2 * W}px,${(1 - tmp.y) / 2 * Hh}px) translate(-50%,-100%)`;
        if (id === selected) {
          charEl.style.display = on ? '' : 'none';
          if (on) charEl.style.transform = `translate(${(tmp.x + 1) / 2 * W - 64}px,${(1 - tmp.y) / 2 * Hh}px) translate(-50%,-80%)`;
        }
      }
      if (!selected) charEl.style.display = 'none';
    }

    setFloor('g', true);
    applyCam();
    return {
      start() { if (running) return; running = true; last = 0; W = 0; raf = requestAnimationFrame(frame); },
      stop() { running = false; cancelAnimationFrame(raf); },
      select, overview, setFloor, getFloor: () => floor, getSelected: () => selected,
      setPin(id, html) { if (pins[id]) pins[id].el.innerHTML = html; },
      setChar(html) { charEl.innerHTML = html; },
    };
  }

  window.House3D = { create, PLACES };
})();
