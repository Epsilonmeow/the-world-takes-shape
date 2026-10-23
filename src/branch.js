import * as THREE from '../vendor/three.module.js';
import {createRotary} from './rotary.js';

const TAU=Math.PI*2, BONE=0xe9e2d2, ORANGE=0xff6237;
const clamp=x=>Math.max(0,Math.min(1,x));
const smooth=x=>{x=clamp(x);return x*x*(3-2*x);};
const mix=(a,b,p)=>a+(b-a)*p;
const v=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z);
const mod=(a,b)=>(a%b+b)%b;
function cylinder(r,h,mat,n=48){const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,n),mat);m.rotation.x=Math.PI/2;return m;}
function box(x,y,z,mat){return new THREE.Mesh(new THREE.BoxGeometry(x,y,z),mat);}
function ring(ro,ri,h,mat,bevel=true){const s=new THREE.Shape();s.absarc(0,0,ro,0,TAU,false);const hole=new THREE.Path();hole.absarc(0,0,ri,0,TAU,true);s.holes.push(hole);const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:bevel,bevelSize:.015,bevelThickness:.015,bevelSegments:1,steps:1,curveSegments:32});g.translate(0,0,-h/2);return new THREE.Mesh(g,mat);}
function cutHub(ro,ri,h,mat){const a=Math.PI/6,b=TAU-a,s=new THREE.Shape();s.moveTo(Math.cos(a)*ro,Math.sin(a)*ro);s.absarc(0,0,ro,a,b,false);s.lineTo(Math.cos(b)*ri,Math.sin(b)*ri);s.absarc(0,0,ri,b,a,true);s.closePath();const g=new THREE.ExtrudeGeometry(s,{depth:h,bevelEnabled:false,steps:1,curveSegments:32});g.translate(0,0,-h/2);return new THREE.Mesh(g,mat);}
function line(points,mat){return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points.map(p=>Array.isArray(p)?v(...p):p)),mat);}
function arc(r,z=0,start=0,end=TAU){return Array.from({length:81},(_,i)=>{const a=mix(start,end,i/80);return v(Math.cos(a)*r,Math.sin(a)*r,z);});}
function rod(a,b,r,mat,n=12){const d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),n),mat);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(v(0,1,0),d.normalize());return m;}
function setRod(m,a,b){const d=b.clone().sub(a);m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(v(0,1,0),d.normalize());m.scale.y=d.length();}
function texText(title,sub,accent=false){const c=document.createElement('canvas');c.width=1024;c.height=240;const d=c.getContext('2d');d.fillStyle=accent?'#ff6237':'#e9e2d2';d.font='750 79px Archivo, Arial';d.fillText(title,8,89);d.font='28px Consolas, monospace';d.fillText(sub||'',10,141);d.fillRect(10,175,985,2);for(let i=0;i<36;i++)d.fillRect(10+i*28,176,1,i%6?7:17);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return t;}
function label(title,sub,w,accent=false){return new THREE.Mesh(new THREE.PlaneGeometry(w,w*240/1024),new THREE.MeshBasicMaterial({map:texText(title,sub,accent),transparent:true,depthWrite:false,side:THREE.DoubleSide}));}
function roundedBlock(w,h,d,mat,r=.04){const s=new THREE.Shape(),x=-w/2,y=-h/2;s.moveTo(x+r,y);s.lineTo(x+w-r,y);s.quadraticCurveTo(x+w,y,x+w,y+r);s.lineTo(x+w,y+h-r);s.quadraticCurveTo(x+w,y+h,x+w-r,y+h);s.lineTo(x+r,y+h);s.quadraticCurveTo(x,y+h,x,y+h-r);s.lineTo(x,y+r);s.quadraticCurveTo(x,y,x+r,y);const g=new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:true,bevelSize:.02,bevelThickness:.02,bevelSegments:2,steps:1,curveSegments:4});g.translate(0,0,-d/2);return new THREE.Mesh(g,mat);}

