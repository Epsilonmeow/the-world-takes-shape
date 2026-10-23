import * as THREE from '../vendor/three.module.js';

// The dimensions are compositional proportions; the physical story is a separate
// condensation chamber reached by a steam passage, rather than a new heat cycle.
const INK = 0x111412;
const BONE = 0xe9dfc9;
const COPPER = 0xff6032;
const TAU = Math.PI * 2;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (v) => { const x = clamp(v); return x * x * (3 - 2 * x); };
const mix = (a, b, x) => a + (b - a) * x;
const arcLength = Math.PI * 1.5;
const bendStart = 17;
const bendEnd = bendStart + arcLength;
const pathEnd = bendEnd + 14;
const Z = new THREE.Vector3(0, 0, 1);

function route(s) {
  if (s <= bendStart) return { p: new THREE.Vector3(0, 0, 8 - s), t: new THREE.Vector3(0, 0, -1) };
  if (s < bendEnd) {
    const a = (s - bendStart) / 3;
    return { p: new THREE.Vector3(3 - 3 * Math.cos(a), 0, -9 - 3 * Math.sin(a)), t: new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)) };
  }
  return { p: new THREE.Vector3(3 + s - bendEnd, 0, -12), t: new THREE.Vector3(1, 0, 0) };
}

function ringPoint(s, r, a) {
  const { p, t } = route(s);
  return p.add(new THREE.Vector3(-t.z * r * Math.cos(a), r * Math.sin(a), t.x * r * Math.cos(a)));
}

function lineGeometry(vertices) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  return g;
}

function addSegment(array, a, b) { array.push(a.x, a.y, a.z, b.x, b.y, b.z); }

