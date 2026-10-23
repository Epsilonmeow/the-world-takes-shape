import * as THREE from '../vendor/three.module.js';
import {createPlate,clamp} from './plate.js';
import {createTunnel} from './tunnel.js';
import {createPowerPlate} from './power-plate.js';
import {createFormation} from './formation.js';
import {createBranch} from './branch.js';

const DURATION=19.3;
const canvas=document.getElementById('stage');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:false,preserveDrawingBuffer:true,powerPreference:'high-performance'});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.NoToneMapping;
const plate=createPlate(),texture=new THREE.CanvasTexture(plate.canvas);
texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;
const power=createPowerPlate(),powerTexture=new THREE.CanvasTexture(power.canvas);powerTexture.colorSpace=THREE.SRGBColorSpace;powerTexture.minFilter=THREE.LinearFilter;powerTexture.magFilter=THREE.LinearFilter;
let tunnel,formation,rotary;
const spaceTarget=new THREE.WebGLRenderTarget(1920,1080,{depthBuffer:true,stencilBuffer:false,samples:4});spaceTarget.texture.colorSpace=THREE.SRGBColorSpace;
const uniforms={plate:{value:texture},space:{value:spaceTarget.texture},time:{value:0},blend:{value:0},hit:{value:0},hole:{value:new THREE.Vector2(.5,.5)},resolution:{value:new THREE.Vector2(1920,1080)}};
const material=new THREE.ShaderMaterial({uniforms,depthTest:false,depthWrite:false,
vertexShader:'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
fragmentShader:`precision highp float;
 varying vec2 vUv; uniform sampler2D plate,space; uniform float time,blend,hit; uniform vec2 resolution,hole;
 float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
 void main(){
 vec2 uv=vUv;vec2 middle=uv-.5;uv=.5+middle/(1.+hit*.015);uv+=vec2(hit*.003,-hit*.001);
 vec3 a=texture2D(plate,uv).rgb;vec3 b=texture2D(space,uv-(hole-.5)*(1.-smoothstep(.2,1.,blend))).rgb;
 float aperture=length((uv-hole)*vec2(1.777,1.));float edge=smoothstep(blend*1.65-.07,blend*1.65+.03,aperture);
 float m=blend>=.999?1.:blend<=.001?0.:1.-edge;vec3 col=mix(a,b,m);
 float noise=hash(floor(vUv*resolution)+floor(time*24.)*vec2(7.,13.))-.5;col+=noise*.0035;col*=1.-.12*dot(middle,middle);
 gl_FragColor=vec4(col,1.);
 #include <colorspace_fragment>
 }`});
const scene=new THREE.Scene(),camera=new THREE.Camera();scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));
const beats=[.237,.578,.919,1.26,1.601,1.942,2.283,2.624,2.965,3.306,3.647,3.988,4.329,4.67,5.011,5.352];
for(let i=16;i<57;i++)beats.push(.237+i*60/176);
let lastTime=0,playing=false,width=1920,height=1080,lastMs=0,lastScene='pressure';
function render(raw){
 const start=performance.now(),t=clamp(Number(raw)||0,0,DURATION);lastTime=t;let blend=0,world;
 if(t<5.4){
  uniforms.plate.value=texture;
  if(t<4.35){plate.render(Math.min(t,4.32));texture.needsUpdate=true;}
  blend=clamp((t-4.10)/.24);if(blend>0){tunnel.update(t);world=tunnel;}
  uniforms.hole.value.fromArray(plate.aperture(Math.min(t,4.34)));
  lastScene=t<1.6?'pressure':t<3.3?'heat-cycle':t<4.1?'redesign':'separate-space';
 }else if(t<7.5){
  power.render(t);powerTexture.needsUpdate=true;uniforms.plate.value=powerTexture;uniforms.hole.value.set(.5,.5);lastScene='connection';
 }else{
  world=t<10?formation:rotary;world.update(t);blend=1;uniforms.hole.value.set(.5,.5);lastScene=t<10?'formation':t<12.4?'sun-planet':t<14.8?'flywheel':t<17.1?'belt-to-shaft':'local-power';
 }
 if(world){renderer.setRenderTarget(spaceTarget);renderer.clear();renderer.render(world.scene,world.camera);}
 let h=0;for(const b of beats){const d=t-b;if(d>=0&&d<.12)h+=Math.exp(-d*32)*Math.cos(d*50);}
 uniforms.time.value=t;uniforms.blend.value=blend;uniforms.hit.value=h;
 renderer.setRenderTarget(null);renderer.render(scene,camera);lastMs=performance.now()-start;
}
function setSize(w,h){width=Math.max(2,Math.floor(w));height=Math.max(2,Math.floor(h));renderer.setSize(width,height,false);spaceTarget.setSize(width,height);for(const s of [tunnel,formation,rotary])s.resize(width,height);uniforms.resolution.value.set(width,height);render(lastTime);}
window.demo={ready:false,duration:DURATION,render,setSize,stats:()=>({time:lastTime,width,height,drawMs:lastMs,scene:lastScene,calls:renderer.info.render.calls}),get playing(){return playing},set playing(v){playing=!!v}};
try{
 const font=new FontFace('Archivo','url(./assets/Archivo.ttf)',{weight:'100 900'});document.fonts.add(await font.load());await document.fonts.ready;
 tunnel=createTunnel();formation=createFormation();rotary=createBranch();setSize(1920,1080);
 for(const t of [4.5,5.3,6,8.7,10.3,13.4,16.1,18.5,0])render(t);
 window.demo.ready=true;window.dispatchEvent(new Event('demoready'));
}catch(error){console.error(error);window.dispatchEvent(new CustomEvent('demoerror',{detail:error.message}));}