// Tangent runs and true pulley wraps; the whole running belt can shift axially.
function flatBelt(a,b,ra,rb,width,mat,lineMat){
 const D=Math.hypot(b.x-a.x,b.y-a.y),direction=Math.atan2(b.y-a.y,b.x-a.x),spread=Math.acos((ra-rb)/D),upper=direction+spread,lower=direction-spread;
 const at=(c,r,ang)=>v(c.x+Math.cos(ang)*r,c.y+Math.sin(ang)*r,0);
 const a1=at(a,ra,upper),b1=at(b,rb,upper),a2=at(a,ra,lower),b2=at(b,rb,lower);
 const L=a1.distanceTo(b1),wrapB=(upper-lower)*rb,wrapA=(TAU-upper+lower)*ra,total=2*L+wrapA+wrapB;
 function point(s){s=mod(s,total);if(s<L)return a1.clone().lerp(b1,s/L);s-=L;if(s<wrapB)return at(b,rb,upper-s/rb);s-=wrapB;if(s<L)return b2.clone().lerp(a2,s/L);s-=L;return at(a,ra,lower-s/ra);}
 const group=new THREE.Group(),positions=[],uv=[],indices=[];
 for(let i=0;i<=256;i++){const p=point(i/256*total);for(const side of [-1,1]){positions.push(p.x,p.y,side*width/2);uv.push(i/256,(side+1)/2);}if(i<256){const k=i*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();group.add(new THREE.Mesh(g,mat));
 for(const side of [-1,1])group.add(line(Array.from({length:257},(_,i)=>{const p=point(i/256*total);p.z=side*width/2;return p;}),lineMat));
 return {group,length:total,point,run:L,top:a1,bottom:b1};
}
function leatherTexture(){const c=document.createElement('canvas');c.width=2048;c.height=128;const d=c.getContext('2d');d.fillStyle='#665b44';d.fillRect(0,0,2048,128);d.fillStyle='#9a8b69';for(let i=0;i<220;i++)d.fillRect((i*89.77)%2048,(i*31.13)%128,20+i%51,.65);d.strokeStyle='#d4c6a3';d.lineWidth=1.6;for(let x=0;x<2048;x+=16){d.beginPath();d.moveTo(x,8);d.lineTo(x+5,8);d.moveTo(x,120);d.lineTo(x+5,120);d.stroke();}d.fillStyle='#302c23';d.fillRect(54,0,14,128);d.strokeStyle='#e9e2d2';d.lineWidth=2.5;for(let y=12;y<120;y+=12){d.beginPath();d.moveTo(44,y-4);d.lineTo(79,y+4);d.stroke();}d.fillStyle='#ff6237';d.fillRect(88,35,12,58);d.font='bold 29px Archivo';d.fillStyle='#d8c9a7';d.fillText('DRIVE',180,80);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=THREE.RepeatWrapping;t.anisotropy=8;return t;}

export function createBranch(){
 const base=createRotary(),{scene,camera}=base,added=new THREE.Group();added.name='branch-17p1';scene.add(added);added.visible=false;
 const bone=new THREE.MeshStandardMaterial({color:BONE,roughness:.62,metalness:.10});
 const iron=new THREE.MeshStandardMaterial({color:0x40483d,roughness:.72,metalness:.14});
 const dark=new THREE.MeshStandardMaterial({color:0x222a24,roughness:.92});
 const orange=new THREE.MeshStandardMaterial({color:ORANGE,roughness:.63,metalness:.05});
 const skin=new THREE.MeshStandardMaterial({color:0xb9ae8b,roughness:.91});
 const sleeveMat=new THREE.MeshStandardMaterial({color:0x383f32,roughness:1});
 const paleLine=new THREE.LineBasicMaterial({color:BONE,transparent:true,opacity:.72}),fineLine=new THREE.LineBasicMaterial({color:BONE,transparent:true,opacity:.28}),accentLine=new THREE.LineBasicMaterial({color:ORANGE,transparent:true,opacity:.96});
 const A=v(42,5,0),C=v(43,1,0),D=v(43,-1,0),rA=.86,rC=1.0,rSmall=.46,rLathe=.62;
 const looseZ=-5.48,fastZ=-6.52,midZ=(looseZ+fastZ)/2;
 function wheel(center,r,width,free=false,wide=false,shiftable=false){
  const group=new THREE.Group();group.position.copy(center);added.add(group);
  group.add(ring(r,r-.12,width,[iron,bone],!shiftable));
  for(const s of [-1,1]){if(shiftable){group.add(line(arc(r-.002,s*width/2),paleLine));}else{const lip=ring(r+.025,r-.035,.04,bone);lip.position.z=s*(width/2+.015);group.add(lip);}}
  for(let i=0;i<6;i++){const a=i/6*TAU,sp=box(r-.23,.12,width*.55,iron);sp.position.set(Math.cos(a)*r*.54,Math.sin(a)*r*.54,0);sp.rotation.z=a;group.add(sp);const rib=box(r-.25,.022,.018,bone);rib.position.set(Math.cos(a)*r*.54,Math.sin(a)*r*.54,width*.30);rib.rotation.z=a;group.add(rib);}
  group.add(free?ring(.34,.225,width+.13,[bone,iron]):shiftable?cutHub(.34,.205,width+.13,[bone,iron]):cylinder(.34,width+.13,bone));
  if(!free){const key=box(.16,.075,shiftable?width+.18:.07,orange);key.position.set(.22,0,shiftable?0:width/2+.11);group.add(key);}
  for(let i=0;i<8;i++){const a=i/8*TAU;const bolt=cylinder(.041,.06,dark,6);bolt.position.set(Math.cos(a)*.275,Math.sin(a)*.275,width/2+.10);group.add(bolt);}
  const datum=box(.15,.045,.02,orange);datum.position.set(r-.065,0,width/2+.045);group.add(datum);
  group.add(line(arc(r-.06,width/2+.045),fineLine));
  if(wide){for(let i=0;i<8;i++){const z=-width/2+i*width/7;group.add(line(arc(r+.002,z),fineLine));}}
  return group;
 }
 const mainWheel=wheel(v(A.x,A.y,midZ),rA,2.0,false,true);
 const loose=wheel(v(C.x,C.y,looseZ),rC,.78,true,false,true),fast=wheel(v(C.x,C.y,fastZ),rC,.78,false,false,true);
 const counter=new THREE.Group();counter.position.set(C.x,C.y,0);added.add(counter);
 const localShaft=cylinder(.20,6.3,iron);localShaft.position.z=-5.55;counter.add(localShaft);
 const shaftWitness=box(.018,.025,5.8,orange);shaftWitness.position.set(.04,.197,-5.55);counter.add(shaftWitness);
 const secondaryDriver=wheel(v(C.x,C.y,-8.20),rSmall,.40,false);
 const secondaryDriven=wheel(v(D.x,D.y,-8.20),rLathe,.40,false);
 for(const z of [-7.30,-3.20]){
  const housing=box(.69,.66,.38,iron);housing.position.set(C.x,C.y,z);added.add(housing);
  const cap=ring(.30,.205,.43,[bone,iron]);cap.position.set(C.x,C.y,z);added.add(cap);
  const stand=box(.32,3.7,.28,dark);stand.position.set(C.x,.0,z);added.add(stand);
  const foot=box(.85,.15,.7,iron);foot.position.set(C.x,-1.9,z);added.add(foot);
  for(const x of [-.25,.25]){const bolt=cylinder(.045,.09,bone,6);bolt.rotation.x=0;bolt.position.set(C.x+x,-1.78,z+.18);added.add(bolt);}
 }
 const beltMap=leatherTexture(),beltMat=new THREE.MeshStandardMaterial({map:beltMap,roughness:.96,side:THREE.DoubleSide});
 const primary=flatBelt(A,C,rA,rC,.52,beltMat,fineLine);added.add(primary.group);
 const secondaryMap=leatherTexture(),secondaryMat=new THREE.MeshStandardMaterial({map:secondaryMap,roughness:.96,side:THREE.DoubleSide});
 const secondary=flatBelt(C,D,rSmall,rLathe,.31,secondaryMat,fineLine);secondary.group.position.z=-8.20;added.add(secondary.group);
 const beltArrows=[];
 for(let i=0;i<4;i++){const m=line([[0,0,0],[-.15,-.09,0],[-.15,.09,0],[0,0,0]],accentLine);primary.group.add(m);beltArrows.push(m);}

 // Positive, visible linkage: pivoting handle -> connecting link -> sliding rod
 // -> fork fingers. The fork's axial travel is the belt's axial travel.
 const forkPoint=primary.top.clone().lerp(primary.bottom,.78),fork=new THREE.Group();added.add(fork);
 const forkBridge=box(.35,.07,.90,iron);forkBridge.position.set(.13,.16,0);fork.add(forkBridge);
 for(const z of [-.33,.33]){const finger=rod(v(0,-.14,z),v(0,.25,z),.045,bone);fork.add(finger);const tip=cylinder(.068,.10,iron,16);tip.position.set(0,-.10,z);fork.add(tip);}
 const shifterRod=cylinder(.055,2.25,bone);shifterRod.position.set(44.08,2.33,midZ);added.add(shifterRod);
 for(const z of [-7.02,-4.95]){const eye=ring(.13,.06,.13,iron);eye.position.set(44.08,2.33,z);added.add(eye);const mount=box(.32,.35,.15,iron);mount.position.set(44.08,2.54,z);added.add(mount);}
 const slidingCollar=ring(.12,.058,.14,bone);added.add(slidingCollar);
 const leverPivot=v(44.78,1.24,midZ),lever=new THREE.Group();lever.position.copy(leverPivot);added.add(lever);
 const pivotShaft=cylinder(.13,.36,bone);pivotShaft.rotation.y=Math.PI/2;lever.add(pivotShaft);
 const arm=box(.09,1.12,.075,iron);arm.position.y=.56;lever.add(arm);
 const armEdge=box(.018,1.07,.012,bone);armEdge.position.set(-.052,.56,.04);lever.add(armEdge);
 const grip=rod(v(-.22,1.12,0),v(.23,1.12,0),.085,dark);lever.add(grip);
 const controlBase=box(.55,.28,.72,iron);controlBase.position.copy(leverPivot).add(v(0,-.18,0));added.add(controlBase);
 const link=new THREE.Mesh(new THREE.CylinderGeometry(.038,.038,1,12),bone);added.add(link);
 const forkLink=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1,12),iron);added.add(forkLink);
 const travelScale=line([[44.11,2.62,looseZ],[44.11,2.62,fastZ]],paleLine);added.add(travelScale);
 for(let i=0;i<=8;i++)added.add(line([[44.11,2.62,mix(looseZ,fastZ,i/8)],[44.11+(i%4?.07:.14),2.62,mix(looseZ,fastZ,i/8)]],fineLine));

 // A visible bare hand actually wraps the handle. The forearm follows the hand;
 // all human contact stays on this control, away from the running belt.
 const hand=new THREE.Group();added.add(hand);
 const palm=roundedBlock(.40,.19,.27,skin,.05);palm.position.set(.03,.12,0);hand.add(palm);
 for(let i=0;i<4;i++){
  const x=-.145+i*.095;
  const p0=v(x,.19,.075),p1=v(x,.075,.16),p2=v(x,-.075,.13),p3=v(x,-.12,-.015);
  hand.add(rod(p0,p1,.044,skin),rod(p1,p2,.043,skin),rod(p2,p3,.037,skin));
  const nail=box(.045,.025,.009,bone);nail.position.copy(p3).add(v(0,.005,-.025));hand.add(nail);
 }
 hand.add(rod(v(.19,.19,-.1),v(.24,.06,-.18),.06,skin),rod(v(.24,.06,-.18),v(.16,-.06,-.13),.048,skin));
 const wrist=roundedBlock(.23,.22,.22,skin,.04);wrist.position.set(.32,.15,.0);hand.add(wrist);
 const forearm=new THREE.Mesh(new THREE.CylinderGeometry(.17,.215,1,16),sleeveMat);added.add(forearm);
 const upperArm=rod(v(46.4,2.28,-4.55),v(47.1,1.42,-4.10),.24,sleeveMat);added.add(upperArm);
 const cuff=new THREE.Mesh(new THREE.CylinderGeometry(.185,.19,.18,16),bone);added.add(cuff);
 const shoulder=roundedBlock(.65,1.4,.65,sleeveMat,.12);shoulder.position.set(47.2,.94,-4.1);added.add(shoulder);

 // Local lathe headstock: the chuck is stationary until this keyed drive gains
 // traction. There is no tool contact or cutting in this bounded continuation.
 const bed=box(1.65,.23,4.9,iron);bed.position.set(43,-2.12,-5.92);added.add(bed);
 for(const x of [42.38,43.62]){const way=box(.12,.12,4.9,bone);way.position.set(x,-1.97,-5.92);added.add(way);}
 for(const z of [-7.85,-3.9]){const leg=box(1.25,.76,.29,dark);leg.position.set(43,-2.56,z);added.add(leg);}
 const headstock=box(1.3,1.15,1.18,iron);headstock.position.set(43,-1.46,-7.15);added.add(headstock);
 const headCollar=ring(.49,.23,.33,[bone,iron]);headCollar.position.set(43,-1,-6.49);added.add(headCollar);
 const spindle=new THREE.Group();spindle.position.set(43,-1,0);added.add(spindle);
 const spindleShaft=cylinder(.22,3.15,iron);spindleShaft.position.z=-6.96;spindle.add(spindleShaft);
 const chuck=new THREE.Group();chuck.position.z=-5.52;spindle.add(chuck);
 chuck.add(cylinder(.68,.46,iron));const face=cylinder(.635,.09,bone);face.position.z=.28;chuck.add(face);
 const centre=ring(.22,.11,.11,iron);centre.position.z=.355;chuck.add(centre);
 for(let i=0;i<3;i++){const a=i/3*TAU,jaw=box(.32,.15,.22,dark);jaw.position.set(Math.cos(a)*.37,Math.sin(a)*.37,.39);jaw.rotation.z=a;chuck.add(jaw);for(let j=0;j<4;j++){const serration=box(.035,.16,.012,bone);serration.position.set((.24+j*.065)*Math.cos(a),(.24+j*.065)*Math.sin(a),.51);serration.rotation.z=a;chuck.add(serration);}}
 const chuckMark=box(.15,.032,.018,orange);chuckMark.position.set(.51,0,.34);chuck.add(chuckMark);
 const tailSupport=box(.55,.30,.55,iron);tailSupport.position.set(43,-1.69,-4);added.add(tailSupport);

 const labels=[];
 const addLabel=(title,sub,w,p,accent=false,rotation=0)=>{const l=label(title,sub,w,accent);l.position.copy(p);l.rotation.y=rotation;added.add(l);labels.push(l);return l;};
 const driverName=addLabel('TAKE-OFF', 'DRIVER / SHARED SHAFT',2.1,v(41.6,5.95,-5.5),true);
 const ratioName=addLabel('ωD rD = ωd rd', 'BELT SPEED / PULLEY RADII',1.75,v(41.3,3.25,-6.05),false,-.35);
 const outgoingName=addLabel('DRIVE', 'CONTINUOUS TRACTION',1.3,v(44.2,3.8,-6.0),true);
 const returnName=addLabel('RETURN', 'OPPOSITE TRAVEL',1.3,v(41.15,2.35,-5.95),false,-.35);
 const looseName=addLabel('LOOSE', 'FREE ON THE SHAFT',1.6,v(44.7,.30,looseZ+.43),false,.75);
 const fastName=addLabel('FAST', 'KEYED TO THE SHAFT',1.6,v(44.7,.30,fastZ+.44),true,.75);
 const controlName=addLabel('SHIFT.', 'HANDLE → ROD → FORK',1.6,v(44.6,3.6,-6.65),true,.65);
 const bearingName=addLabel('BEARING', 'HOUSING REMAINS STILL',1.7,v(42.15,.0,-2.92));
 const chuckName=addLabel('SPINDLE', 'LOCAL OUTPUT / DRIVEN',1.5,v(42.15,-.35,-5.65),true);
 const radiusLines=new THREE.Group();radiusLines.position.set(42,5,-4.88);added.add(radiusLines);
 radiusLines.add(line([[0,0,0],[.61,.61,0],[1,.61,0]],paleLine));
 const radiusLabel=label('rD','DRIVER RADIUS',.8);radiusLabel.position.set(1.14,.73,0);radiusLines.add(radiusLabel);
 added.add(line([[43,1,looseZ+.45],[43.70,1.70,looseZ+.45],[44.05,1.7,looseZ+.45]],fineLine));
 added.add(line([[43.20,1.0,fastZ+.45],[43.75,.55,fastZ+.45],[44.25,.55,fastZ+.45]],accentLine));
 const stateCanvas=document.createElement('canvas');stateCanvas.width=1024;stateCanvas.height=256;const sc=stateCanvas.getContext('2d');const stateMap=new THREE.CanvasTexture(stateCanvas);stateMap.colorSpace=THREE.SRGBColorSpace;
 const stateLabel=new THREE.Mesh(new THREE.PlaneGeometry(2.7,.675),new THREE.MeshBasicMaterial({map:stateMap,transparent:true,depthWrite:false,side:THREE.DoubleSide}));stateLabel.position.set(42.4,2.60,-4.62);added.add(stateLabel);
 const torqueTicks=new THREE.Group();torqueTicks.position.set(43,-1,-5.16);added.add(torqueTicks);
 for(let i=0;i<32;i++){const a=i/32*TAU;torqueTicks.add(line([v(Math.cos(a)*.79,Math.sin(a)*.79),v(Math.cos(a)*(i%4?.84:.91),Math.sin(a)*(i%4?.84:.91))],fineLine));}
 const latheState=addLabel('READY.', 'LOCAL SPINDLE / AT REST',2.3,v(42.8,-2.54,-5.0));
 const turnState=addLabel('TURN.', 'LOCAL SPINDLE / DRIVEN',2.3,v(42.8,-2.54,-5.0),true);

 function angleAt(t){const travel=(t-12.4)*2.15*2.28+.028*2.15*Math.sin((t-12.4)*TAU/.686);return -travel/1.3+.31;}
 const engageStart=18.245,engageDuration=.42,engageEnd=engageStart+engageDuration;
 function sourceRate(t){return -(2.15*2.28+.028*2.15*(TAU/.686)*Math.cos((t-12.4)*TAU/.686))/1.3;}
 // Integrate a smooth traction ramp. Once fully running, the shaft follows the
 // exact source phase, including its small authored visual speed ripple.
 function rampIntegral(duration){const n=32,h=duration/n;let sum=0;for(let i=0;i<=n;i++){const u=i*h;const weight=i===0||i===n?1:i%2?4:2;sum+=weight*sourceRate(engageStart+u)*rA/rC*smooth(u/engageDuration);}return sum*h/3;}
 const rampEndAngle=rampIntegral(engageDuration);
 function counterAngle(t){if(t<=engageStart)return 0;if(t<engageEnd)return rampIntegral(t-engageStart);return rampEndAngle+(angleAt(t)-angleAt(engageEnd))*rA/rC;}
 const camTarget=v(),handPos=v();
 function cam(p,target,fov,bank=0){camera.position.copy(p);camera.up.set(0,1,0);camera.lookAt(target);camera.rotateZ(bank);camera.fov=fov;camera.updateProjectionMatrix();}
 function update(t){
  const old=base.update(t);added.visible=t>=17.1;
  if(t<17.1)return old;
  const shift=smooth((t-18.12)/.34),beltZ=mix(looseZ,fastZ,shift),theta=counterAngle(t),mainAngle=angleAt(t);
  mainWheel.rotation.z=mainAngle;
  const freeAt=angleAt(Math.min(t,18.40))*rA/rC;loose.rotation.z=t<=18.40?freeAt:freeAt+sourceRate(18.40)*rA/rC*(1-Math.exp(-.06*(t-18.40)))/.06;
  fast.rotation.z=theta;counter.rotation.z=theta;secondaryDriver.rotation.z=theta;secondaryDriven.rotation.z=theta*rSmall/rLathe;spindle.rotation.z=theta*rSmall/rLathe;
  primary.group.position.z=beltZ;beltMap.offset.x=mainAngle*rA/primary.length;
  secondaryMap.offset.x=theta*rSmall/secondary.length;
  for(let i=0;i<beltArrows.length;i++){const d=mod(-mainAngle*rA+i*primary.length/4,primary.length),p=primary.point(d),next=primary.point(d+.01);beltArrows[i].position.copy(p).add(v(0,0,.31));beltArrows[i].rotation.z=Math.atan2(next.y-p.y,next.x-p.x);}
  fork.position.set(forkPoint.x,forkPoint.y,beltZ);slidingCollar.position.set(44.08,2.33,beltZ);
  const leverAngle=Math.asin((beltZ-midZ)/1.12);lever.rotation.x=leverAngle;
  handPos.set(leverPivot.x,leverPivot.y+1.12*Math.cos(leverAngle),beltZ);
  setRod(link,handPos.clone(),v(44.08,2.33,beltZ));setRod(forkLink,v(44.08,2.33,beltZ),forkPoint.clone().setZ(beltZ).add(v(.15,.16,0)));
  hand.position.copy(handPos);hand.rotation.x=leverAngle*.35;
  const elbow=v(46.4,2.28,-4.55),wristPoint=handPos.clone().add(v(.44,.15,0));setRod(forearm,wristPoint,elbow);
  cuff.position.copy(wristPoint).lerp(elbow,.035);cuff.quaternion.copy(forearm.quaternion);
  sc.clearRect(0,0,1024,256);sc.fillStyle='#e9e2d2';sc.font='27px Consolas, monospace';sc.fillText('THE BELT RUNS. THE SHAFT CAN REST.',12,34);sc.font='750 76px Archivo';sc.fillStyle=t<18.26?'#e9e2d2':'#ff6237';sc.fillText(t<18.26?'REST.':'TURN.',10,123);sc.font='28px Consolas, monospace';sc.fillText(shift<.05?'LOOSE PULLEY / FREEWHEEL':shift<.99?'FORK TRAVEL → KEYED PULLEY':'FAST PULLEY / SHAFT DRIVEN',12,176);sc.fillStyle='#e9e2d2';sc.font='24px Consolas, monospace';sc.fillText('COUNTERSHAFT ANGLE  '+(theta*180/Math.PI).toFixed(1)+'°',12,224);stateMap.needsUpdate=true;
  latheState.visible=t<18.26;turnState.visible=t>=18.26;
  controlName.visible=t>=18.12&&t<18.7;stateLabel.visible=t>=17.93&&t<18.68;
  if(t<18.12){stateLabel.position.set(41.6,2.7,-5.9);stateLabel.rotation.y=-.5;stateLabel.scale.setScalar(.65);}else{stateLabel.position.set(44.15,2.94,-6.45);stateLabel.rotation.y=.65;stateLabel.scale.setScalar(.65);}
  driverName.visible=t<17.90;ratioName.visible=t<18.05;outgoingName.visible=t<18.0;returnName.visible=t<18.0;
  chuckName.visible=t>=18.62;torqueTicks.visible=t>=18.62;looseName.visible=t<18.7;fastName.visible=t<18.7;
  if(t<=17.22){const q=smooth((t-17.1)/.12);cam(v(39.5+.2*q,4.65+.10*q,-9.2-1.25*q),v(42.2,5,-35),72,0);}
  else if(t<17.65){const q=smooth((t-17.22)/.43);cam(v(39.7,4.75,-10.45).lerp(v(40.50,4.85,-3.55),q),v(42.2,5,-35).lerp(v(42.7,3.85,-6.0),q),mix(72,70,q),-.23*Math.sin(q*Math.PI));}
  else if(t<18.12){const q=smooth((t-17.65)/.47);cam(v(40.50,4.85,-3.55).lerp(v(40.80,2.25,-3.65),q),v(42.7,3.85,-6).lerp(v(43.2,1.60,-5.9),q),mix(70,64,q),mix(0,-.11,q));}
  else if(t<18.67){const q=smooth((t-18.12)/.55);cam(v(46.2,2.74,-3.35).lerp(v(45.55,2.28,-3.48),q),v(43.8,1.72,-5.91),mix(59,57,q),mix(.04,-.04,q));}
  else {const q=smooth((t-18.67)/.63);cam(v(44.80,1.05,-3.35).lerp(v(44.05,-.38,-3.55),q),v(43.1,.15,-6.45).lerp(v(43,-1,-5.39),q),mix(62,55,q),mix(-.04,.08,q));}
  return {...old,stage:t<17.65?'branch-reveal':t<18.12?'belt-descent':t<18.67?'local-belt-control':'local-spindle-response',beltShift:shift,localAngle:theta,localState:t<18.26?'rest':'turn'};
 }
 function resize(w,h){base.resize(w,h);}
 function dispose(){base.dispose();}
 return {scene,camera,update,resize,dispose};
}
