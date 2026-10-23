import * as THREE from '../vendor/three.module.js';

// A six-second, song-time-driven journey from one live route to a whole territory.
// Every transform is derived from t, so scrubbing and offline frames agree.
export function createNetwork() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#080e15');
  scene.fog = new THREE.FogExp2('#080e15', 0.0045);
  const camera = new THREE.PerspectiveCamera(56, 16 / 9, 0.08, 800);
  const ivory = 0xe8dfc8, orange = 0xff662b, gold = 0xffca6a;
  const body = new THREE.MeshStandardMaterial({color:0x172737, metalness:0.45, roughness:0.64});
  const roofMat = new THREE.MeshStandardMaterial({color:0x273e4b, metalness:0.65, roughness:0.45});
  const sideMat = new THREE.MeshStandardMaterial({color:0x394b52, metalness:0.5, roughness:0.5});
  const goldMat = new THREE.MeshBasicMaterial({color:gold});
  const hotMat = new THREE.MeshBasicMaterial({color:orange});
  const whiteMat = new THREE.MeshBasicMaterial({color:ivory});
  const outlineMat = new THREE.LineBasicMaterial({color:0x8a998e, transparent:true, opacity:0.5});
  const dimLineMat = new THREE.LineBasicMaterial({color:0x3b5660, transparent:true, opacity:0.75});
  scene.add(new THREE.HemisphereLight(0xcfe8ed, 0x121416, 2.1));
  const key = new THREE.DirectionalLight(0xffe6bd, 3.2); key.position.set(-35, 55, 40); scene.add(key);
  const rim = new THREE.DirectionalLight(0x7aadc7, 2); rim.position.set(45, 15, -35); scene.add(rim);

  const cube = new THREE.BoxGeometry(1,1,1);
  const cylinder = new THREE.CylinderGeometry(1,1,1,12);
  const unitEdges = new THREE.EdgesGeometry(cube);
  const dummy = new THREE.Object3D();
  const clamp = (n,a=0,b=1) => Math.min(b,Math.max(a,n));
  const smooth = (a,b,t) => {const q=clamp((t-a)/(b-a)); return q*q*(3-2*q);};
  const out = q => 1-Math.pow(1-clamp(q),3);
  const mod = (n,m) => ((n % m)+m)%m;
  function box(parent,x,y,z,sx,sy,sz,mat=body,edges=false) {
    const mesh = new THREE.Mesh(cube,mat); mesh.position.set(x,y,z); mesh.scale.set(sx,sy,sz); parent.add(mesh);
    if (edges) { const edge = new THREE.LineSegments(unitEdges,outlineMat); mesh.add(edge); }
    return mesh;
  }
  function cyl(parent,x,y,z,r,h,mat=body) {
    const mesh = new THREE.Mesh(cylinder,mat); mesh.position.set(x,y,z); mesh.scale.set(r,h,r); parent.add(mesh); return mesh;
  }
  function line(points,material=dimLineMat,parent=scene) {
    const g = new THREE.BufferGeometry().setFromPoints(points.map(p=>new THREE.Vector3(...p)));
    const l = new THREE.Line(g,material); parent.add(l); return l;
  }
  const foundation = box(scene,0,-0.5,-5,126,0.8,114,new THREE.MeshStandardMaterial({color:0x0b1822,metalness:0.2,roughness:0.8}),true);
  const baseLines=[];
  // Parcel/engineering datum lines, deliberately bounded to the working territory.
  for(let x=-60;x<=60;x+=6) baseLines.push(x,-0.075,-59,x,-0.075,49);
  for(let z=-59;z<=49;z+=6) baseLines.push(-60,-0.075,z,60,-0.075,z);
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position',new THREE.Float32BufferAttribute(baseLines,3));
  scene.add(new THREE.LineSegments(bg,new THREE.LineBasicMaterial({color:0x1c303b,transparent:true,opacity:0.65})));

  const routes = [];
  function route(points,activation=0) {
    const path = points.map(p=>new THREE.Vector3(p[0],p[1]??0.1,p[2]));
    const distances=[0]; for(let i=1;i<path.length;i++) distances.push(distances[i-1]+path[i].distanceTo(path[i-1]));
    const total=distances.at(-1);
    const r={path,distances,total,activation}; routes.push(r); return r;
  }
  function at(r,d,v=new THREE.Vector3()) {
    const ds=clamp(d,0,r.total); let i=1; while(i<r.distances.length-1 && r.distances[i]<ds)i++;
    return v.lerpVectors(r.path[i-1],r.path[i],(ds-r.distances[i-1])/(r.distances[i]-r.distances[i-1]));
  }
  const main = route([[0,0.25,51],[0,0.25,-55]],0);
  for(const z of [-40,-13,14,40]) {
    route([[0,0.25,z],[-54,0.25,z]],0.65+(40-z)*0.008);
    route([[0,0.25,z],[54,0.25,z]],0.72+(40-z)*0.008);
  }
  for(const x of [-48,-34,34,48]) route([[x,0.25,40],[x,0.25,-40]],1.45+Math.abs(x)*0.005);
  const railPositions=[], ties=[];
  for(const r of routes) {
    for(let k=1;k<r.path.length;k++) {
      const a=r.path[k-1],b=r.path[k],dir=b.clone().sub(a).normalize(),side=new THREE.Vector3(-dir.z,0,dir.x);
      for(const s of [-0.56,0.56]) railPositions.push(a.x+side.x*s,a.y,a.z+side.z*s,b.x+side.x*s,b.y,b.z+side.z*s);
      const len=a.distanceTo(b);
      for(let d=0;d<len;d+=1.05) {const p=a.clone().addScaledVector(dir,d);ties.push({p,angle:Math.atan2(dir.x,dir.z)});}
    }
  }
  const rails = new THREE.BufferGeometry(); rails.setAttribute('position',new THREE.Float32BufferAttribute(railPositions,3));
  scene.add(new THREE.LineSegments(rails,new THREE.LineBasicMaterial({color:0xa6aaa0})));
  const sleepers=new THREE.InstancedMesh(cube,new THREE.MeshStandardMaterial({color:0x354450,roughness:0.9}),ties.length);
  ties.forEach((v,i)=>{dummy.position.copy(v.p);dummy.position.y=0.13;dummy.rotation.set(0,v.angle,0);dummy.scale.set(1.8,0.14,0.16);dummy.updateMatrix();sleepers.setMatrixAt(i,dummy.matrix);}); scene.add(sleepers);

  const districts=[];
  function district(x,z,index) {
    const group=new THREE.Group(); group.position.set(x,0,z); scene.add(group);
    const onset=0.5+Math.sqrt(x*x+(z-28)*(z-28))*0.023;
    // Real, readable factory bays with structural frames and pitched roofs.
    const width=10.8, length=17, height=3.3+(index%3)*0.6;
    box(group,0,0.2,0,width+2,0.35,length+2,roofMat,true);
    box(group,0,height/2,0,width,height,length,body,true);
    const g=new THREE.BufferGeometry();
    const positions=[];
    for(let bay=0;bay<3;bay++) {
      const a=-width/2+bay*3.6,b=a+3.6,m=a+1.8,h=height+1.5;
      positions.push(a,height,-length/2,m,h,-length/2,m,h,length/2,a,height,-length/2,m,h,length/2,a,height,length/2);
      positions.push(m,h,-length/2,b,height,-length/2,b,height,length/2,m,h,-length/2,b,height,length/2,m,h,length/2);
      line([[a,height,-length/2],[m,h,-length/2],[b,height,-length/2]],outlineMat,group);
      line([[m,h,-length/2],[m,h,length/2]],outlineMat,group);
    }
    g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.computeVertexNormals();
    const roofs=new THREE.Mesh(g,roofMat); roofs.material.side=THREE.DoubleSide; group.add(roofs);
    for(let zz=-7.5;zz<=7.5;zz+=3) {
      box(group,-5.46,height/2,zz,0.12,height,0.18,sideMat);
      box(group,5.46,height/2,zz,0.12,height,0.18,sideMat);
    }
    const windows=[];
    for(let zz=-6.7;zz<=6.7;zz+=2.2) for(const side of [-1,1]) {
      const w=box(group,side*5.43,height*0.62,zz,0.035,0.7,1.25,goldMat);windows.push(w);
    }
    for(let k=0;k<2;k++) {
      const cx=-3.4+k*6.6,cz=5.7;
      cyl(group,cx,height+2,cz,0.48,4.2,body);
      cyl(group,cx,height+4.13,cz,0.64,0.22,sideMat);
      cyl(group,cx,height+1.2,cz,0.57,0.18,hotMat);
    }
    // Gantry crane and loading platform: activity has a physical destination.
    const crane=new THREE.Group(); crane.position.set(0,0,-11);group.add(crane);
    for(const xx of [-6,6]) box(crane,xx,3.5,0,0.35,7,0.4,sideMat,true);
    box(crane,0,6.8,0,12.5,0.45,0.65,sideMat,true);
    const trolley=box(crane,0,6.35,0,1.2,0.45,1.1,hotMat);
    const hook=line([[0,6.1,0],[0,3.3,0]],new THREE.LineBasicMaterial({color:ivory}),crane);
    for(let k=0;k<4;k++) box(group,-4.3+k*2.7,0.7,-10.2,1.7,1.2,1.8,k%2?sideMat:roofMat,true);
    // Adjacent flywheel station, large enough to read as machinery from the flyby.
    const wheel=new THREE.Group(); wheel.position.set(8,2.2,2); group.add(wheel);
    const ring=new THREE.Mesh(new THREE.TorusGeometry(1.8,0.14,5,28),goldMat);wheel.add(ring);
    for(let q=0;q<6;q++){const spoke=box(wheel,0,0,0,3.6,0.1,0.16,sideMat);spoke.rotation.z=q*Math.PI/6;}
    box(group,8,0.6,2,4.2,1.1,1.3,body,true);
    districts.push({group,onset,windows,wheel,trolley,hook,index});
    return group;
  }
  let di=0;
  for(const z of [-26,1,28]) for(const x of [-23,23]) district(x,z,di++);
  for(const z of [-26,1,28]) for(const x of [-56,56]) {
    // Rows of workshops beyond the main factories widen the economic territory.
    for(let k=0;k<3;k++) {
      const group=new THREE.Group();group.position.set(x,0,z-6+k*6);scene.add(group);
      box(group,0,1.1,0,6,2.2,4.3,body,true);box(group,0,2.25,0,6.35,0.3,4.55,roofMat,true);
      box(group,x>0?-3.03:3.03,1.35,0,0.04,0.55,2.5,goldMat);
      districts.push({group,onset:2+Math.abs(z)*0.01+k*0.06,windows:[],index:di++});
    }
  }

  // Central generator station with paired rotors and a copper distribution bus.
  const station=new THREE.Group();station.position.set(0,0,-49);scene.add(station);
  box(station,0,0.5,0,26,1,13,sideMat,true);
  const rotors=[];
  for(const x of [-7.5,7.5]) {
    box(station,x,2,0,5,3,8,body,true);
    const rotor=new THREE.Group();rotor.position.set(x,4.1,0);station.add(rotor);rotors.push(rotor);
    const drum=new THREE.Mesh(new THREE.CylinderGeometry(1.7,1.7,6,20),sideMat);drum.rotation.x=Math.PI/2;rotor.add(drum);
    for(let q=0;q<8;q++){const a=q*Math.PI/4;const winding=box(rotor,Math.cos(a)*1.74,Math.sin(a)*1.74,0,0.15,0.15,5.8,hotMat);winding.rotation.z=a;}
    for(const z of [-3.2,3.2]){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.9,0.12,6,32),goldMat);ring.position.z=z;rotor.add(ring);}
  }
  for(const x of [-12,0,12]) {
    box(station,x,5,4,0.35,10,0.35,sideMat,true);
    box(station,x,9.7,4,4.3,0.3,0.4,sideMat,true);
    for(const dx of [-1.6,0,1.6])cyl(station,x+dx,10.15,4,0.22,0.65,goldMat);
  }
  line([[-13,10.4,4],[13,10.4,4]],new THREE.LineBasicMaterial({color:orange}),station);

  // Arcing distribution wires and instanced packets, constrained to actual wires.
  const wires=[];
  for(const x of [-39,39]) {
    let last=new THREE.Vector3(x,8,-49);
    for(const z of [-49,-27,-5,17,39]) {
      box(scene,x,3.8,z,0.22,7.6,0.22,sideMat);box(scene,x,7.7,z,3.8,0.18,0.25,sideMat);
      for(const dx of [-1.4,0,1.4]) cyl(scene,x+dx,7.95,z,0.13,0.4,goldMat);
      if(z!==-49){
        for(const dx of [-1.4,0,1.4]) {
          const curve=new THREE.QuadraticBezierCurve3(last.clone().add(new THREE.Vector3(dx,0,0)),new THREE.Vector3(x+dx,5.4,(z+last.z)/2),new THREE.Vector3(x+dx,8,z));
          const points=curve.getPoints(28);line(points.map(v=>v.toArray()),new THREE.LineBasicMaterial({color:0x936d45}));wires.push(curve);
        }
      } last=new THREE.Vector3(x,8,z);
    }
    const c=new THREE.QuadraticBezierCurve3(new THREE.Vector3(Math.sign(x)*12,10.4,-45),new THREE.Vector3(x/2,8,-52),new THREE.Vector3(x,8,-49));
    line(c.getPoints(32).map(v=>v.toArray()),new THREE.LineBasicMaterial({color:orange}));wires.push(c);
  }
  const wirePackets = new THREE.InstancedMesh(new THREE.SphereGeometry(0.12,5,4),goldMat,wires.length*4); scene.add(wirePackets);
  const railPackets = new THREE.InstancedMesh(cube,hotMat,routes.length*12); scene.add(railPackets);
  const pv=new THREE.Vector3(),nv=new THREE.Vector3();

  // Six complete trains; the car bodies follow connected L routes rather than drifting.
  const trainRoutes=[
    route([[-48,0.4,39],[-48,0.4,-40],[48,0.4,-40],[48,0.4,39]],1.6),
    route([[34,0.4,-40],[34,0.4,14],[-34,0.4,14],[-34,0.4,-40]],1.8),
    route([[0,0.4,49],[0,0.4,-40],[48,0.4,-40]],0),
    route([[-48,0.4,-13],[48,0.4,-13],[48,0.4,40]],1.7),
    route([[48,0.4,40],[-48,0.4,40],[-48,0.4,-40]],2.0),
    route([[-34,0.4,-40],[-34,0.4,14],[34,0.4,14]],2.1),
  ];
  // route() tracks rail signals; train-only routes reuse already-built track sections.
  routes.splice(routes.length-trainRoutes.length,trainRoutes.length);
  const trainGeo=new THREE.BoxGeometry(1.2,1.05,2.3);
  const cars = new THREE.InstancedMesh(trainGeo,sideMat,trainRoutes.length*7);scene.add(cars);
  const lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.8,0.12,0.12),goldMat,trainRoutes.length*7);scene.add(lamps);
  const locomotiveMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.48,0.48,1.9,10),roofMat,trainRoutes.length);scene.add(locomotiveMesh);
  const pointLights=[];
  for(const z of [39,14,-13,-40]) {
    const signal=new THREE.Group();signal.position.set(2.1,0,z);scene.add(signal);
    box(signal,0,1.7,0,0.16,3.4,0.16,sideMat);box(signal,0,3.5,0,0.7,0.9,0.35,body,true);
    const lens=new THREE.Mesh(new THREE.SphereGeometry(0.2,8,6),hotMat);lens.position.set(0,3.55,0.23);signal.add(lens);pointLights.push({lens,z});
  }

  // A concentric ground mark denotes the distribution station, not floating decoration.
  const ringMat=new THREE.LineBasicMaterial({color:orange,transparent:true,opacity:0.65});
  const groundRings=[];
  for(const radius of [3,6,10]) {
    const pts=[];for(let i=0;i<=100;i++){const a=i/100*Math.PI*2;pts.push([Math.cos(a)*radius,0.04,Math.sin(a)*radius-49]);}
    const ring=line(pts,ringMat); groundRings.push(ring);
  }
  const look=new THREE.Vector3();
  function update(t,aspect=16/9) {
    t=clamp(t,0,8.6);
    camera.aspect=aspect;
    const fly=smooth(0,1.5,t),wide=smooth(1.25,5.35,t);
    const c0=new THREE.Vector3(0.3,2.3,46-43*fly);
    const c1=new THREE.Vector3(82+7*Math.sin(t*0.1),80,106);
    camera.position.lerpVectors(c0,c1,wide);
    look.set(-0.3,1.1,-8-15*fly).lerp(new THREE.Vector3(0,0,-6),wide);
    camera.lookAt(look);camera.fov=56-12*wide;camera.updateProjectionMatrix();
    for(const d of districts) {
      const build=out((t-d.onset)/0.56);
      d.group.visible=build>0;
      d.group.scale.set(1,Math.max(0.002,build),1);
      d.group.position.y=-0.18*(1-build);
      if(d.wheel) {
        d.wheel.rotation.z=-(Math.max(0,t-d.onset)*4.4);
        d.trolley.position.x=Math.sin((t-d.onset)*2.1+d.index)*4.2;
        d.hook.position.x=d.trolley.position.x;
        d.hook.scale.y=0.86+0.14*Math.sin(t*2.5+d.index);
      }
      for(let i=0;i<d.windows.length;i++) d.windows[i].visible=t>d.onset+0.37+i*0.014;
    }
    station.scale.y=Math.max(0.001,out((t-1.05)/0.8));
    rotors.forEach((r,i)=>r.rotation.z=t*(4.2+i*0.4));
    let pidx=0;
    for(const r of routes) for(let i=0;i<12;i++) {
      const elapsed=Math.max(0,t-r.activation),front=elapsed*46;
      const d=mod(front-i*3.3,r.total);
      at(r,d,pv);at(r,Math.min(r.total,d+0.25),nv);
      dummy.position.copy(pv);dummy.position.y=0.38;
      dummy.rotation.set(0,Math.atan2(nv.x-pv.x,nv.z-pv.z),0);
      const visible=t>r.activation && (front>r.total||d<front);
      dummy.scale.set(0.12,0.1,visible?1.6:0.001);if(!visible)dummy.position.y=-3;
      dummy.updateMatrix();railPackets.setMatrixAt(pidx++,dummy.matrix);
    }
    railPackets.instanceMatrix.needsUpdate=true;
    let wi=0;
    for(let w=0;w<wires.length;w++)for(let k=0;k<4;k++){
      wires[w].getPoint(mod((t-1.7)*1.5+k/4+w*0.07,1),pv);
      dummy.position.copy(pv);dummy.rotation.set(0,0,0);dummy.scale.setScalar(t>1.7+w*0.01?1:0.001);dummy.updateMatrix();wirePackets.setMatrixAt(wi++,dummy.matrix);
    }
    wirePackets.instanceMatrix.needsUpdate=true;
    for(let ri=0;ri<trainRoutes.length;ri++) {
      const r=trainRoutes[ri],active=t>=r.activation;
      const head=mod((t-r.activation)*13+20+ri*16,r.total-1);
      for(let k=0;k<7;k++) {
        const d=mod(head-k*2.75,r.total-1);at(r,d,pv);at(r,Math.min(r.total,d+0.2),nv);
        const yaw=Math.atan2(nv.x-pv.x,nv.z-pv.z);
        dummy.position.copy(pv);dummy.position.y=active?0.95:-10;dummy.rotation.set(0,yaw,0);dummy.scale.set(1,k===0?1.2:1,1);dummy.updateMatrix();cars.setMatrixAt(ri*7+k,dummy.matrix);
        dummy.position.y+=0.48;dummy.updateMatrix();lamps.setMatrixAt(ri*7+k,dummy.matrix);
        if(k===0){dummy.position.y=active?1.1:-10;dummy.rotation.set(Math.PI/2,yaw,0);dummy.scale.set(1,1,1);dummy.updateMatrix();locomotiveMesh.setMatrixAt(ri,dummy.matrix);}
      }
    }
    cars.instanceMatrix.needsUpdate=true;lamps.instanceMatrix.needsUpdate=true;locomotiveMesh.instanceMatrix.needsUpdate=true;
    for(const s of pointLights){const lit=t>0.15+(40-s.z)*0.014;s.lens.scale.setScalar(lit?1.05:0.25);}
    ringMat.opacity=0.3+0.35*smooth(2,3.3,t);
    scene.fog.density=0.0045-0.0015*wide;
  }
  update(0);
  return {scene,camera,update};
}
