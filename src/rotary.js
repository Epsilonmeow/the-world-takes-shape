import * as THREE from '../vendor/three.module.js';

const INK = 0x151917, BONE = 0xe9e2d2, ORANGE = 0xff6237;
const TAU = Math.PI * 2, Z = new THREE.Vector3(0, 0, 1);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const mix = (a, b, p) => a + (b - a) * p;
const v3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const modulo = (v, n) => ((v % n) + n) % n;

function stroke(points, material, closed = false) {
  const p = points.map(p => Array.isArray(p) ? v3(...p) : p);
  if (closed) p.push(p[0].clone());
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(p), material);
}
function arc(radius, a, b, z = 0, count = 100) {
  return Array.from({length: count + 1}, (_, i) => {
    const angle = mix(a, b, i / count);
    return v3(Math.cos(angle) * radius, Math.sin(angle) * radius, z);
  });
}
function disc(radius, depth, material, sides = 64) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, depth, sides), material);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
function ring(outer, inner, depth, material, count = 120) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, TAU, false);
  const hole = new THREE.Path(); hole.absarc(0, 0, inner, 0, TAU, true); shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled:true, bevelSize:0.035, bevelThickness:0.025, bevelSegments:1, steps:1, curveSegments:count / 4});
  geo.translate(0, 0, -depth / 2);
  return new THREE.Mesh(geo, material);
}
function box(x, y, z, material) { return new THREE.Mesh(new THREE.BoxGeometry(x, y, z), material); }
function between(a, b, width, depth, material) {
  const mesh = box(width, a.distanceTo(b), depth, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(v3(0, 1, 0), b.clone().sub(a).normalize());
  return mesh;
}
function labelTexture(title, sub, accent = false, compact = false) {
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = compact ? 180 : 256;
  const c = canvas.getContext('2d');
  c.fillStyle = accent ? '#ff6237' : '#e9e2d2';
  c.font = '750 76px Archivo, Arial, sans-serif';
  c.fillText(title, 8, 86);
  c.font = '28px Consolas, monospace';
  if (sub) c.fillText(sub, 11, 139);
  if (!compact) {
    c.fillRect(10, 175, 985, 2);
    for (let i = 0; i < 40; i++) c.fillRect(10 + i * 25, 176, 1, i % 5 === 0 ? 16 : 7);
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}
function textPlane(title, sub, width, accent = false, compact = false) {
  const texture = labelTexture(title, sub, accent, compact);
  const material = new THREE.MeshBasicMaterial({map:texture, transparent:true, depthWrite:false, side:THREE.DoubleSide});
  return new THREE.Mesh(new THREE.PlaneGeometry(width, width * (compact ? 180 : 256) / 1024), material);
}

// A working involute profile: both gears share one pitch radius and tooth count.
// The sun's profile is half a pitch out of phase; its object's angle is therefore
// exactly 2*carrier - planet, without an unlabelled kinematic correction.
function gearGeometry(radius, teeth, depth, profilePhase = 0) {
  const module = radius * 2 / teeth;
  const base = radius * Math.cos(Math.PI / 9);
  const root = radius - 1.25 * module, tip = radius + module;
  const inv = r => { const a = Math.acos(Math.min(1, base / r)); return Math.tan(a) - a; };
  const invPitch = inv(radius), halfTooth = Math.PI / (2 * teeth), pitch = TAU / teeth;
  const shape = new THREE.Shape(); let first = true;
  const at = (r, a) => { const x = Math.cos(a) * r, y = Math.sin(a) * r; if (first) {shape.moveTo(x, y); first = false;} else shape.lineTo(x, y); };
  for (let n = 0; n < teeth; n++) {
    const center = n * pitch + profilePhase;
    at(root, center - pitch * .5);
    at(root, center - halfTooth - invPitch);
    for (let i = 0; i <= 5; i++) {
      const r = mix(Math.max(base, root), tip, i / 5);
      at(r, center - halfTooth - invPitch + inv(r));
    }
    for (let i = 5; i >= 0; i--) {
      const r = mix(Math.max(base, root), tip, i / 5);
      at(r, center + halfTooth + invPitch - inv(r));
    }
    at(root, center + halfTooth + invPitch);
    at(root, center + pitch * .5);
  }
  shape.closePath();
  // Six actual pierced spaces expose the dark cast body behind the teeth.
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU + .16, b = (i + 1) / 6 * TAU - .16;
    const hole = new THREE.Path();
    hole.moveTo(Math.cos(a) * .7, Math.sin(a) * .7);
    hole.lineTo(Math.cos(a) * (root - .27), Math.sin(a) * (root - .27));
    hole.absarc(0, 0, root - .27, a, b, false);
    hole.lineTo(Math.cos(b) * .7, Math.sin(b) * .7);
    hole.absarc(0, 0, .7, b, a, true); hole.closePath(); shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {depth, bevelEnabled:true, bevelSize:.028, bevelThickness:.024, bevelSegments:1, curveSegments:20, steps:1});
  geo.translate(0, 0, -depth / 2); return geo;
}

export function createRotary() {
  const scene = new THREE.Scene(); scene.background = new THREE.Color(INK);
  scene.fog = new THREE.Fog(INK, 28, 95);
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, .035, 180);
  const bone = new THREE.MeshStandardMaterial({color:BONE, roughness:.52, metalness:.12});
  const iron = new THREE.MeshStandardMaterial({color:0x353c34, roughness:.7, metalness:.15});
  const ironFace = new THREE.MeshStandardMaterial({color:0x697163, roughness:.62, metalness:.15});
  const dark = new THREE.MeshStandardMaterial({color:0x232a24, roughness:.84, metalness:.02});
  const orange = new THREE.MeshStandardMaterial({color:ORANGE, roughness:.57, metalness:.06});
  const paleLine = new THREE.LineBasicMaterial({color:BONE, transparent:true, opacity:.76});
  const fineLine = new THREE.LineBasicMaterial({color:BONE, transparent:true, opacity:.30});
  const faintLine = new THREE.LineBasicMaterial({color:BONE, transparent:true, opacity:.14});
  const orangeLine = new THREE.LineBasicMaterial({color:ORANGE, transparent:true, opacity:.96});
  const litOrange = new THREE.MeshBasicMaterial({color:ORANGE});
  scene.add(new THREE.HemisphereLight(0xe9e2d2, 0x0a100c, 2.05));
  const key = new THREE.DirectionalLight(0xfff1d3, 3.5); key.position.set(-10, 14, 20); scene.add(key);
  const grazing = new THREE.DirectionalLight(0xe9e2d2, 1.3); grazing.position.set(22, -7, 5); scene.add(grazing);

  const gearStage = new THREE.Group(); scene.add(gearStage);
  const pitchR = 2.1, distance = pitchR * 2, teeth = 28;
  const sun = new THREE.Group(), planet = new THREE.Group(), carrier = new THREE.Group();
  gearStage.add(carrier, sun, planet);
  const sunGeo = gearGeometry(pitchR, teeth, .48, -Math.PI / teeth);
  const planetGeo = gearGeometry(pitchR, teeth, .48);
  sun.add(new THREE.Mesh(sunGeo, [bone, ironFace]));
  planet.add(new THREE.Mesh(planetGeo, [ironFace, iron]));
  sun.add(new THREE.LineSegments(new THREE.EdgesGeometry(sunGeo, 25), fineLine));
  planet.add(new THREE.LineSegments(new THREE.EdgesGeometry(planetGeo, 25), paleLine));
  function hub(group, accent = false) {
    const outer = disc(.67, .7, accent ? orange : iron); outer.position.z = .13; group.add(outer);
    const cap = disc(.41, .15, bone); cap.position.z = .55; group.add(cap);
    const boss = disc(.18, .19, dark, 6); boss.position.z = .67; group.add(boss);
    for (let i = 0; i < 6; i++) {
      const bolt = disc(.064, .11, dark, 6); bolt.position.set(Math.cos(i / 6 * TAU) * .51, Math.sin(i / 6 * TAU) * .51, .51); group.add(bolt);
    }
    for (const r of [1.74, 1.79]) group.add(stroke(arc(r, 0, TAU, .273), fineLine));
    const index = box(.35, .032, .02, litOrange); index.position.set(1.25, 0, .29); group.add(index);
    // Spoke-side maker's notches follow the object, not a screen overlay.
    for (let i = 0; i < 6; i++) {
      const marker = box(.24, .015, .014, bone); const a = i / 6 * TAU;
      marker.position.set(Math.cos(a) * .98, Math.sin(a) * .98, .285); marker.rotation.z = a + Math.PI / 2; group.add(marker);
    }
  }
  hub(sun, true); hub(planet);
  const sunShaft = disc(.29, 3.4, iron); sunShaft.position.z = -1.4; sun.add(sunShaft);
  const carrierArm = box(distance + .35, .35, .24, dark); carrierArm.position.set(distance / 2, 0, -.5); carrier.add(carrierArm);
  const carrierEdge = box(distance, .025, .028, bone); carrierEdge.position.set(distance / 2, -.18, -.34); carrier.add(carrierEdge);
  const rod = new THREE.Group(); planet.add(rod); // Rod and planet have a rigid angular relationship.
  const rodBar = box(.31, 7.2, .22, ironFace); rodBar.position.set(0, 4.1, .52); rod.add(rodBar);
  const rodEdge = box(.025, 7.0, .01, bone); rodEdge.position.set(-.13, 4.1, .645); rod.add(rodEdge);
  const rodKey = box(.39, .65, .32, iron); rodKey.position.set(0, 1.35, .51); rod.add(rodKey);
  const rodPin = disc(.115, .12, bone); rodPin.position.set(0, 1.35, .74); rod.add(rodPin);
  const rodName = textPlane('CONNECTING ROD', 'OSCILLATING INPUT', 3.25, false, true); rodName.position.set(1.84, 4.6, .72); rod.add(rodName);

  const backing = box(52, 38, .2, dark); backing.position.set(.8, .4, -1.85); gearStage.add(backing);
  const drafting = new THREE.Group(); drafting.position.z = -1.68; gearStage.add(drafting);
  // The reference field is visibly a laid-out mechanism: bearing bores, orbit,
  // construction tangencies, center dimensions, and a radius gauge.
  drafting.add(stroke(arc(distance, -.25, TAU - .25, 0), faintLine));
  drafting.add(stroke(arc(pitchR, 0, TAU, .05), faintLine));
  for (let i = 0; i < 72; i++) {
    const a = i / 72 * TAU;
    drafting.add(stroke([v3(Math.cos(a) * 4.52, Math.sin(a) * 4.52), v3(Math.cos(a) * (i % 6 ? 4.6 : 4.75), Math.sin(a) * (i % 6 ? 4.6 : 4.75))], fineLine));
  }
  for (let i = -20; i <= 20; i++) {
    drafting.add(stroke([[-27, i, 0], [27, i, 0]], faintLine));
    if (i !== 0) drafting.add(stroke([[i, -20, 0], [i, 20, 0]], faintLine));
  }
  drafting.add(stroke([[-8, 0, .01], [9, 0, .01]], fineLine));
  drafting.add(stroke([[0, -7, .01], [0, 8, .01]], fineLine));
  const equalLabel = textPlane('Nₛ = Nₚ', 'EQUAL PITCH / EXTERNAL CONTACT', 4.6); equalLabel.position.set(-4.4, -4.15, -.8); gearStage.add(equalLabel);
  const orbitLabel = textPlane('ONE ORBIT.', 'TWO TURNS OF THE SUN.', 4.6, true); orbitLabel.position.set(4.5, -3.9, -.8); gearStage.add(orbitLabel);
  const driveLabel = textPlane('SUN', 'OUTPUT SHAFT', 2.2, true, true); driveLabel.position.set(-.5, -.92, .75); sun.add(driveLabel);
  const planetLabel = textPlane('PLANET', 'HELD BY THE ROD', 2.5, false, true); planetLabel.position.set(.02, -.92, .77); planet.add(planetLabel);
  // Contact witness marks sit at the instantaneous pitch point.
  const witness = new THREE.Group(); gearStage.add(witness);
  for (const k of [-1, 1]) {
    witness.add(stroke([[0, k * .23, .55], [0, k * .62, .55]], orangeLine));
    witness.add(stroke([[-.22, k * .62, .55], [.22, k * .62, .55]], orangeLine));
  }
  const contactName = textPlane('PITCH POINT', 'NO SLIP AT CONTACT', 2.3, true, true); contactName.position.set(1.55, -.65, .58); witness.add(contactName);
  const angleArcGeometry = new THREE.BufferGeometry(); angleArcGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(60 * 3), 3));
  const angleArc = new THREE.Line(angleArcGeometry, orangeLine); gearStage.add(angleArc);
  const radiusLineGeometry = new THREE.BufferGeometry(); radiusLineGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
  const radiusLine = new THREE.Line(radiusLineGeometry, orangeLine); radiusLine.position.z = .79; gearStage.add(radiusLine);
  const centreName = textPlane('rₛ + rₚ', 'DISTANCE BETWEEN CENTRES', 3.5, false, true);
  centreName.position.set(-4.6, 3.7, -.8); gearStage.add(centreName);
  const toothName = textPlane('COMMON NORMAL', 'INVOLUTE FLANK / PITCH TANGENCY', 4.2, false, true);
  toothName.position.set(4.5, 4.8, -.8); gearStage.add(toothName);
  const relationName = textPlane('θₛ = 2θc − θₚ', 'THE ROD HOLDS THE PLANET.', 4.7, true, true);
  relationName.position.set(4.65, 2.9, -.8); gearStage.add(relationName);
  const angleCanvas = document.createElement('canvas'); angleCanvas.width = 1024; angleCanvas.height = 256;
  const angleContext = angleCanvas.getContext('2d'), angleMap = new THREE.CanvasTexture(angleCanvas);
  angleMap.colorSpace = THREE.SRGBColorSpace;
  const angleReadout = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 1.2), new THREE.MeshBasicMaterial({map:angleMap,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
  angleReadout.position.set(-4.9, .8, -.75); gearStage.add(angleReadout);
  const centreLeader = stroke([[-3.4,3.2,-.7],[-2.6,2.7,-.7],[-1.2,2.7,-.7]],fineLine);gearStage.add(centreLeader);

  // The second composition shares the same output axis but enters at a vastly
  // larger radius. Thick rim, hubs, cast spokes and flange bolts carry the weight.
  const wheelStage = new THREE.Group(); wheelStage.position.set(24, 0, 0); scene.add(wheelStage);
  const wheel = new THREE.Group(); wheelStage.add(wheel);
  wheel.add(ring(7.35, 6.47, .82, [ironFace, iron]));
  wheel.add(ring(7.29, 7.17, .91, [bone, iron]));
  wheel.add(ring(6.6, 6.48, .87, [bone, iron]));
  for (const r of [6.88, 6.95, 7.03]) wheel.add(stroke(arc(r, 0, TAU, .47), fineLine));
  const rimMarks = new THREE.Group(); wheel.add(rimMarks);
  for (let i = 0; i < 96; i++) {
    const a = i / 96 * TAU;
    const mark = box(i % 8 ? .07 : .16, .017, .012, i % 8 ? iron : bone);
    mark.position.set(Math.cos(a) * 6.99, Math.sin(a) * 6.99, .49); mark.rotation.z = a; rimMarks.add(mark);
    if (i % 12 === 0) {
      const bolt = disc(.09, .1, iron, 6); bolt.position.set(Math.cos(a) * 6.75, Math.sin(a) * 6.75, .52); wheel.add(bolt);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = i / 8 * TAU;
    const spoke = box(5.9, .44, .47, ironFace); spoke.position.set(Math.cos(a) * 3.6, Math.sin(a) * 3.6, -.025); spoke.rotation.z = a; wheel.add(spoke);
    const ridge = box(5.65, .055, .08, bone); ridge.position.set(Math.cos(a) * 3.6, Math.sin(a) * 3.6, .24); ridge.rotation.z = a; wheel.add(ridge);
    const taper = box(.95, .75, .49, iron); taper.position.set(Math.cos(a) * 6.12, Math.sin(a) * 6.12, .01); taper.rotation.z = a; wheel.add(taper);
  }
  const wheelHub = disc(1.2, 1.3, iron); wheel.add(wheelHub);
  const wheelFlange = disc(.93, .25, bone); wheelFlange.position.z = .79; wheel.add(wheelFlange);
  const wheelBoss = disc(.54, .45, ironFace); wheelBoss.position.z = 1.1; wheel.add(wheelBoss);
  const wheelKey = box(.72, .17, .14, orange); wheelKey.position.set(.06, .21, 1.36); wheel.add(wheelKey);
  for (let i = 0; i < 8; i++) {
    const b = disc(.085, .16, dark, 6); b.position.set(Math.cos(i / 8 * TAU) * .73, Math.sin(i / 8 * TAU) * .73, .95); wheel.add(b);
  }
  const shaft = disc(.38, 5.2, ironFace); shaft.position.z = -2.3; wheelStage.add(shaft);
  const bearing = new THREE.Group(); bearing.position.set(0, 0, -3.0); wheelStage.add(bearing);
  const housing = box(1.4, 1.5, .72, iron); bearing.add(housing);
  const bearingRing = ring(.7, .4, .8, bone); bearing.add(bearingRing);
  const pedestal = box(1.6, 2.9, .9, dark); pedestal.position.y = -2.1; bearing.add(pedestal);
  for (let side of [-1, 1]) { const foot = disc(.09, .17, bone, 6); foot.position.set(side * .54, -.55, .49); bearing.add(foot); }
  const wheelPlate = textPlane('CARRY THE STROKE.', 'MOMENTUM / CONTINUOUS ROTATION', 7.1, false, false); wheelPlate.position.set(-2.2, -4.1, -1.9); wheelStage.add(wheelPlate);
  const flyName = textPlane('FLYWHEEL', 'STORED MOTION', 4.2, true, true); flyName.position.set(3.5, 2.1, -.8); wheelStage.add(flyName);
  // An orange reference stripe crosses the actual rotating rim.
  const activeRim = box(.75, .16, .025, orange); activeRim.position.set(6.94, 0, .49); wheel.add(activeRim);
  const fixedTicks = new THREE.Group(); wheelStage.add(fixedTicks);
  for (let i = 0; i < 20; i++) {
    const a = -.68 + i * .027;
    fixedTicks.add(stroke([v3(Math.cos(a) * 7.55, Math.sin(a) * 7.55, .02), v3(Math.cos(a) * (i % 5 ? 7.66 : 7.82), Math.sin(a) * (i % 5 ? 7.66 : 7.82), .02)], fineLine));
  }
  const energyName=textPlane('E = ½Iω²', 'ENERGY IN ROTATION',3.35,false,true);energyName.position.set(5.5,-4.2,-.4);wheelStage.add(energyName);
  const axleName=textPlane('KEYED SHAFT', 'ONE AXIS / SHARED ROTATION',3.8,false,true);axleName.position.set(-2.4,1.9,-1.7);wheelStage.add(axleName);

  // True flat belt, with two straight runs joined by pulley wraps. Its two edges
  // remain parallel in Z; it is never substituted with a cable or a glowing tube.
  const beltStage = new THREE.Group(); scene.add(beltStage);
  const A = v3(24, 0, -1.7), B = v3(42, 5, -1.7), rA = 2.15, rB = 1.3;
  const d = Math.hypot(B.x - A.x, B.y - A.y), baseAngle = Math.atan2(B.y - A.y, B.x - A.x);
  const tangentAngle = Math.acos((rA - rB) / d), upper = baseAngle + tangentAngle, lower = baseAngle - tangentAngle;
  const point = (c, r, a) => v3(c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c.z);
  const aTop = point(A, rA, upper), bTop = point(B, rB, upper), aLow = point(A, rA, lower), bLow = point(B, rB, lower);
  const lineLength = aTop.distanceTo(bTop), bWrap = (upper - lower) * rB, aWrap = (TAU - upper + lower) * rA;
  const beltLength = lineLength * 2 + bWrap + aWrap;
  function beltAt(s) {
    s = modulo(s, beltLength);
    if (s < lineLength) return aTop.clone().lerp(bTop, s / lineLength);
    s -= lineLength;
    if (s < bWrap) return point(B, rB, upper - s / rB);
    s -= bWrap;
    if (s < lineLength) return bLow.clone().lerp(aLow, s / lineLength);
    s -= lineLength;
    return point(A, rA, lower - s / rA);
  }
  const leatherCanvas = document.createElement('canvas'); leatherCanvas.width = 2048; leatherCanvas.height = 128;
  const lc = leatherCanvas.getContext('2d'); lc.fillStyle = '#675c43'; lc.fillRect(0, 0, 2048, 128);
  lc.fillStyle = '#8d8061';
  for (let i = 0; i < 180; i++) { const y = (i * 37.13) % 128; lc.fillRect((i * 107.41) % 2048, y, 50 + (i % 23) * 2, .7); }
  lc.strokeStyle = '#c1b48c'; lc.lineWidth = 1.5;
  for (let x = 0; x < 2048; x += 18) { lc.beginPath(); lc.moveTo(x, 8); lc.lineTo(x + 5, 8); lc.moveTo(x, 120); lc.lineTo(x + 5, 120); lc.stroke(); }
  // One stitched joint per circuit makes actual travel particularly legible.
  lc.fillStyle = '#332f27'; lc.fillRect(30, 0, 11, 128);
  lc.strokeStyle = '#e9e2d2'; lc.lineWidth = 2;
  for (let y = 12; y < 122; y += 12) {lc.beginPath();lc.moveTo(20, y-4);lc.lineTo(53, y+4);lc.stroke();}
  lc.fillStyle = '#ff6237'; lc.fillRect(52, 43, 11, 42);
  lc.font = 'bold 24px Archivo'; lc.fillStyle = '#e0d5b8'; lc.fillText('DRIVE', 155, 78);
  const leatherMap = new THREE.CanvasTexture(leatherCanvas); leatherMap.colorSpace = THREE.SRGBColorSpace; leatherMap.wrapS = THREE.RepeatWrapping; leatherMap.anisotropy = 8;
  const leather = new THREE.MeshStandardMaterial({map:leatherMap, roughness:.92, metalness:0, side:THREE.DoubleSide});
  const beltVertices = [], beltNormals = [], beltUV = [], beltIndices = [], beltSections = 360, halfWidth = .46;
  for (let i = 0; i <= beltSections; i++) {
    const s = i / beltSections * beltLength, p = beltAt(s), next = beltAt(s + .005);
    const tangent = next.clone().sub(p).normalize(), n = v3(-tangent.y, tangent.x, 0);
    for (let side = 0; side < 2; side++) {
      beltVertices.push(p.x, p.y, p.z + (side ? halfWidth : -halfWidth));
      beltNormals.push(n.x, n.y, 0); beltUV.push(i / beltSections, side);
    }
    if (i < beltSections) { const j = i * 2; beltIndices.push(j, j + 1, j + 2, j + 1, j + 3, j + 2); }
  }
  const beltGeo = new THREE.BufferGeometry(); beltGeo.setAttribute('position', new THREE.Float32BufferAttribute(beltVertices, 3)); beltGeo.setAttribute('normal', new THREE.Float32BufferAttribute(beltNormals, 3)); beltGeo.setAttribute('uv', new THREE.Float32BufferAttribute(beltUV, 2)); beltGeo.setIndex(beltIndices);
  const belt = new THREE.Mesh(beltGeo, leather); beltStage.add(belt);
  for (const side of [-halfWidth, halfWidth]) {
    const points = Array.from({length:361}, (_,i) => {const p = beltAt(i / 360 * beltLength); p.z += side; return p;});
    beltStage.add(stroke(points, fineLine));
  }
  function pulley(center, radius) {
    const group = new THREE.Group(); group.position.copy(center); beltStage.add(group);
    group.add(ring(radius, radius - .2, .85, [ironFace, iron]));
    for (const side of [-1, 1]) { const lip = ring(radius + .035, radius - .025, .045, bone); lip.position.z = side * .44; group.add(lip); }
    group.add(disc(.36, 1.25, bone));
    for (let i=0;i<6;i++) {
      const a=i/6*TAU, spoke=box(radius-.18,.17,.38,ironFace);spoke.position.set(Math.cos(a)*(radius*.5),Math.sin(a)*(radius*.5),0);spoke.rotation.z=a;group.add(spoke);
      const b=disc(.055,.13,dark,6);b.position.set(Math.cos(a)*.26,Math.sin(a)*.26,.69);group.add(b);
    }
    const index=box(.22,.07,.02,orange);index.position.set(radius-.09,0,.48);group.add(index); return group;
  }
  const drivePulley = pulley(A,rA), drivenPulley=pulley(B,rB);
  const beltName=textPlane('TRANSMIT.', 'TENSION → ROTATION',5.6,true);beltName.position.set(33,5.6,-1.08);beltStage.add(beltName);
  const returnName=textPlane('RETURN RUN', 'SAME BELT / OPPOSITE DIRECTION',3.7,false,true);returnName.position.set(32,-.8,-1.03);beltStage.add(returnName);
  const arrowMeshes=[];
  for(let i=0;i<10;i++){
    const arrow=new THREE.Group();
    arrow.add(stroke([[0,0,0],[-.25,-.17,0],[-.25,.17,0],[0,0,0]],orangeLine));
    beltStage.add(arrow);arrowMeshes.push(arrow);
  }

  // A side entry into the transmission room, followed by an axial reveal.
  // Every distant shaft collar and roof bay gives the final turn a parallax cue.
  const hall=new THREE.Group();scene.add(hall);
  const masonry=new THREE.MeshStandardMaterial({color:0x292f29,roughness:1});
  const overhead=new THREE.MeshStandardMaterial({color:0x393e33,roughness:.91});
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,90),dark);floor.rotation.x=-Math.PI/2;floor.position.set(43,-3,-28);hall.add(floor);
  // Wall has an actual aperture around the moving belt, not a camera clipping trick.
  const wallUpper=box(.7,4.4,16,masonry);wallUpper.position.set(35,9.5,-2);hall.add(wallUpper);
  const wallLower=box(.7,6.0,16,masonry);wallLower.position.set(35,-1.4,-2);hall.add(wallLower);
  for(const z of [-7.5,5.5]){const side=box(.7,5.6,5,masonry);side.position.set(35,4.4,z);hall.add(side);}
  const openingEdge=[[[34.62,1.6,-5],[34.62,7.3,-5]],[[34.62,7.3,-5],[34.62,7.3,3]],[[34.62,7.3,3],[34.62,1.6,3]]];
  for(const p of openingEdge)hall.add(stroke(p,fineLine));
  // Brick courses avoid a featureless contemporary tunnel.
  for(let y=-3;y<12;y+=.42){
    for(const a of [[-10,-5],[3,6]])hall.add(stroke([[34.63,y,a[0]],[34.63,y,a[1]]],faintLine));
    if(y>7.4||y<1.5)hall.add(stroke([[34.63,y,-5],[34.63,y,3]],faintLine));
  }
  const lineShaft=disc(.24,64,ironFace);lineShaft.position.set(42,5,-29.5);hall.add(lineShaft);
  const shaftEdge=stroke([[41.83,5.15,2.4],[41.83,5.15,-61]],paleLine);hall.add(shaftEdge);
  const shaftTurning=new THREE.Group();shaftTurning.position.set(42,5,0);hall.add(shaftTurning);
  for(let z=-5;z>=-59;z-=6){
    const collar=disc(.36,.24,bone);collar.position.z=z;shaftTurning.add(collar);
    const screw=box(.11,.10,.13,orange);screw.position.set(.28,0,z+.15);shaftTurning.add(screw);
  }
  for(let z=2;z>=-60;z-=6){
    const postLeft=box(.38,10,.38,iron),postRight=box(.38,10,.38,iron);
    postLeft.position.set(36.5,2,z);postRight.position.set(49.2,2,z);hall.add(postLeft,postRight);
    const beam=box(13.7,.46,.46,overhead);beam.position.set(42.8,7.0,z);hall.add(beam);
    hall.add(between(v3(36.5,6.7,z),v3(39,7.7,z),.21,.28,iron));hall.add(between(v3(49.2,6.7,z),v3(46.7,7.7,z),.21,.28,iron));
    const hanger=box(.16,1.7,.2,ironFace);hanger.position.set(42,6.1,z);hall.add(hanger);
    const bearingEye=ring(.44,.27,.37,[bone,iron]);bearingEye.position.set(42,5,z);hall.add(bearingEye);
    const transverse=stroke([[36.7,-2.99,z],[49,-2.99,z]],faintLine);hall.add(transverse);
    for(const x of [36.5,49.2]){
      const base=box(.75,.21,.75,iron);base.position.set(x,-2.9,z);hall.add(base);
      const bolt=disc(.08,.12,bone,6);bolt.rotation.x=0;bolt.position.set(x+.24,-2.73,z+.24);hall.add(bolt);
    }
  }
  for(const x of [36.5,39,42,45,49.2])hall.add(stroke([[x,7.25,3],[x,7.25,-63]],fineLine));
  const wallFar=box(.25,10,68,masonry);wallFar.position.set(50.3,2,-28);hall.add(wallFar);
  const shaftName=textPlane('LINE SHAFT', 'POWER CAN TRAVEL.',5.1,false);shaftName.position.set(45.3,6.05,-7);hall.add(shaftName);
  const shaftCallout=stroke([[42.05,5.28,-6.9],[43.3,6,-6.9],[43.9,6,-6.9]],orangeLine);hall.add(shaftCallout);
  const farName=textPlane('MOTION, DISTRIBUTED.', 'THE NEXT CONNECTION.',6.7,true);farName.position.set(43.3,3.1,-28);hall.add(farName);

  const target=v3(), up=v3(0,1,0), cameraStart=v3(), cameraEnd=v3();
  function setCamera(position,look,fov,bank=0){camera.position.copy(position);target.copy(look);camera.up.copy(up);camera.lookAt(target);camera.rotateZ(bank);camera.fov=fov;camera.updateProjectionMatrix();}
  function carrierAngle(t){return -.47-(t-10)*1.64-.035*Math.sin((t-10)*TAU/0.686);}
  function wheelAngle(t){return .31-(t-12.4)*2.28-.028*Math.sin((t-12.4)*TAU/.686);}
  function update(t){
    const a=carrierAngle(t),pa=.075*Math.sin(a);
    const px=Math.cos(a)*distance,py=Math.sin(a)*distance;
    carrier.rotation.z=a;planet.position.set(px,py,0);planet.rotation.z=pa;sun.rotation.z=2*a-pa;
    witness.position.set(Math.cos(a)*pitchR,Math.sin(a)*pitchR,0);witness.rotation.z=a;
    const aa=angleArcGeometry.attributes.position.array;
    for(let i=0;i<60;i++){const angle=mix(-.47,a,i/59);aa.set([Math.cos(angle)*3.62,Math.sin(angle)*3.62,.74],i*3);}
    angleArcGeometry.attributes.position.needsUpdate=true;
    radiusLineGeometry.attributes.position.array.set([0,0,0,px,py,0]);radiusLineGeometry.attributes.position.needsUpdate=true;
    const degrees=x=>(x*180/Math.PI).toFixed(1)+'°';
    angleContext.clearRect(0,0,1024,256);angleContext.fillStyle='#e9e2d2';angleContext.font='26px Consolas, monospace';
    angleContext.fillText('ANGULAR DISPLACEMENT / COMMON DATUM',10,34);
    angleContext.font='500 48px Archivo, Arial, sans-serif';
    angleContext.fillText('CARRIER  '+degrees(a),10,98);
    angleContext.fillStyle='#ff6237';angleContext.fillText('SUN  '+degrees(2*a-pa),10,160);
    angleContext.fillStyle='#e9e2d2';angleContext.font='26px Consolas, monospace';angleContext.fillText('PLANET  '+degrees(pa)+'  / ROD ANGLE',10,213);
    angleMap.needsUpdate=true;
    const wa=wheelAngle(t);wheel.rotation.z=wa;
    const beltTravel=(t-12.4)*rA*2.28+.028*rA*Math.sin((t-12.4)*TAU/.686);
    drivePulley.rotation.z=wa;drivenPulley.rotation.z=-beltTravel/rB+.31;shaftTurning.rotation.z=drivenPulley.rotation.z;
    leatherMap.offset.x=-beltTravel/beltLength;
    for(let i=0;i<arrowMeshes.length;i++){
      const s=modulo(beltTravel+i*beltLength/arrowMeshes.length,beltLength),p=beltAt(s),p2=beltAt(s+.01);
      arrowMeshes[i].position.copy(p);arrowMeshes[i].position.z+=.52;arrowMeshes[i].rotation.z=Math.atan2(p2.y-p.y,p2.x-p.x);
      arrowMeshes[i].visible=t>14.65&&i%2===0;
    }
    gearStage.visible=t<12.44;wheelStage.visible=t>=12.25;beltStage.visible=t>=12.4;hall.visible=t>=14.8;
    if(t<12.4){
      const u=clamp((t-10)/2.4);
      if(t<10.76){
        const q=smooth((t-10)/.76),contact=v3(Math.cos(a)*pitchR,Math.sin(a)*pitchR,0);
        setCamera(contact.clone().add(v3(mix(.9,1.15,q),mix(-.4,.62,q),mix(2.35,4.5,q))),contact.clone().add(v3(-.12,.12,0)),mix(51,57,q),mix(-.17,-.06,q));
      }else if(t<11.74){
        const q=smooth((t-10.76)/.98);
        const follow=v3(px*.42,py*.42,.1);
        setCamera(v3(mix(3.2,-1.0,q),mix(1.8,1.6,q),mix(7.0,13.8,q)),follow,58,mix(-.05,.11,q));
      }else{
        const q=smooth((t-11.74)/.66), toothAngle=2*a-pa-.35;
        const tooth=v3(Math.cos(toothAngle)*pitchR,Math.sin(toothAngle)*pitchR,.3);
        cameraStart.set(-1.0,1.6,13.8);cameraEnd.copy(tooth).add(v3(.22,.02,.33));
        setCamera(cameraStart.clone().lerp(cameraEnd,q),v3(px*.42,py*.42,.1).lerp(tooth.clone().add(v3(0,0,-.2)),q),mix(58,75,q),mix(.11,-.21,q));
      }
      orbitLabel.visible=t>10.9;equalLabel.visible=t>10.45;
      centreName.visible=t>10.4;toothName.visible=t>10.75;relationName.visible=t>11.1;angleReadout.visible=t>10.85;centreLeader.visible=t>10.4;
    }else if(t<14.8){
      const u=clamp((t-12.4)/2.4);
      if(t<13.19){
        const q=smooth((t-12.4)/.79);
        setCamera(v3(mix(30.75,29.1,q),mix(.5,3.35,q),mix(1.55,6.1,q)),v3(mix(30.95,28,q),mix(.0,1.9,q),0),mix(68,62,q),mix(-.2,.08,q));
      }else{
        const q=smooth((t-13.19)/1.61);
        setCamera(v3(mix(29.1,28.3,q),mix(3.35,3.9,q),mix(6.1,9.5,q)),v3(mix(28,26.8,q),mix(1.9,.55,q),mix(0,-.3,q)),mix(62,68,q),mix(.08,-.10,q));
      }
      wheelPlate.visible=t>13.1;flyName.visible=t>12.88;
    }else{
      const u=clamp((t-14.8)/2.3);
      if(t<15.54){
        const q=smooth((t-14.8)/.74),p=aTop.clone().lerp(bTop,.13+.43*q);
        setCamera(p.clone().add(v3(-2.9,.66,1.23)),p.clone().add(v3(6.2,.25,-.18)),mix(71,79,q),mix(-.17,-.06,q));
      }else if(t<16.11){
        const q=smooth((t-15.54)/.57),p=aTop.clone().lerp(bTop,.56+.32*q);
        setCamera(p.clone().add(v3(-2.9,.66,1.23)),p.clone().add(v3(5.6,-.15,-.3)),79,mix(-.06,.02,q));
      }else{
        const q=smooth((t-16.11)/.99);
        const entry=aTop.clone().lerp(bTop,.88);
        cameraStart.copy(entry).add(v3(-2.9,.66,1.23));cameraEnd.set(39.5,4.65,-9.2);
        const lookStart=entry.clone().add(v3(5.6,-.15,-.3)),lookEnd=v3(42.2,5,-35);
        setCamera(cameraStart.clone().lerp(cameraEnd,q),lookStart.lerp(lookEnd,q),mix(79,72,q),mix(.02,0,q));
      }
      beltName.visible=t<16.0;returnName.visible=t<15.75;
    }
    return {stage:t<12.4?'sun-and-planet':t<14.8?'flywheel':'flat-belt-and-shaft',carrierAngle:a,planetAngle:pa,sunAngle:2*a-pa,wheelAngle:wa,beltTravel};
  }
  function resize(w,h){camera.aspect=w/h;camera.updateProjectionMatrix();}
  function dispose(){
    const geometries=new Set(),materials=new Set(),textures=new Set();
    scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){materials.add(m);for(const v of Object.values(m))if(v?.isTexture)textures.add(v);}});
    for(const g of geometries)g.dispose();for(const t of textures)t.dispose();for(const m of materials)m.dispose();
  }
  update(10);
  return {scene,camera,update,resize,dispose};
}
