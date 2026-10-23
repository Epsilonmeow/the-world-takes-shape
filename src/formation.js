import * as THREE from '../vendor/three.module.js';
const INK=0x151917,BONE=0xe9e2d2,HOT=0xff6237;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const mix=(a,b,t)=>a+(b-a)*t;
const V=(x,y,z=0)=>new THREE.Vector3(x,y,z);

export function createFormation(){
 const scene=new THREE.Scene();scene.background=new THREE.Color(INK);
 const camera=new THREE.PerspectiveCamera(48,16/9,.05,200);
 scene.add(new THREE.HemisphereLight(BONE,0x121816,2.2));
 const light=new THREE.DirectionalLight(0xffeed4,4);light.position.set(-5,10,12);scene.add(light);
 const fill=new THREE.DirectionalLight(0xffffff,1);fill.position.set(7,-2,-5);scene.add(fill);
 const material=new THREE.MeshStandardMaterial({color:0x7e8172,metalness:.6,roughness:.42});
 const dark=new THREE.MeshStandardMaterial({color:0x252d29,metalness:.6,roughness:.4});
 const copper=new THREE.MeshStandardMaterial({color:HOT,metalness:.35,roughness:.36});
 const lines=new THREE.LineBasicMaterial({color:BONE,transparent:true,opacity:.6});
 const hotLine=new THREE.LineBasicMaterial({color:HOT,transparent:true,opacity:.8});
 const mechanism=new THREE.Group();scene.add(mechanism);
 function mesh(g,m=material,parent=mechanism){const obj=new THREE.Mesh(g,m);parent.add(obj);const e=new THREE.LineSegments(new THREE.EdgesGeometry(g,25),lines);obj.add(e);return obj;}
 function box(w,h,d,x,y,z=0,m=material,parent=mechanism){const o=mesh(new THREE.BoxGeometry(w,h,d),m,parent);o.position.set(x,y,z);return o;}
 function cyl(r,h,x,y,z=0,m=material,parent=mechanism){const o=mesh(new THREE.CylinderGeometry(r,r,h,32),m,parent);o.position.set(x,y,z);return o;}
 function link(a,b,r,m=material,parent=mechanism){const o=cyl(r,1,0,0,0,m,parent);updateLink(o,a,b);return o;}
 function updateLink(o,a,b){const d=b.clone().sub(a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(V(0,1),d.normalize());}
 function ring(r,t,x,y,z=0,m=material,parent=mechanism){const o=mesh(new THREE.TorusGeometry(r,t,8,64),m,parent);o.position.set(x,y,z);return o;}
 function inkLine(points,m=lines,parent=mechanism){const g=new THREE.BufferGeometry().setFromPoints(points);const o=new THREE.Line(g,m);parent.add(o);return o;}
 function caption(str,sub,w=4,color='#e9e2d2'){
  const cv=document.createElement('canvas');cv.width=1024;cv.height=220;const c=cv.getContext('2d');
  c.fillStyle=color;c.font='750 64px Archivo';c.fillText(str,14,82);c.font='26px "Courier New"';c.fillText(sub,16,143);c.fillRect(16,165,970,2);
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  return new THREE.Mesh(new THREE.PlaneGeometry(w,w*220/1024),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
 }
 // Bearings and the cast beam develop thickness from the ink plane.
 box(6,.25,3,0,-2.7,-.1,dark);box(1.1,4.6,.8,0,-.28,-.15,dark);box(2,.42,1.6,0,2.2,.1);
 const pivot=cyl(.43,2.2,0,2.75,.3,copper);pivot.rotation.x=Math.PI/2;
 ring(.58,.065,0,2.75,1.43);ring(.26,.04,0,2.75,1.48);
 const beam=new THREE.Group();beam.position.set(0,2.75,.2);mechanism.add(beam);
 box(8.8,.62,.65,0,0,0,material,beam);box(9,.13,.94,0,.34,0,dark,beam);box(9,.13,.94,0,-.34,0,dark,beam);
 for(let i=-4;i<=4;i++){const bolt=cyl(.085,.12,i,.06,.44,copper,beam);bolt.rotation.x=Math.PI/2;}
 for(const x of [-4.2,4.2]){ring(.32,.11,x,0,.14,material,beam);ring(.12,.06,x,0,.57,copper,beam);}
 // An open sleeve makes the piston and rod visible, but retains a solid silhouette.
 const barrel=mesh(new THREE.CylinderGeometry(.86,.86,2.15,48,1,true,.55,Math.PI*1.52),dark);barrel.position.set(-4.1,-1.15,0);
 for(const y of [-2.25,-.05]){cyl(1,.14,-4.1,y,0);for(let i=0;i<8;i++){const a=i*Math.PI/4;cyl(.065,.18,-4.1+.91*Math.cos(a),y+.1,.91*Math.sin(a),copper);}}
 const piston=cyl(.77,.25,-4.1,-.8,0,material);const pistonRod=link(V(-4.1,-.8),V(-4.1,2.6),.11);
 const rod=link(V(4.2,2.75),V(4.2,-1.9),.15);const rodBack=link(V(4.2,2.75,-.2),V(4.2,-1.9,-.2),.06,dark);
 const lowerJoint=ring(.3,.08,4.2,-1.9,.2,copper);
 const upperJoint=ring(.28,.08,4.2,2.75,.2,copper);
 const shaft=cyl(.24,2,4,-1.8,0,copper);shaft.rotation.x=Math.PI/2;
 ring(1.45,.06,4,-1.8,-.5,dark);ring(1.22,.035,4,-1.8,-.48);
 inkLine([V(-4.1,-2.4),V(-4.1,3.8)],hotLine);inkLine([V(-5.5,2.75),V(5.6,2.75)],lines);
 const beamLabel=caption('BEAM / ROCKING MOTION','THE LOAD PASSES THROUGH THE PIVOT',5);beamLabel.position.set(-.7,4.22,.7);mechanism.add(beamLabel);
 const rodLabel=caption('CONNECTING ROD','RECIPROCATION → ROTATION',4.7);rodLabel.position.set(6.7,.3,.7);mechanism.add(rodLabel);
 const pistonLabel=caption('POWER STROKE','A PRESSURE DIFFERENCE DOES WORK',4.8,'#ff6237');pistonLabel.position.set(-4.1,-3.4,.4);mechanism.add(pistonLabel);
 for(let i=0;i<9;i++){inkLine([V(-5.3,-2.2+i*.6),V(-5.45,-2.2+i*.6)],lines);}
 // Two distinct engineering sheets carry the historical jump, then leave the frame.
 function blueprint(year,title,mode){
  const cv=document.createElement('canvas');cv.width=1920;cv.height=1080;const c=cv.getContext('2d');
  c.fillStyle='#e9e2d2';c.fillRect(0,0,1920,1080);c.strokeStyle='#151917';c.fillStyle='#151917';
  c.font='850 175px Archivo';c.fillText(year,mode===0?100:1250,205);c.font='700 45px Archivo';c.fillText(title,mode===0?655:100,133);
  c.font='24px "Courier New"';c.fillText(mode===0?'WORKING CYLINDER / SEPARATE CONDENSER':'SUN / PLANET / OUTPUT SHAFT',mode===0?660:105,180);
  c.lineWidth=2;c.beginPath();c.moveTo(100,230);c.lineTo(1790,230);c.stroke();
  const ln=(a,b,d,e,w=2,col='#151917')=>{c.lineWidth=w;c.strokeStyle=col;c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.stroke()};
  const cir=(x,y,r)=>{c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.stroke()};
  if(mode===0){
   c.strokeRect(260,390,650,310);c.strokeRect(720,390,48,310);ln(768,545,1540,545,12);cir(1440,775,115);ln(360,700,360,885,5);ln(360,885,1310,885,5);ln(1310,885,1310,775,5);ln(1310,775,1325,775,5);c.font='600 52px Archivo';c.fillText('HOT',260,350);c.fillText('COLD',1320,615);
  }else{
   ln(420,505,1470,505,32);ln(920,530,920,925,18);cir(920,505,48);c.strokeRect(340,675,180,230);ln(430,510,430,815,10);ln(1470,505,1470,815,10);cir(1360,900,70);cir(1470,815,70);c.font='600 38px Archivo';c.fillText('A NEW OUTPUT',1190,395);c.font='24px "Courier New"';c.fillText('ROTATIVE MOTION / PATENT',100,1030);
  }
  c.font='18px "Courier New"';for(let i=0;i<8;i++){c.fillText(['SEAL / CYLINDER WALL','HEAT / CONDENSATION','JOINT / BEARING SURFACE','AXIS / LOAD PATH'][i%4],100,315+i*62);ln(95,335+i*62,245,335+i*62,1);}
  for(let i=0;i<34;i++)ln(280+i*41,986,280+i*41,1000+(i%4===0?12:0),1);
  c.font='20px "Courier New"';c.fillText('ENGINEERING DEVELOPMENT',1250,1030);
  const tex=new THREE.CanvasTexture(cv);tex.colorSpace=THREE.SRGBColorSpace;
  const m=new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide});const obj=new THREE.Mesh(new THREE.PlaneGeometry(21.6,12.15),m);scene.add(obj);return obj;
 }
 const sheetA=blueprint('1765','SEPARATE THE COLD',0),sheetB=blueprint('1781','ROTATIVE PATENT',1);
 let lastAngle=0;
 function update(t){
  const q=t-7.5,phase=(t-8.05)*Math.PI*2/1.36;
  const foot=V(4+1.18*Math.cos(phase),-1.8+1.18*Math.sin(phase),.2);
  // Solve the beam angle for a fixed-length connecting rod, independently each frame.
  let angle=.1;
  for(let i=0;i<8;i++){
   const x=4.2*Math.cos(angle)-foot.x,y=2.75+4.2*Math.sin(angle)-foot.y;
   const f=x*x+y*y-4.55**2,df=2*x*(-4.2*Math.sin(angle))+2*y*4.2*Math.cos(angle);
   angle-=f/(Math.abs(df)<.0001?.0001:df);
  }
  lastAngle=angle;beam.rotation.z=angle;
  const upper=V(4.2*Math.cos(angle),2.75+4.2*Math.sin(angle),.2);
  const left=V(-4.2*Math.cos(angle),2.75-4.2*Math.sin(angle),.2);
  const head=V(-4.1,-.85-4.2*Math.sin(angle),0);
  piston.position.copy(head);updateLink(pistonRod,head,left);updateLink(rod,upper,foot);updateLink(rodBack,upper.clone().add(V(0,0,-.3)),foot.clone().add(V(0,0,-.3)));
  upperJoint.position.copy(upper).add(V(0,0,.2));lowerJoint.position.copy(foot).add(V(0,0,.2));
  const lift=smooth((q-.65)/.7);mechanism.scale.z=mix(.025,1,lift);mechanism.position.z=mix(-.6,0,lift);
  // Revision sheets cut across the lens as the flat construction gains depth.
  sheetA.visible=q<.63;sheetB.visible=q>.26&&q<1.15;
  const a=smooth(q/.68);sheetA.position.set(-a*13,a*3,.8+a*2);sheetA.rotation.set(.05+a*.6,-a*.7,-.03-a*.24);
  const b=smooth((q-.35)/.8);sheetB.position.set(2-b*20,-.5+b*5,.6+b*3);sheetB.rotation.set(-b*.5,b*.85,.02+b*.18);
  const reveal=smooth((q-.6)/.68),dive=smooth((q-1.63)/.87);
  const pos=V(mix(-3.5,2.2,reveal),mix(1,4.1,reveal),mix(15.8,8.6,reveal));
  pos.lerp(V(4.4,-.6,4.4),dive);camera.position.copy(pos);
  const target=V(mix(-1.1,.5,reveal),mix(.9,2.75,reveal),0).lerp(foot,dive);
  camera.up.set(0,1,0);camera.lookAt(target);camera.rotateZ(mix(-.14,.075,reveal)-.18*dive);
  camera.fov=mix(48,55,dive);camera.updateProjectionMatrix();
  rodLabel.visible=q>1.05&&q<2.15;beamLabel.visible=q>.82&&q<1.92;pistonLabel.visible=q>.7&&q<1.6;
 }
 function resize(w,h){camera.aspect=w/h;camera.updateProjectionMatrix()}
 function dispose(){scene.traverse(o=>{o.geometry?.dispose();if(o.material){for(const m of Array.isArray(o.material)?o.material:[o.material]){m.map?.dispose();m.dispose()}}})}
 update(7.5);return{scene,camera,update,resize,dispose,stats:()=>({beamAngle:lastAngle})};
}