function labelTexture(lines, accent = false) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, 1024, 256);
  c.fillStyle = accent ? '#ff6032' : '#e9dfc9';
  c.font = '700 68px Archivo, Arial, sans-serif';
  c.fillText(lines[0], 12, 90);
  c.font = '28px Consolas, monospace';
  if (lines[1]) c.fillText(lines[1], 14, 145);
  c.fillRect(14, 173, 976, 2);
  for (let i = 0; i < 30; i++) c.fillRect(14 + i * 33.5, 173, 1, i % 5 ? 9 : 20);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function createTunnel() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(INK);
  scene.fog = new THREE.Fog(INK, 14, 50);
  const camera = new THREE.PerspectiveCamera(74, 16 / 9, 0.05, 90);
  const lineMat = new THREE.LineBasicMaterial({ color: BONE, transparent: true, opacity: 0.72 });
  const lowLineMat = new THREE.LineBasicMaterial({ color: BONE, transparent: true, opacity: 0.17 });
  const copperMat = new THREE.LineBasicMaterial({ color: COPPER, transparent: true, opacity: 0.92 });
  const plateMat = new THREE.MeshBasicMaterial({ color: 0x20231d, side: THREE.DoubleSide });
  const darkMat = new THREE.MeshBasicMaterial({ color: 0x1a1d18, side: THREE.DoubleSide });

  // A missing upper sector makes this a sectioned physical passage, rather than
  // an abstract concentric tunnel. The elbow is built into the actual geometry.
  const positions = [], indices = [], details = [], faint = [], orange = [];
  const axial = 144, radial = 34, a0 = 2.52, a1 = TAU + 0.60;
  for (let j = 0; j <= axial; j++) {
    const s = pathEnd * j / axial;
    for (let i = 0; i <= radial; i++) {
      const p = ringPoint(s, 2.38, mix(a0, a1, i / radial));
      positions.push(p.x, p.y, p.z);
      if (i < radial && j < axial) {
        const k = j * (radial + 1) + i;
        indices.push(k, k + radial + 1, k + 1, k + 1, k + radial + 1, k + radial + 2);
      }
    }
  }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  shellGeo.setIndex(indices);
  const shell = new THREE.Mesh(shellGeo, plateMat);
  scene.add(shell);

  for (let n = 0; n < 18; n++) {
    const s = 0.6 + n * 2;
    for (const offset of [-0.055, 0.055]) {
      for (let i = 0; i < 72; i++) {
        addSegment(details, ringPoint(s + offset, 2.34, i / 72 * TAU), ringPoint(s + offset, 2.34, (i + 1) / 72 * TAU));
      }
    }
    for (let i = 0; i < 24; i++) {
      const a = i / 24 * TAU;
      addSegment(details, ringPoint(s, 2.24, a), ringPoint(s, 2.44, a));
      if (i % 3 === 0) {
        for (let side = 0; side < 6; side++) {
          const base = ringPoint(s, 2.51, a);
          const { t } = route(s);
          const normal = new THREE.Vector3(-t.z, 0, t.x);
          const point = (angle) => base.clone().addScaledVector(normal, Math.cos(angle) * 0.082).addScaledVector(new THREE.Vector3(0, 1, 0), Math.sin(angle) * 0.082);
          addSegment(details, point(side / 6 * TAU), point((side + 1) / 6 * TAU));
        }
      }
    }
  }
  for (let n = 0; n < 15; n++) {
    const angle = mix(a0, a1, n / 14);
    for (let j = 0; j < axial; j++) {
      addSegment(n === 0 || n === 14 ? details : faint, ringPoint(pathEnd * j / axial, 2.33, angle), ringPoint(pathEnd * (j + 1) / axial, 2.33, angle));
    }
  }
  // The orange seam is continuous through the ninety-degree change of direction.
  for (let j = 0; j < 160; j++) {
    addSegment(orange, ringPoint(pathEnd * j / 160, 2.27, 3.76), ringPoint(pathEnd * (j + 1) / 160, 2.27, 3.76));
  }
  scene.add(new THREE.LineSegments(lineGeometry(details), lineMat));
  scene.add(new THREE.LineSegments(lineGeometry(faint), lowLineMat));
  scene.add(new THREE.LineSegments(lineGeometry(orange), copperMat));
  const lipMat = new THREE.MeshBasicMaterial({ color: BONE });
  const flangeMat = new THREE.MeshBasicMaterial({ color: 0x393c31, side: THREE.DoubleSide });
  for (const s of [1.0, 7.0, 13.0, bendEnd + 2.5, bendEnd + 9.5]) {
    const { p, t } = route(s);
    const group = new THREE.Group();
    group.position.copy(p);
    group.quaternion.setFromUnitVectors(Z, t);
    const flange = new THREE.Mesh(new THREE.RingGeometry(2.23, 2.62, 72), flangeMat);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(2.24, 0.027, 5, 72), lipMat);
    const lipBack = new THREE.Mesh(new THREE.TorusGeometry(2.24, 0.012, 4, 72), lipMat);
    lipBack.position.z = 0.14;
    group.add(flange, lip, lipBack);
    scene.add(group);
  }

  // Section-plane markings live on the pipe itself and pass the camera.
  const labels = [];
  const addLabel = (lines, s, x, y, width, accent = false) => {
    const map = labelTexture(lines, accent);
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(width, width / 4), mat);
    const { p, t } = route(s);
    label.position.copy(p).add(new THREE.Vector3(-t.z * x, y, t.x * x));
    label.quaternion.setFromUnitVectors(Z, t.clone().negate());
    scene.add(label); labels.push(label);
    return label;
  };
  addLabel(['STEAM PASSAGE', 'CYLINDER → SEPARATE VESSEL'], 6.2, -0.45, 1.34, 2.4);
  addLabel(['SECTION A—A', 'INTERNAL WALL / HEAT RETAINED'], 11.8, 0.32, -1.46, 2.4);
  addLabel(['TURN', 'A DIFFERENT PATH.'], 16.7, -0.40, 1.34, 2.4, true);
  addLabel(['CONDENSATION', 'OUTSIDE THE WORKING CYLINDER'], bendEnd + 5.5, 0.25, 1.28, 2.3);

  // An annular condenser face and its cooler interior appear only after the turn.
  const vessel = new THREE.Group();
  vessel.position.set(17, 0, -12);
  scene.add(vessel);
  const face = new THREE.Mesh(new THREE.RingGeometry(3.9, 5.45, 96), darkMat);
  face.rotation.y = -Math.PI / 2;
  vessel.add(face);
  const inside = new THREE.Mesh(new THREE.CylinderGeometry(3.88, 3.88, 8.5, 64, 1, true), darkMat);
  inside.rotation.z = -Math.PI / 2;
  inside.position.x = 4.3;
  vessel.add(inside);
  const vesselLines = [], vesselFine = [];
  const vp = (x, r, a) => new THREE.Vector3(x, r * Math.cos(a), r * Math.sin(a));
  for (const x of [0, 0.18, 1.2, 3.6, 6.0, 8.5]) {
    for (const r of x < 0.2 ? [3.90, 4.08, 4.70, 5.42] : [3.86]) {
      for (let i = 0; i < 96; i++) addSegment(vesselLines, vp(x, r, i / 96 * TAU), vp(x, r, (i + 1) / 96 * TAU));
    }
  }
  for (let i = 0; i < 48; i++) {
    const a = i / 48 * TAU;
    addSegment(vesselLines, vp(-0.018, 4.18, a), vp(-0.018, 4.48, a));
    addSegment(vesselFine, vp(0.2, 3.84, a), vp(8.4, 3.84, a));
    if (i % 2 === 0) {
      const c = vp(-0.025, 4.94, a);
      for (let side = 0; side < 6; side++) {
        const pt = (ang) => c.clone().add(new THREE.Vector3(0, Math.cos(ang) * 0.13, Math.sin(ang) * 0.13));
        addSegment(vesselLines, pt(side / 6 * TAU), pt((side + 1) / 6 * TAU));
      }
    }
  }
  vessel.add(new THREE.LineSegments(lineGeometry(vesselLines), lineMat));
  vessel.add(new THREE.LineSegments(lineGeometry(vesselFine), lowLineMat));
  const condenserLabel = addLabel(['SEPARATE CONDENSER', 'STEAM → WATER / PRESSURE ↓'], bendEnd + 13.86, 0.15, 2.70, 5.9);
  condenserLabel.position.x = 16.94;

  // Cold-wall engraving is a hatch field, never a generic luminous portal.
  const hatches = [];
  for (let i = 0; i < 110; i++) {
    const a = i / 110 * TAU;
    addSegment(hatches, vp(0.01, 4.1, a), vp(0.01, 5.38, a + 0.057));
  }
  vessel.add(new THREE.LineSegments(lineGeometry(hatches), lowLineMat));
  const vesselLip = new THREE.Mesh(new THREE.TorusGeometry(3.91, 0.047, 6, 96), lipMat);
  vesselLip.rotation.y = Math.PI / 2;
  vesselLip.position.x = -0.035;
  vessel.add(vesselLip);

  const streamsCount = 180;
  const steamArray = new Float32Array(streamsCount * 6);
  const steamGeo = new THREE.BufferGeometry();
  steamGeo.setAttribute('position', new THREE.BufferAttribute(steamArray, 3).setUsage(THREE.DynamicDrawUsage));
  const steamMat = new THREE.LineBasicMaterial({ color: BONE, transparent: true, opacity: 0.69 });
  const steam = new THREE.LineSegments(steamGeo, steamMat);
  steam.frustumCulled = false;
  scene.add(steam);
  const chargeArray = new Float32Array(24 * 6);
  const chargeGeo = new THREE.BufferGeometry();
  chargeGeo.setAttribute('position', new THREE.BufferAttribute(chargeArray, 3).setUsage(THREE.DynamicDrawUsage));
  const charge = new THREE.LineSegments(chargeGeo, copperMat);
  charge.frustumCulled = false;
  scene.add(charge);

  const target = new THREE.Vector3();
  function update(t) {
    const u = clamp((t - 4.12) / 1.28);
    // Approach, decisive elbow, then spatial release. No orbit or idle rotation.
    let s;
    if (t < 4.58) s = mix(1.4, 16.1, smooth((t - 4.12) / 0.46));
    else if (t < 4.91) s = mix(16.1, 24.2, smooth((t - 4.58) / 0.33));
    else s = mix(24.2, 29.3, smooth((t - 4.91) / 0.49));
    const at = route(s);
    const ahead = route(s + mix(4.5, 3.2, u));
    const sway = Math.sin(u * Math.PI) * 0.23;
    camera.position.copy(at.p).add(new THREE.Vector3(0, 0.21 + sway, 0));
    target.copy(ahead.p).add(new THREE.Vector3(0, -0.12, 0));
    camera.up.set(0, 1, 0);
    camera.lookAt(target);
    const bank = Math.sin(smooth((t - 4.57) / 0.38) * Math.PI) * -0.16;
    camera.rotateZ(bank);
    camera.fov = mix(74, 85, smooth((t - 4.47) / 0.2)) - 7 * smooth((t - 5.02) / 0.38);
    camera.updateProjectionMatrix();

    for (let i = 0; i < streamsCount; i++) {
      const frac = ((i * 0.61803398875) % 1);
      const pos = ((i * 0.931 + (t - 4.12) * (13 + frac * 8)) % (pathEnd - 0.6) + pathEnd - 0.6) % (pathEnd - 0.6);
      const r = 0.37 + ((i * 0.381966) % 1) * 1.54;
      const angle = i * 2.399963 + Math.sin(pos * 0.15) * 0.06;
      const a = ringPoint(pos, r, angle);
      const b = ringPoint(Math.min(pathEnd, pos + 0.25 + frac * 0.86), r * 0.997, angle + 0.008);
      steamArray.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    }
    steamGeo.attributes.position.needsUpdate = true;
    for (let i = 0; i < 24; i++) {
      const pos = ((i * 1.913 + (t - 4.12) * 17.5) % (pathEnd - 1) + pathEnd - 1) % (pathEnd - 1);
      const a = ringPoint(pos, 1.93, 3.76 + (i % 3) * 0.025);
      const b = ringPoint(pos + 0.7, 1.93, 3.76 + (i % 3) * 0.025);
      chargeArray.set([a.x, a.y, a.z, b.x, b.y, b.z], i * 6);
    }
    chargeGeo.attributes.position.needsUpdate = true;
    vessel.visible = true;
    steamMat.opacity = 0.59 + smooth((t - 4.72) / 0.3) * 0.15;
  }
  function resize(w, h) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  function dispose() {
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      for (const m of o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : []) {
        materials.add(m); if (m.map) textures.add(m.map);
      }
    });
    for (const v of geometries) v.dispose();
    for (const v of materials) v.dispose();
    for (const v of textures) v.dispose();
  }
  update(4.12);
  return { scene, camera, update, resize, dispose };
}
