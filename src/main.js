import * as T from '../vendor/three.module.js';
import {createMachine} from './machine.js';
import {createFactory} from './factory.js';
import {createNetwork} from './network.js';
const W=1920,H=1080,DURATION=22;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)},out=x=>1-Math.pow(1-clamp(x),4),mix=(a,b,x)=>a+(b-a)*x;
const P={paper:'#ede6d8',ink:'#080e15',orange:'#ff662b',muted:'#a5b2b6',gold:'#ffca6a'};
const params=new URLSearchParams(location.search),exporting=params.has('export');
const canvas=document.getElementById('stage');
const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false,powerPreference:'high-performance',preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
renderer.info.autoReset=false;
const rt=new T.WebGLRenderTarget(W,H,{type:T.HalfFloatType,depthBuffer:true,samples:4});
const rtB=new T.WebGLRenderTarget(W,H,{type:T.HalfFloatType,depthBuffer:true,samples:4});
const overlay=document.createElement('canvas');overlay.width=W;overlay.height=H;const g=overlay.getContext('2d');const overlayTex=new T.CanvasTexture(overlay);overlayTex.colorSpace=T.SRGBColorSpace;overlayTex.minFilter=T.LinearFilter;overlayTex.generateMipmaps=false;
const fullScene=new T.Scene(),fullCamera=new T.Camera();
const post=new T.ShaderMaterial({uniforms:{src:{value:rt.texture},srcB:{value:rt.texture},typeLayer:{value:overlayTex},res:{value:new T.Vector2(W,H)},t:{value:0},impact:{value:0},fade:{value:1}},depthTest:false,depthWrite:false,vertexShader:`varying vec2 uvv;void main(){uvv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`precision highp float;
 varying vec2 uvv;uniform sampler2D src;uniform sampler2D srcB;uniform sampler2D typeLayer;uniform vec2 res;uniform float t,impact,fade;
 vec3 srgb(vec3 x){return mix(x*12.92,1.055*pow(max(x,vec3(0.)),vec3(1./2.4))-.055,step(vec3(.0031308),x));}
 float rand(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
 void main(){vec2 u=uvv;vec2 shift=impact*vec2(sin(t*81.),cos(t*97.))*2./res;u=(u-.5)/(1.+impact*.012)+.5+shift;
 vec3 c=(texture2D(src,u).rgb+texture2D(srcB,u).rgb)*.5;vec3 bloom=vec3(0.);for(int i=0;i<8;i++){float a=float(i)*.785398;vec3 s=texture2D(src,u+vec2(cos(a),sin(a))*5./res).rgb;bloom+=max(s-1.1,0.)/8.;}c+=bloom*.32;
 c=vec3(1.)-exp(-c*1.15);float vig=1.-.22*pow(length(uvv-.5),1.4);c*=vig;
 vec4 text=texture2D(typeLayer,uvv);c=mix(c,text.rgb,text.a);c=srgb(c);c+=(rand(gl_FragCoord.xy+floor(t*60.))-.5)*.006;c*=fade;gl_FragColor=vec4(c,1.);}`});
fullScene.add(new T.Mesh(new T.PlaneGeometry(2,2),post));
const machine=createMachine(),factory=createFactory(),network=createNetwork();
const hits=[0,.9,1.8,3.05,4.45,5.25,6.6,8.4,10.0,11.6,13.4,14.85,16.1,17.6,19.2,20.4];
let time=0,playing=false,startClock=0,startTime=0,lastInfo={};
function line(x1,y1,x2,y2,color=P.paper,width=1,alpha=1){g.globalAlpha=alpha;g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();g.globalAlpha=1;}
function text(s,x,y,size=22,color=P.paper,weight=500,align='left',alpha=1){g.globalAlpha=alpha;g.fillStyle=color;g.font=`${weight} ${size}px Archivo`;g.textAlign=align;g.fillText(s,x,y);g.globalAlpha=1;}
function circle(x,y,r,color=P.paper,width=1,alpha=1){g.globalAlpha=alpha;g.strokeStyle=color;g.lineWidth=width;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.stroke();g.globalAlpha=1;}
function mono(s,x,y,size=18,color=P.paper){g.font=`${size}px Consolas,monospace`;g.fillStyle=color;g.textAlign='left';g.fillText(s,x,y);}
function bracket(x,y,dx,dy,color){line(x,y,x+dx,y,color,2);line(x,y,x,y+dy,color,2);}
function word(s,x,y,size,local,color=P.paper){const a=out(local/.14);g.save();g.translate(x,y+35*(1-a));g.scale(1+.05*(1-a),1+.05*(1-a));text(s,0,0,size,color,900,'left',a);g.restore();}
function label(s,x,y,scale=1){text(s,x,y,17*scale,P.muted,600);}
const blueprintPaths=[];
function bpLine(...p){blueprintPaths.push(p);}
const cx=515,cy=575,r=188,L=440;
for(const rr of [r,r-24,32]){const p=[];for(let i=0;i<=96;i++){let a=i/96*Math.PI*2;p.push(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);}blueprintPaths.push(p);}
for(let k=0;k<12;k++){let a=k/12*Math.PI*2;bpLine(cx+Math.cos(a)*40,cy+Math.sin(a)*40,cx+Math.cos(a)*(r-24),cy+Math.sin(a)*(r-24));}
bpLine(975,470,1355,470,1355,680,975,680,975,470);bpLine(950,453,950,700,1377,700,1377,453,950,453);
for(const x of [984,1000,1330,1346])bpLine(x,460,x,690);
bpLine(1160,470,1160,400,1260,400,1260,350,1530,350);bpLine(1195,680,1195,754,1460,754);
bpLine(320,790,1450,790,1450,825,320,825,320,790);for(let x=350;x<1450;x+=40)bpLine(x,790,x+25,825);
bpLine(cx-18,cy+35,cx-45,785,cx+45,785,cx+18,cy+35);
const lengths=blueprintPaths.map(p=>{let s=0;for(let i=2;i<p.length;i+=2)s+=Math.hypot(p[i]-p[i-2],p[i+1]-p[i-1]);return s});const totalLength=lengths.reduce((a,b)=>a+b,0);
function drawBlueprint(t){
 g.fillStyle=P.paper;g.fillRect(0,0,W,H);
 for(let x=64;x<W;x+=40)line(x,330,x,870,P.ink,.6,.10);for(let y=350;y<880;y+=40)line(270,y,1560,y,P.ink,.6,.1);
 const stage=t<.9?0:t<1.8?1:2;const words=['A LINE.','A LINK.','A MACHINE.'];word(words[stage],86,230,160,t-[0,.9,1.8][stage],P.ink);
 text('IMAGINATION / GIVEN GEOMETRY',92,285,23,P.ink,500);
 let remaining=totalLength*out(t/2.3),cursor=[cx+r,cy];g.lineWidth=2.1;g.strokeStyle=P.ink;
 for(let j=0;j<blueprintPaths.length;j++){if(remaining<=0)break;const p=blueprintPaths[j];g.beginPath();g.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2){const len=Math.hypot(p[i]-p[i-2],p[i+1]-p[i-1]);if(remaining<len){const u=remaining/len;cursor=[mix(p[i-2],p[i],u),mix(p[i-1],p[i+1],u)];g.lineTo(...cursor);remaining=0;break;}g.lineTo(p[i],p[i+1]);remaining-=len;cursor=[p[i],p[i+1]];}g.stroke();}
 const theta=t*2.6;const px=cx+Math.cos(theta)*r*.68,py=cy+Math.sin(theta)*r*.68,sx=px+Math.sqrt(L*L-Math.pow(py-cy,2));
 if(t>.72){line(cx,cy,px,py,P.orange,7);line(px,py,sx,cy,P.ink,12);line(px,py,sx,cy,P.paper,7);circle(px,py,15,P.orange,4);circle(sx,cy,13,P.orange,3);line(sx,cy,1240,cy,P.orange,5);g.fillStyle=P.orange;g.fillRect(sx+160,490,16,169);}
 circle(...cursor,9,P.orange,2);line(cursor[0]-18,cursor[1],cursor[0]+18,cursor[1],P.orange);line(cursor[0],cursor[1]-18,cursor[0],cursor[1]+18,P.orange);
 mono('x(θ) = r cos θ + √(l² − r² sin²θ)',1040,915,22,P.ink);mono(`θ = ${(theta*180/Math.PI%360).toFixed(1)}°`,1040,955,20,P.ink);
 const entries=['DEFINE / A DEGREE OF FREEDOM','CONSTRAIN / A CONNECTING ROD','TRANSFER / LINEAR INTO ROTARY','REPEAT / EACH COMPLETE CYCLE'];for(let i=0;i<4;i++){if(t>i*.46)text(entries[i],92,912+i*31,18,P.ink,600);}
 if(t>1.3){text('CYLINDER',1250,425,18,P.ink,600);text('FLYWHEEL',360,375,18,P.ink,600);line(cx,860,cx+r,860,P.ink,1.4);line(cx,851,cx,869,P.ink,1.4);line(cx+r,851,cx+r,869,P.ink,1.4);mono('r',cx+r/2,884,18,P.ink);}
 if(t>2.56){const p=smooth((t-2.56)/.49);g.save();g.translate(W/2,H/2);g.scale(1+p*.18,1+p*.18);g.strokeStyle=P.orange;g.lineWidth=2;g.strokeRect(-W/2+42,-H/2+42,W-84,H-84);g.restore();text('CONSTRAINTS RESOLVED',1815,967,19,P.ink,700,'right');}
}
function engineeringFrame(t,section){
 const shade=g.createLinearGradient(0,0,0,360);shade.addColorStop(0,'rgba(8,14,21,.57)');shade.addColorStop(1,'rgba(8,14,21,0)');g.fillStyle=shade;g.fillRect(0,0,W,360);
 const margin=52;for(const a of [[margin,margin,22,22],[W-margin,margin,-22,22],[margin,H-margin,22,-22],[W-margin,H-margin,-22,-22]])bracket(...a,P.muted);
 text(section,86,94,20,P.paper,600);text('THE WORLD TAKES SHAPE',1834,94,18,P.muted,600,'right');
 line(86,1014,1834,1014,P.paper,1,.3);line(86,1014,86+1748*(t/DURATION),1014,P.orange,3);
 const ticks=Math.floor(t*4);for(let i=0;i<88;i++){line(86+i*19.85,1026,86+i*19.85,i%4?1032:1038,i<=ticks?P.orange:P.muted,1,i<=ticks?1:.22);}
}
function waveform(x,y,w,t){const n=110;for(let i=0;i<n;i++){let u=i/n;let a=Math.sin(u*4*Math.PI-t*7);line(x+u*w,y,x+u*w,y-a*25,P.orange,1.5,.8);} }
function drawOverlay(t){
 g.clearRect(0,0,W,H);g.lineCap='butt';
 if(t<3.05){drawBlueprint(t);return;}
 if(t<6.6){engineeringFrame(t,'IDEA → WORK');const work=t>=4.45;if(work){const scrim=g.createLinearGradient(55,0,925,0);scrim.addColorStop(0,'rgba(8,14,21,.82)');scrim.addColorStop(.70,'rgba(8,14,21,.62)');scrim.addColorStop(1,'rgba(8,14,21,0)');g.fillStyle=scrim;g.fillRect(55,120,870,222);}word(work?'WORK.':'MAKE.',86,257,145,t-(work?4.45:3.05));
 text(work?'LINEAR FORCE → ROTARY MOTION':'A CONSTRAINT BECOMES A CAPABILITY',92,304,22,P.muted,500);
 label('SLIDER–CRANK / KINEMATIC STUDY',92,910);mono('r = 1.23   l = 3.85   l/r = 3.13',92,949,20,P.paper);waveform(1330,935,440,t);label('DISPLACEMENT / θ',1420,988);
 if(t>5.25){word('PASS IT ON.',1040,235,74,t-5.25,P.orange);line(1045,261,1790,261,P.orange,2);}
 }else if(t<13.4){const q=t-6.6;engineeringFrame(t,'WORK → PRODUCTION');
 if(q<1.8){word('REPEAT.',86,254,144,q);text('ONE MECHANISM / A SHARED DRIVE',92,304,22,P.muted,600);}
 else if(q<3.4){word('CHANGE',86,230,110,q-1.8);word('THE SCALE.',86,340,110,q-1.92);text('A DIFFERENT VIEW / A LARGER SYSTEM',92,388,22,P.orange,600);}
 else if(q<5){word('ONE → MANY',86,250,114,q-3.4);text('POWER IS DISTRIBUTED. WORK IS COORDINATED.',92,300,22,P.muted,500);}
 else{word('MULTIPLY.',86,245,132,q-5);text('THE MACHINE BECOMES AN ORGANISATION.',92,295,22,P.muted,500);}
 label('COMMON SHAFT',92,911);label('REPEATED STATIONS',92,943);label('CONTINUOUS MATERIAL FLOW',92,975);
 for(let i=0;i<4;i++){text(['FORM','TRANSFER','PRESS','DISPATCH'][i],1195+i*158,952,19,P.paper,650);const p=(q*1.9)%4;circle(1227+i*158,907,8,i<=p?P.orange:P.muted,2);if(i<3)line(1240+i*158,907,1370+i*158,907,P.muted,1,.5);}
 }else{
 const q=t-13.4;engineeringFrame(t,'PRODUCTION → CIVILISATION');
 if(q<1.45){word('REACH.',86,245,145,q);text('DISTANCE BECOMES A CONNECTION.',92,295,22,P.muted,500);}
 else if(q<2.7){word('LINK.',86,245,145,q-1.45);text('RAIL. POWER. INFORMATION.',92,295,22,P.muted,500);}
 else if(q<5.8){word('EVERY PART',86,218,97,q-2.7);word('SETS ANOTHER',86,312,97,q-2.8);word('IN MOTION.',86,406,97,q-2.9,P.orange);}
 else{
 const p=out((q-5.8)/.8);g.fillStyle=`rgba(8,14,21,${p*.52})`;g.fillRect(0,115,W,820);
 word('THE WORLD',86,430,182,q-5.8);word('TAKES SHAPE.',86,610,182,q-6.02);
 text('BUILT BY US.  STILL BECOMING.',96,688,30,P.orange,600,'left',out((q-6.6)/.6));
 }
 if(q<5.8){label('TRANSPORT / DISTRIBUTION / COORDINATION',92,950);text('A SYSTEM THAT KEEPS MOVING',1830,950,20,P.paper,600,'right');}
 else{text('IMAGINE  →  MAKE  →  CONNECT',92,950,24,P.paper,600);text('A SILENT MOTION STUDY',1830,950,20,P.muted,600,'right');}
 }
}
function sceneAt(t,target){const which=t<6.6?machine:t<13.4?factory:network;which.update(t<6.6?t:t<13.4?t-6.6:t-13.4,16/9);renderer.setRenderTarget(target);renderer.clear();renderer.render(which.scene,which.camera);}
function render(t){time=clamp(t,0,DURATION);t=time;const start=performance.now();renderer.info.reset();
 if(exporting&&t>=3.05){let a=0,b=DURATION;for(const h of hits){if(h<=t)a=h;else{b=h;break;}}sceneAt(Math.max(a+.00001,t-1/360),rt);sceneAt(Math.min(b-.00001,t+1/360),rtB);post.uniforms.srcB.value=rtB.texture;}else{sceneAt(t,rt);post.uniforms.srcB.value=rt.texture;}drawOverlay(time);overlayTex.needsUpdate=true;
 let impact=0;for(const hit of hits){const d=t-hit;if(d>=0&&d<.23)impact=Math.max(impact,Math.exp(-d*22));}
 post.uniforms.t.value=t;post.uniforms.impact.value=impact;post.uniforms.fade.value=t>21.7?mix(1,.85,smooth((t-21.7)/.3)):1;
 renderer.setRenderTarget(null);renderer.render(fullScene,fullCamera);
 lastInfo={time,scene:t<6.6?'machine':t<13.4?'factory':'network',temporalSamples:exporting&&t>=3.05?2:1,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures,cpuRenderMs:performance.now()-start};return lastInfo;
}
function setSize(w,h){renderer.setSize(w,h,false);rt.setSize(w,h);rtB.setSize(w,h);post.uniforms.res.value.set(w,h);}
function resize(){const rect=document.getElementById('screen').getBoundingClientRect();setSize(Math.max(2,Math.round(rect.width)),Math.max(2,Math.round(rect.width*9/16)));render(time);}
const play=document.getElementById('play'),seek=document.getElementById('seek'),clock=document.getElementById('clock');
function ui(){seek.value=String(time);clock.textContent=`${time.toFixed(2).padStart(5,'0')} / 22.00`;play.textContent=playing?'暂停':'播放';}
function toggle(){if(time>=DURATION)time=0;playing=!playing;startClock=performance.now();startTime=time;ui();}
play.onclick=toggle;document.getElementById('reset').onclick=()=>{time=0;playing=true;startClock=performance.now();startTime=0;render(0);ui();};
seek.oninput=()=>{playing=false;render(Number(seek.value));ui();};document.addEventListener('keydown',e=>{if(e.code==='Space'){e.preventDefault();toggle();}if(e.code==='ArrowLeft'||e.code==='ArrowRight'){e.preventDefault();playing=false;render(time+(e.code==='ArrowRight'?1:-1)*(e.shiftKey?1:1/60));ui();}});
function tick(now){if(playing&&!exporting){const t=Math.min(DURATION,startTime+(now-startClock)/1000);render(t);if(t>=DURATION)playing=false;ui();}requestAnimationFrame(tick);}
window.demo={ready:false,duration:DURATION,render,setSize,stats:()=>lastInfo,get playing(){return playing},set playing(v){playing=v;startClock=performance.now();startTime=time}};
try{await document.fonts.load('900 160px Archivo');await document.fonts.ready;setSize(W,H);render(exporting?0:.4);renderer.compile(machine.scene,machine.camera);renderer.compile(factory.scene,factory.camera);renderer.compile(network.scene,network.camera);if(!exporting){resize();window.addEventListener('resize',resize);}document.getElementById('loading').remove();window.demo.ready=true;ui();requestAnimationFrame(tick);}catch(error){document.getElementById('loading').textContent='渲染初始化失败：'+error.message;window.demo.error=error.message;throw error;}
