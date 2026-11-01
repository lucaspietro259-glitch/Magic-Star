// Cena 3D do hero: a estrela metalizada do "Magic Star", balões nas cores
// da fachada (vermelho, azul e amarelo) e confetes. A cena ocupa só a área
// das fotos em arco; as posições são relativas ao quadro visível, então a
// mesma composição serve no computador e no celular.
import * as THREE from 'three';

export async function startHero(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  camera.position.set(0, 0, 12);

  // Ambiente claro de "céu aberto" para os reflexos do metal e dos balões
  const pmrem = new THREE.PMREMGenerator(renderer);
  const env = new THREE.Scene();
  env.background = new THREE.Color('#fff1cc');
  const panel = (color, pos, size, k) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(...pos); m.lookAt(0, 0, 0); env.add(m);
  };
  panel('#ffffff', [-5, 6, 6], [8, 5], 3.2);
  panel('#ffe08a', [7, 1, 3], [5, 7], 2);
  panel('#ffffff', [0, -6, 5], [12, 3], 1.2);
  panel('#ffd36b', [0, 0, -8], [16, 10], 0.8);
  scene.environment = pmrem.fromScene(env, 0.035).texture;
  scene.add(new THREE.HemisphereLight('#ffffff', '#c9e6ff', 0.45));
  const key = new THREE.DirectionalLight('#fff4dc', 1.4);
  key.position.set(-3, 5, 8);
  scene.add(key);

  // Estrela "inflada", como balão metalizado
  const starShape = (outer, inner) => {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? inner : outer;
      const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      i ? s.lineTo(Math.cos(a) * r, Math.sin(a) * r) : s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    return s;
  };
  const foilGeo = new THREE.ExtrudeGeometry(starShape(1, 0.46), { depth: 0.05, bevelEnabled: true, bevelThickness: 0.32, bevelSize: 0.2, bevelSegments: mobile ? 6 : 10, curveSegments: 4 });
  foilGeo.center();
  const gold = new THREE.MeshPhysicalMaterial({ color: '#ffb300', metalness: 0.75, roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08, emissive: '#7a4a00', emissiveIntensity: 0.15 });

  // Balão: perfil de gota girado
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const t = i / 28, a = t * Math.PI;
    const r = Math.sin(a) * (0.78 + 0.22 * t) * (t < 0.14 ? 0.45 + t * 3.9 : 1);
    pts.push(new THREE.Vector2(Math.max(r, 0.03), -Math.cos(a) * 1.15));
  }
  const balloonGeo = new THREE.LatheGeometry(pts, mobile ? 32 : 48);
  const knotGeo = new THREE.ConeGeometry(0.1, 0.18, 12);
  const balloonMat = (c) => new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.32, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.12, envMapIntensity: 0.55 });
  const stringMat = new THREE.LineBasicMaterial({ color: '#10224f', transparent: true, opacity: 0.35 });

  // Posições em fração do quadro visível: [x, y] de -1 a 1, z, escala
  const items = [];
  const add = (obj, nx, ny, z, s, kind) => { obj.scale.setScalar(s); obj.userData = { nx, ny, z, s, kind, phase: items.length * 1.37 }; scene.add(obj); items.push(obj); };

  const star = new THREE.Mesh(foilGeo, gold);
  add(star, -0.8, 0.12, 1.5, mobile ? 0.8 : 0.85, 'star');
  [[-0.05, 0.92, -2, 0.28], [0.95, 0.15, -1, 0.24], [-0.92, -0.35, 0, 0.2]].forEach(([x, y, z, s]) => add(new THREE.Mesh(foilGeo, gold), x, y, z, s, 'mini'));

  [['#ee3b33', -0.92, 0.78, 0.5, 0.48], ['#1c8fd6', 0.78, 0.78, -1, 0.5], ['#ffd028', 0.9, -0.42, -1.5, 0.46], ['#ee3b33', 0.36, 0.98, -3, 0.36], ['#1c8fd6', -0.64, -0.82, 1, 0.38]]
    .forEach(([c, x, y, z, s]) => {
      const g = new THREE.Group();
      const m = balloonMat(c);
      const body = new THREE.Mesh(balloonGeo, m); body.rotation.x = Math.PI;
      const knot = new THREE.Mesh(knotGeo, m); knot.position.y = -1.22;
      const curve = new THREE.CatmullRomCurve3([0, 1, 2, 3, 4].map((k) => new THREE.Vector3(Math.sin(k * 1.4 + x * 3) * 0.12, -1.3 - k * 0.55, 0)));
      g.add(body, knot, new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(24)), stringMat));
      add(g, x, y, z, s, 'balloon');
    });

  // Confetes
  const COUNT = mobile ? 36 : 70;
  const confetti = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.1, 0.17), new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, roughness: 0.5, metalness: 0.3 }), COUNT);
  const palette = ['#ffd028', '#ee3b33', '#1c8fd6', '#ffffff', '#10224f'].map((c) => new THREE.Color(c));
  const cd = Array.from({ length: COUNT }, (_, i) => ({ x: Math.random() * 2 - 1, y: Math.random() * 2.4 - 1.2, z: -Math.random() * 6 + 1, rx: Math.random() * 6, ry: Math.random() * 6, vy: 0.12 + Math.random() * 0.2, vr: 0.6 + Math.random() * 1.6, sw: Math.random() * 6 }));
  cd.forEach((_, i) => confetti.setColorAt(i, palette[i % palette.length]));
  scene.add(confetti);
  const dummy = new THREE.Object3D();

  let hw = 4, hh = 4;
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
    hh = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * 0.86;
    hw = hh * camera.aspect;
  };
  resize();
  addEventListener('resize', resize);

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => { pointer.tx = (e.clientX / innerWidth - 0.5) * 2; pointer.ty = (e.clientY / innerHeight - 0.5) * 2; }, { passive: true });
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

  const clock = new THREE.Clock();
  let intro = 0;
  const loop = () => {
    requestAnimationFrame(loop);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;
    intro = Math.min(1, intro + dt * 0.55);
    const e = 1 - Math.pow(1 - intro, 3);
    const sk = Math.min(1, scrollY / innerHeight);

    pointer.x += (pointer.tx - pointer.x) * 0.05;
    pointer.y += (pointer.ty - pointer.y) * 0.05;

    items.forEach((o) => {
      const { nx, ny, z, s, kind, phase } = o.userData;
      const depth = 1 + z * 0.12; // objetos mais perto se movem mais com o mouse
      o.position.set(
        nx * hw + Math.sin(t * 0.5 + phase) * 0.15 + pointer.x * 0.35 * depth,
        ny * hh + Math.sin(t * 0.7 + phase) * 0.22 - pointer.y * 0.25 * depth - (1 - e) * 6 + sk * (kind === 'balloon' ? 3.5 : 2),
        z,
      );
      if (kind === 'balloon') { o.rotation.z = Math.sin(t * 0.6 + phase) * 0.12; o.rotation.y = t * 0.25 + phase; }
      else {
        o.rotation.y = (kind === 'star' ? 0.5 : 1) * Math.sin(t * 0.6 + phase) * 0.9 + pointer.x * 0.6;
        o.rotation.x = -pointer.y * 0.3;
        o.rotation.z = Math.sin(t * 0.4 + phase) * 0.15;
        o.scale.setScalar(s * Math.max(0.001, e));
      }
    });
    cd.forEach((c, i) => {
      c.y -= c.vy * dt;
      if (c.y < -1.25) { c.y = 1.25; c.x = Math.random() * 2 - 1; }
      c.rx += c.vr * dt; c.ry += c.vr * 0.7 * dt;
      dummy.position.set(c.x * hw * 1.1 + Math.sin(t + c.sw) * 0.2, c.y * hh, c.z);
      dummy.rotation.set(c.rx, c.ry, 0);
      dummy.scale.setScalar(e);
      dummy.updateMatrix();
      confetti.setMatrixAt(i, dummy.matrix);
    });
    confetti.instanceMatrix.needsUpdate = true;
    renderer.render(scene, camera);
  };
  renderer.compile(scene, camera);
  loop();
}
