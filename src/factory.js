import * as THREE from '../vendor/three.module.js';

// A deterministic production hall. The same song time always yields the same frame.
export function createFactory() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080e15');
  scene.fog = new THREE.FogExp2('#080e15', 0.0085);
  const camera = new THREE.PerspectiveCamera(60, 16 / 9, 0.12, 450);
  const resources = [];
  const keep = x => (resources.push(x), x);
  const metal = keep(new THREE.MeshStandardMaterial({color: '#52606a', metalness: 0.72, roughness: 0.38}));
  const darkMetal = keep(new THREE.MeshStandardMaterial({color: '#192932', metalness: 0.65, roughness: 0.6}));
  const ivory = keep(new THREE.MeshStandardMaterial({color: '#e8dfc8', metalness: 0.5, roughness: 0.32}));
  const orange = keep(new THREE.MeshStandardMaterial({color: '#ff662b', emissive: '#ff4c13', emissiveIntensity: 1.5, roughness: 0.5}));
  const floorMaterial = keep(new THREE.MeshStandardMaterial({color: '#101a23', metalness: 0.35, roughness: 0.77}));
  const lineMaterial = keep(new THREE.LineBasicMaterial({color: '#d8d3be', transparent: true, opacity: 0.52}));
  const mutedLineMaterial = keep(new THREE.LineBasicMaterial({color: '#597481', transparent: true, opacity: 0.48}));
  const boxGeometry = keep(new THREE.BoxGeometry(1, 1, 1));
  const cylinderGeometry = keep(new THREE.CylinderGeometry(1, 1, 1, 12));
  const rimGeometry = keep(new THREE.TorusGeometry(1.52, 0.13, 8, 36));
  const tmp = new THREE.Object3D();
  const p = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const unitY = new THREE.Vector3(0, 1, 0);
  const staticBoxes = [];
  const linePositions = [];
  const mutedLines = [];
  const stations = [];
  const rowXs = [-18, -8, 8, 18];
  const rows = rowXs.length;
  const stationCount = 8;

  scene.add(new THREE.HemisphereLight('#cdd9e5', '#17202a', 2.1));
  const sun = new THREE.DirectionalLight('#fff1cc', 3.4);
  sun.position.set(-26, 38, 16);
  scene.add(sun);
  const fill = new THREE.DirectionalLight('#6a9daf', 1.7);
  fill.position.set(32, 11, -60);
  scene.add(fill);
  const hotLight = new THREE.PointLight('#ff713b', 95, 27, 2);
  hotLight.position.set(-8, 4, -23);
  scene.add(hotLight);

  function line(a, b, dest = linePositions) { dest.push(...a, ...b); }
  function box(x, y, z, sx, sy, sz, outlined = false) {
    staticBoxes.push([x, y, z, sx, sy, sz]);
    if (outlined) {
      const a = sx / 2, b = sy / 2, c = sz / 2;
      const corners = [[-a,-b,-c],[a,-b,-c],[a,b,-c],[-a,b,-c],[-a,-b,c],[a,-b,c],[a,b,c],[-a,b,c]];
      for (const [i,j] of [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]]) {
        line([x+corners[i][0], y+corners[i][1], z+corners[i][2]], [x+corners[j][0], y+corners[j][1], z+corners[j][2]]);
      }
    }
  }
  function setInstance(mesh, i, x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
    tmp.position.set(x,y,z); tmp.scale.set(sx,sy,sz); tmp.rotation.set(rx,ry,rz);
    tmp.updateMatrix(); mesh.setMatrixAt(i,tmp.matrix);
  }
  function instances(geometry, material, count) {
    const mesh = new THREE.InstancedMesh(geometry, material, count);
    // Moving assemblies and a camera that crosses the scene require conservative culling.
    mesh.frustumCulled = false;
    scene.add(mesh);
    return mesh;
  }
  function lineMesh(data, material) {
    const geometry = keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data, 3));
    const mesh = new THREE.LineSegments(geometry, material);
    scene.add(mesh);
    return mesh;
  }
  function beam(a, b, width = 0.12) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
    const mesh = new THREE.Mesh(boxGeometry, metal);
    p.copy(av).add(bv).multiplyScalar(0.5);
    q.setFromUnitVectors(unitY, bv.clone().sub(av).normalize());
    mesh.position.copy(p); mesh.quaternion.copy(q); mesh.scale.set(width, av.distanceTo(bv), width);
    scene.add(mesh);
    line(a,b);
  }

  // The floor is open at the roof: the crane move can reveal the complete live system.
  const floor = new THREE.Mesh(boxGeometry, floorMaterial);
  floor.position.set(0, -0.36, -46); floor.scale.set(65, 0.5, 155); scene.add(floor);
  const railwayBed = new THREE.Mesh(boxGeometry, floorMaterial);
  railwayBed.position.set(32.5,-.34,-66); railwayBed.scale.set(7,.5,180); scene.add(railwayBed);
  for(let z = -118; z < 32; z += 4) {
    line([-30, -0.095, z], [30, -0.095, z], mutedLines);
  }
  for(let x = -30; x <= 30; x += 4) {
    line([x, -0.095, 30], [x, -0.095, -122], mutedLines);
  }
  // Portal frames and diagonals: long, vanishing-point lines rather than a solid roof.
  for(let i = 0; i < 10; i++) {
    const z = 18 - i * 13;
    for(const x of [-26,26]) {
      box(x, 7.1, z, 0.55, 14.4, 0.55, true);
      box(x, 0.2, z, 1.4, 0.5, 1.4);
    }
    beam([-26,14.1,z], [0,18,z], .22);
    beam([0,18,z], [26,14.1,z], .22);
    beam([-26,13.5,z], [26,13.5,z], .17);
    for(let x = -24; x < 24; x += 6) {
      const topA = 18 - Math.abs(x) * 3.9 / 26;
      const topB = 18 - Math.abs(x + 6) * 3.9 / 26;
      line([x,13.5,z], [x+6,topB,z]);
      line([x,topA,z], [x+6,13.5,z]);
    }
    if(i < 9) {
      for(const x of [-26,-13,0,13,26]) {
        const y = 18 - Math.abs(x) * 3.9 / 26;
        line([x,y,z], [x,y,z-13]);
      }
      for(const x of [-26,26]) {
        line([x,1,z], [x,12,z-13], mutedLines);
        line([x,12,z], [x,1,z-13], mutedLines);
      }
    }
  }

  // Four genuinely connected production lines. The centre aisle stays readable.
  for(let row = 0; row < rows; row++) {
    const x = rowXs[row];
    for(const dx of [-1.3,1.3]) box(x+dx, 1.02, -45, .18, .32, 110, true);
    for(let z = 6; z > -100; z -= 6) {
      for(const dx of [-1.3,1.3]) box(x+dx, .4, z, .23, 1.0, .35);
    }
    // Long overhead line shaft supplies successive presses via belt loops.
    box(x + 2.3, 7.8, -45, .16, .16, 112, true);
    for(let j = 0; j < stationCount; j++) {
      const z = -2-j*12;
      const side = row < 2 ? 1 : -1;
      const wx = x + side * 2.5;
      stations.push({x,z,wx,row,j,phase:j*0.6+row*0.42});
      box(x, .22, z, 4.2, .5, 3.5, true);
      for(const dx of [-1.78,1.78]) {
        box(x+dx, 3.0, z, .42, 5.7, .72, true);
        box(x+dx, 4.9, z, .73, .3, 1.2);
      }
      box(x,5.9,z,4.15,.74,1.1,true);
      box(x,1.23,z,2.8,.26,1.65,true);
      box(wx,3.6,z,.32,.35,3.6);
      // Side casing, fasteners, a feed hopper and its supporting brackets.
      box(x + side * 2.7,.85,z-2.3,1.4,1.45,1.4,true);
      box(x,2.2,z+2.6,3.1,.13,1.8,true);
      for(const dx of [-1.6,1.6]) {
        box(x+dx,1.55,z+2.6,.13,1.4,.15);
        for(const yy of [1.1,2.5,4.1,5.6]) box(x+dx,yy,z+.42,.23,.23,.12);
      }
      const topX = x + 2.3;
      // Two taut belt runs and pulley outline connect shaft to flywheel.
      line([topX,7.8,z-.48],[wx,3.9,z-1.48]);
      line([topX,7.8,z+.48],[wx,3.9,z+1.48]);
      line([topX,8.15,z-.48],[topX,8.15,z+.48]);
      box(topX,8.5,z,.3,1.25,.25);
      line([topX,9.1,z], [topX,14.8,z], mutedLines);
    }
  }
  // Rails extend beyond the building; finished material leaves as a moving train.
  for(const x of [31,34]) box(x,.07,-65,.17,.15,170,true);
  for(let z=17;z>-150;z-=2) box(32.5,-.02,z,5,.2,.28);
  for(let i=0;i<8;i++) {
    const z=-4-i*12;
    // Walkways and cross-line feeders make the hall a network, not isolated objects.
    box(0,6.65,z,51,.22,1.1,true);
    line([-25,7.7,z-.5], [25,7.7,z-.5], mutedLines);
    line([-25,7.7,z+.5], [25,7.7,z+.5], mutedLines);
    for(let x=-24;x<=24;x+=4) {
      line([x,6.7,z-.5],[x,7.7,z-.5], mutedLines);
      line([x,6.7,z+.5],[x,7.7,z+.5], mutedLines);
    }
  }

  const staticMesh = instances(boxGeometry, darkMetal, staticBoxes.length);
  staticBoxes.forEach((a,i)=>setInstance(staticMesh,i,...a));
  staticMesh.instanceMatrix.needsUpdate = true;
  lineMesh(linePositions,lineMaterial);
  lineMesh(mutedLines,mutedLineMaterial);

  const n = stations.length;
  const rims = instances(rimGeometry, ivory, n);
  const spokes = instances(boxGeometry, metal, n*6);
  const hubs = instances(cylinderGeometry, ivory, n);
  const rams = instances(boxGeometry, ivory, n);
  const rods = instances(cylinderGeometry, metal, n);
  const eccentrics = instances(boxGeometry, orange, n);
  stations.forEach((s,i)=>{
    setInstance(rims,i,s.wx,3.9,s.z,1,1,1,0,Math.PI/2,0);
    setInstance(hubs,i,s.wx,3.9,s.z,.28,.67,.28,0,0,Math.PI/2);
  });
  rims.instanceMatrix.needsUpdate = true;
  hubs.instanceMatrix.needsUpdate = true;

  const rollerCount = 78;
  const rollers = instances(cylinderGeometry, metal, rows*rollerCount);
  for(let row=0;row<rows;row++) for(let i=0;i<rollerCount;i++) {
    setInstance(rollers,row*rollerCount+i,rowXs[row],1.15,10-i*1.4,.22,2.45,.22,0,0,Math.PI/2);
  }
  rollers.instanceMatrix.needsUpdate = true;
  const billetCount = 30;
  const billets = instances(boxGeometry, orange, rows*billetCount);
  const indicatorBars = instances(boxGeometry, orange, rows*stationCount);
  const wagons = instances(boxGeometry, metal, 9);
  const wagonLoads = instances(boxGeometry, ivory, 27);
  const wheels = instances(cylinderGeometry, darkMetal, 36);
  const sparkCount = n*12;
  const sparkPositions = new Float32Array(sparkCount*3);
  const sparkGeometry = keep(new THREE.BufferGeometry());
  sparkGeometry.setAttribute('position',new THREE.BufferAttribute(sparkPositions,3));
  const sparkMaterial = keep(new THREE.PointsMaterial({color:'#ffb276',size:.13,sizeAttenuation:true,transparent:true,opacity:.9,depthWrite:false}));
  const sparks = new THREE.Points(sparkGeometry,sparkMaterial);
  sparks.frustumCulled=false; scene.add(sparks);

  const cameraTarget = new THREE.Vector3();
  const clamp = (x,a=0,b=1)=>Math.min(b,Math.max(a,x));
  const smooth = x=>{x=clamp(x);return x*x*(3-2*x);};
  const mix = (a,b,x)=>a+(b-a)*x;
  const mod = (x,n)=>((x%n)+n)%n;

  function update(t,aspect=16/9) {
    const time=clamp(t,0,6.8);
    camera.aspect=aspect;
    if(time<1.8) {
      const u=time/1.8;
      camera.position.set(.7*Math.sin(u*1.6),mix(4.5,3.5,u),mix(24,-9,u));
      cameraTarget.set(-.5,3.5,mix(-20,-39,u));
      camera.fov=mix(66,76,u);
    } else if(time<3.4) {
      const u=smooth((time-1.8)/1.6);
      // An immediate change in direction exposes the power transmission of one bay.
      camera.position.set(mix(-1,-13,u),mix(3.5,4.9,u),mix(-9,-27,u));
      cameraTarget.set(mix(-15,-8,u),mix(3.6,3.0,u),mix(-18,-39,u));
      camera.fov=mix(76,62,u);
    } else if(time<5) {
      const u=(time-3.4)/1.6;
      camera.position.set(mix(-13,-12,u),4.9+Math.sin(u*Math.PI)*1.5,mix(-27,-62,u));
      cameraTarget.set(-8,2.8,mix(-39,-78,u));
      camera.fov=62+8*Math.sin(u*Math.PI);
    } else {
      const u=smooth((time-5)/1.8);
      camera.position.set(mix(-12,64,u),mix(4.9,62,u),mix(-62,34,u));
      cameraTarget.set(mix(-8,3,u),mix(2.8,0,u),mix(-78,-43,u));
      camera.fov=mix(62,57,u);
    }
    camera.lookAt(cameraTarget);
    camera.updateProjectionMatrix();

    for(let i=0;i<n;i++) {
      const s=stations[i];
      const angle=time*7.0-s.phase;
      const press=Math.pow(Math.max(0,Math.sin(angle)),8);
      const ramY=3.45-1.72*press;
      setInstance(rams,i,s.x,ramY,s.z,2.6,.68,1.4);
      const rodLength=5.5-(ramY+.34);
      setInstance(rods,i,s.x,ramY+.34+rodLength/2,s.z,.16,rodLength,.16);
      for(let j=0;j<6;j++) {
        const a=angle+j*Math.PI/3;
        setInstance(spokes,i*6+j,s.wx,3.9+Math.cos(a)*.75,s.z+Math.sin(a)*.75,.16,1.55,.14,a,0,0);
      }
      setInstance(eccentrics,i,s.wx+.21,3.9+Math.cos(angle)*1.1,s.z+Math.sin(angle)*1.1,.12,.31,.31,angle,0,0);
      const glow=1.2+Math.pow(Math.max(0,Math.sin(angle-.5)),2)*1.8;
      setInstance(indicatorBars,i,s.x,1.55,s.z+2.9,2.4,.035,glow*.2);
      for(let k=0;k<12;k++) {
        const life=mod(time*7.0-s.phase-Math.PI/2,Math.PI*2)/7.0;
        const active=life<.21;
        const a=(k*2.39996+i*.63);
        const r=life*(5+(k%4)*2);
        const pos=(i*12+k)*3;
        sparkPositions[pos]=s.x+Math.cos(a)*r;
        sparkPositions[pos+1]=active?1.43+life*(5+(k%3)*2)-life*life*20:-100;
        sparkPositions[pos+2]=s.z+Math.sin(a)*r;
      }
    }
    // Material visibly advances down the line and grows flatter after processing.
    for(let row=0;row<rows;row++) for(let i=0;i<billetCount;i++) {
      const phase=time*5.7+i*3.7+row*.9;
      const z=10-mod(phase,111);
      const finished=clamp((-z-10)/75);
      setInstance(billets,row*billetCount+i,rowXs[row],1.49,z,mix(1.9,1.48,finished),mix(.34,.16,finished),mix(1.15,1.9,finished));
    }
    // Long loaded wagons advance out of the nave and into the wider rail network.
    for(let i=0;i<9;i++) {
      const z=15-i*8-time*8.5;
      setInstance(wagons,i,32.5,.9,z,4,.65,6.6);
      for(let k=0;k<3;k++) setInstance(wagonLoads,i*3+k,31.4+k*1.1,1.6,z,.68,.7,5.9);
      for(let k=0;k<4;k++) {
        setInstance(wheels,i*4+k,32.5+(k<2?-1.7:1.7),.48,z+(k%2===0?-2.15:2.15),.52,.25,.52,0,0,Math.PI/2);
      }
    }
    for(const mesh of [rams,rods,spokes,eccentrics,indicatorBars,billets,wagons,wagonLoads,wheels]) mesh.instanceMatrix.needsUpdate=true;
    sparkGeometry.attributes.position.needsUpdate=true;
    hotLight.intensity=75+Math.pow(Math.max(0,Math.sin(time*7-.6)),12)*170;
  }

  update(0);
  return {scene,camera,update,dispose(){
    scene.traverse(object=>{if(object.isInstancedMesh)object.dispose();});
    for(const resource of resources) resource.dispose();
  }};
}
