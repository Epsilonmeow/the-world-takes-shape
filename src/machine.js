import * as T from '../vendor/three.module.js';
const clamp=x=>Math.max(0,Math.min(1,x)), smooth=x=>{x=clamp(x);return x*x*(3-2*x)}, mix=(a,b,x)=>a+(b-a)*x;
export function createMachine(){
 const scene=new T.Scene();scene.background=new T.Color('#080e15');scene.fog=new T.Fog('#080e15',28,80);
 const camera=new T.PerspectiveCamera(38,16/9,.05,200);
 scene.add(new T.HemisphereLight(0xe8e8dd,0x182332,2.7));const key=new T.DirectionalLight(0xffd5a0,4.5);key.position.set(-5,10,10);scene.add(key);const rim=new T.DirectionalLight(0x7dbad2,2);rim.position.set(5,3,-5);scene.add(rim);
 const mat=new T.MeshStandardMaterial({color:0x515e63,metalness:.76,roughness:.36});const bone=new T.MeshStandardMaterial({color:0xd8cbb4,metalness:.55,roughness:.32});const hot=new T.MeshStandardMaterial({color:0xff662b,emissive:0xff4508,emissiveIntensity:.2,metalness:.45,roughness:.33});const black=new T.MeshStandardMaterial({color:0x0d1820,metalness:.7,roughness:.38});
 const machine=new T.Group();machine.position.x=-2;scene.add(machine);const parts=[];
 function piece(geo,material,x,y,z,group=machine){let m=new T.Mesh(geo,material);m.position.set(x,y,z);group.add(m);return m;}
 function box(w,h,d,x,y,z,m=mat){const o=piece(new T.BoxGeometry(w,h,d),m,x,y,z);const edges=new T.LineSegments(new T.EdgesGeometry(o.geometry),new T.LineBasicMaterial({color:0x9a9e93,transparent:true,opacity:.5}));o.add(edges);return o;}
 function cyl(r,len,x,y,z,m=bone,axis='z'){const o=piece(new T.CylinderGeometry(r,r,len,32),m,x,y,z);if(axis==='z')o.rotation.x=Math.PI/2;if(axis==='x')o.rotation.z=Math.PI/2;return o;}
 box(10.6,.35,4,2,-2.5,0,black);box(10.8,.08,4.2,2,-2.28,0,bone);
 for(const z of [-1.25,1.25]){box(.7,2.2,.55,0,-1.3,z);box(5.4,.32,.3,3.2,-.9,z);for(const x of [-1.8,1.8,5.5]){cyl(.12,.22,x,-2.1,z,bone,'y');}}
 const wheel=new T.Group();machine.add(wheel);for(const z of [-.46,.46]){const tor=piece(new T.TorusGeometry(1.95,.15,10,96),bone,0,0,z,wheel);const ring=piece(new T.TorusGeometry(1.70,.045,6,96),hot,0,0,z,wheel);}
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const spoke=piece(new T.BoxGeometry(1.62,.14,.7),i%3===0?bone:mat,Math.cos(a)*.95,Math.sin(a)*.95,0,wheel);spoke.rotation.z=a;}
 cyl(.33,4.7,0,0,0,mat);const gear=new T.Group();gear.position.z=1.0;machine.add(gear);piece(new T.TorusGeometry(.85,.1,6,60),hot,0,0,0,gear);for(let i=0;i<36;i++){let a=i/36*Math.PI*2;let tooth=piece(new T.BoxGeometry(.14,.21,.3),bone,Math.cos(a)*.93,Math.sin(a)*.93,0,gear);tooth.rotation.z=a-Math.PI/2;}
 const cylinder=cyl(.76,2.45,5.75,0,0,black,'x');cylinder.material=new T.MeshStandardMaterial({color:0x6f7e80,metalness:.5,roughness:.3,transparent:true,opacity:.42,depthWrite:false});
 for(let x of [4.5,4.75,6.7,7]){const end=cyl(.83,.12,x,0,0,bone,'x');for(let k=0;k<8;k++){const a=k*Math.PI/4;cyl(.07,.18,x,Math.cos(a)*.68,Math.sin(a)*.68,black,'x');}}
 const piston=cyl(.65,.35,5,0,0,hot,'x');const rod=cyl(.11,1,0,0,.7,bone,'y');const pin=cyl(.19,.45,0,0,.73,hot,'z');const slide=cyl(.1,3,5,0,0,bone,'x');
 const inlet=new T.CatmullRomCurve3([new T.Vector3(6,0,-.6),new T.Vector3(6,1.7,-.6),new T.Vector3(5.6,2.1,-.6),new T.Vector3(4.3,2.1,-.6)]);piece(new T.TubeGeometry(inlet,24,.10,8,false),hot,0,0,0);
 const inlet2=new T.CatmullRomCurve3([new T.Vector3(6.5,0,.7),new T.Vector3(6.5,1.2,1),new T.Vector3(7.3,1.2,1),new T.Vector3(7.5,-1,1)]);piece(new T.TubeGeometry(inlet2,24,.09,8,false),bone,0,0,0);
 const particles=new T.InstancedMesh(new T.SphereGeometry(.045,5,4),new T.MeshBasicMaterial({color:0xffb85f}),60);machine.add(particles);const dummy=new T.Object3D();
 const ground=piece(new T.PlaneGeometry(180,180),new T.MeshStandardMaterial({color:0x0a1119,roughness:.9}),0,-2.73,0,scene);ground.rotation.x=-Math.PI/2;
 const grid=new T.GridHelper(100,50,0x344048,0x15242d);grid.position.y=-2.71;scene.add(grid);
 const plate=new T.Group();machine.add(plate);for(let k=0;k<10;k++){box(.03,.45,.1,4.7+k*.18,0,.83,hot);}
 machine.children.forEach((o,i)=>{if(o!==particles){parts.push({o,p:o.position.clone(),offset:new T.Vector3(Math.sin(i*3.7)*3,Math.cos(i*2.3)*2,(i%2?1:-1)*3),i});}});
 const yAxis=new T.Vector3(0,1,0);let cp=new T.Vector3(),target=new T.Vector3();
 function update(t,aspect){
   camera.aspect=aspect;camera.updateProjectionMatrix();const assembly=smooth((t-2.75)/.9);
   for(const {o,p,offset,i}of parts){let k=smooth((t-2.75-i%5*.045)/.65);o.position.copy(p).addScaledVector(offset,1-k);o.scale.setScalar(.12+.88*k);}
   const theta=(t*1.3+Math.max(0,t-3)*2.6);const r=1.23,l=3.85;const qx=r*Math.cos(theta),qy=r*Math.sin(theta),sx=qx+Math.sqrt(l*l-qy*qy);
   wheel.rotation.z=theta;gear.rotation.z=theta;pin.position.set(qx,qy,.75);piston.position.x=sx+1.75;slide.position.x=sx+.35;slide.scale.y=1;rod.position.set((qx+sx)/2,qy/2,.75);rod.scale.set(1,l,1);rod.quaternion.setFromUnitVectors(yAxis,new T.Vector3(sx-qx,-qy,0).normalize());
   for(let i=0;i<60;i++){const p=((i/60+t*.7)%1);let v=inlet.getPointAt(p);dummy.position.copy(v);dummy.scale.setScalar(.6+.6*Math.sin(p*Math.PI));dummy.updateMatrix();particles.setMatrixAt(i,dummy.matrix);}particles.instanceMatrix.needsUpdate=true;
   const a=smooth((t-3.05)/1.1);cp.set(mix(2.5,5.5,a),mix(2.1,4,a),mix(15,12,a));target.set(0,0,0);
   if(t>=4.45&&t<5.25){const p=(t-4.45)/.8;cp.set(-2.3+p*.4,.7,5.5-p*.55);target.set(-1.3,.0,.4);}
   if(t>=5.25){let p=smooth((t-5.25)/1.35);cp.set(mix(8,-1.3,p),mix(5.3,1.15,p),mix(16,3.4,p));target.set(-1.3,.45,0);}
   camera.position.copy(cp);camera.lookAt(target);return {angle:theta,slider:sx};
 }
 return {scene,camera,update};
}
