// The power stroke is a pressure difference, not a material pulling vacuum.
const W=1920,H=1080,INK='#151917',BONE='#e9e2d2',HOT='#ff6237';
const clamp=(x)=>Math.max(0,Math.min(1,x));
const mix=(a,b,t)=>a+(b-a)*t;
const ease=x=>1-(1-clamp(x))**3;
const smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
const frac=x=>x-Math.floor(x);
export function createPowerPlate(){
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const c=canvas.getContext('2d',{alpha:false});
 function line(a,b,d,e,w=2,color=BONE,alpha=1){c.strokeStyle=color;c.lineWidth=w;c.globalAlpha=alpha;c.beginPath();c.moveTo(a,b);c.lineTo(d,e);c.stroke();c.globalAlpha=1;}
 function path(p,w=2,color=BONE,alpha=1){c.strokeStyle=color;c.lineWidth=w;c.globalAlpha=alpha;c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.stroke();c.globalAlpha=1;}
 function text(s,x,y,size=16,color=BONE,weight=400,alpha=1){c.fillStyle=color;c.globalAlpha=alpha;c.font=`${weight} ${size}px ${size>44?'Archivo':'"Courier New"'},sans-serif`;c.fillText(s,x,y);c.globalAlpha=1;}
 function circle(x,y,r,w=2,color=BONE,fill=null){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill()}c.lineWidth=w;c.strokeStyle=color;c.stroke();}
 function arrow(x,y,X,Y,color=HOT,w=3){line(x,y,X,Y,w,color);const a=Math.atan2(Y-y,X-x);line(X,Y,X-15*Math.cos(a-.5),Y-15*Math.sin(a-.5),w,color);line(X,Y,X-15*Math.cos(a+.5),Y-15*Math.sin(a+.5),w,color);}
 function hatch(x,y,w,h,color=BONE){c.save();c.beginPath();c.rect(x,y,w,h);c.clip();for(let i=-h;i<w+h;i+=12)line(x+i,y+h,x+i+h,y,1,color,.4);c.restore();}
 function bolt(x,y,r=9){circle(x,y,r,2);circle(x,y,r*.4,1);line(x-r*.7,y-r*.7,x+r*.7,y+r*.7,1);}
 function drawCondenser(t){
  const q=t-5.4,x=1470,y=570;
  // The final flange drops into registration, then the central steam cloud collapses.
  const seat=1-ease(q/.19),r=210+seat*55;
  circle(x,y,r+37,6);circle(x,y,r+21,1);circle(x,y,r,5,HOT);
  circle(x,y,192,2,BONE,INK);
  for(let i=0;i<32;i++){const a=i*Math.PI/16,xx=x+(r+27)*Math.cos(a),yy=y+(r+27)*Math.sin(a);bolt(xx,yy,6);line(x+193*Math.cos(a),y+193*Math.sin(a),x+209*Math.cos(a),y+209*Math.sin(a),1,BONE,.6);}
  const collapse=smooth((q-.18)/.34);
  c.save();c.beginPath();c.arc(x,y,189,0,Math.PI*2);c.clip();
  for(let i=0;i<110;i++){
   const a=i*2.39996,rr=Math.sqrt(frac(i*.617))*176;
   const xx=x+rr*Math.cos(a),yy=y+rr*Math.sin(a);
   const X=mix(xx,x+(frac(i*.39)-.5)*240,collapse),Y=mix(yy,y+155+frac(i*.13)*25,collapse);
   if(collapse<.99)line(xx,yy,X,Y,1,BONE,.3);
   circle(X,Y,1.3+frac(i*.41)*2,1,BONE,BONE);
  }
  for(let i=0;i<18;i++){const xx=x-130+i*15,yy=y+mix(-70,155,frac(t*1.4+i*.153));line(xx,yy,xx,yy+12,1,BONE,.2*collapse);}
  if(collapse>0){c.fillStyle=BONE;c.globalAlpha=.12*collapse;c.fillRect(x-190,y+155,380,60);c.globalAlpha=1;for(let i=0;i<9;i++)line(x-170,y+158+i*4,x+170,y+158+i*4,1,BONE,.45);}
  c.restore();
  text('CONDENSER',x-147,y-91,37,BONE,650);text('STEAM → WATER',x-136,y-46,23,HOT,500);
  text('p ↓',x-57,y+50,68,BONE,800,collapse);
  path([[x+154,y+188],[x+255,y+287],[x+460,y+287]],1,BONE,.7);
  text('CONDENSATE',x+257,y+280,16);text('DRAIN → AIR PUMP',x+257,y+306,13);
  path([[x,y+200],[x,y+322],[x+450,y+322]],12,BONE,.7);path([[x,y+200],[x,y+322],[x+450,y+322]],6,INK);
  arrow(x+80,y+322,x+145,y+322,BONE,2);
  text('COLD',x-128,y+410,86,BONE,800);text('A SEPARATE DUTY',x-120,y+442,16);
  if(q<.28){c.save();c.translate(x,y);c.rotate(-.3+ease(q/.28)*.3);text('SEAT / LOCK',-85,-r-71,16,HOT);c.restore();}
 }
 function drawCylinder(t){
  const q=t-5.4;
  let p=720;
  if(q>.48)p=mix(720,350,ease((q-.48)/.4));
  if(q>1.02)p=mix(350,640,smooth((q-1.02)/.25));
  if(q>1.29)p=mix(640,310,ease((q-1.29)/.32));
  const x=80,y=350,w=850,h=340;
  c.fillStyle=INK;c.fillRect(x-50,y-45,w+100,h+90);
  for(const yy of [y-42,y+h]){c.fillStyle=HOT;c.globalAlpha=.2;c.fillRect(x,yy,w,42);c.globalAlpha=1;hatch(x,yy,w,42,HOT);line(x,yy,x+w,yy,3,HOT);line(x,yy+42,x+w,yy+42,3,HOT);}
  for(const xx of [x-30,x+w+30]){for(const d of [-22,-14,14,22])line(xx+d,y-65,xx+d,y+h+65,2);for(const yy of [y-55,y+50,y+h-50,y+h+55])bolt(xx,yy,10);}
  // Uniform hot wall remains while the connected chamber pressure falls.
  c.save();c.beginPath();c.rect(x,y,p-x-29,h);c.clip();
  c.fillStyle=HOT;c.globalAlpha=.07;c.fillRect(x,y,w,h);c.globalAlpha=1;
  for(let i=0;i<92;i++){const X=x+frac(i*.318-t*.8)*(p-x),Y=y+frac(i*.618)*h;line(X,Y,X+20+frac(i*.71)*25,Y,1,HOT,.18+.15*frac(i*.13));}
  c.restore();
  c.fillStyle=INK;c.fillRect(p-31,y,62,h);hatch(p-29,y,58,h);
  for(const d of [-33,-23,23,33])line(p+d,y,p+d,y+h,d===-33||d===33?5:2);
  c.fillStyle=INK;c.fillRect(p+33,y+146,1100-p-33,48);for(const dy of [146,154,186,194])line(p+33,y+dy,1100,y+dy,dy===146||dy===194?4:1);
  // A drafting break ends the rod view before the separate cold vessel.
  path([[1088,y+134],[1104,y+158],[1088,y+182],[1104,y+206]],3);
  circle(p,y+170,17,3);line(p-8,y+170,p+8,y+170,1);line(p,y+162,p,y+178,1);
  c.setLineDash([22,7,3,7]);line(x-60,y+170,1120,y+170,1,BONE,.35);c.setLineDash([]);
  const pressure=clamp((q-.35)/.3);
  for(let i=0;i<7;i++){
   const yy=y+39+i*43,X=p+90+frac(q*1.8+i*.31)*260;
   arrow(X+70,yy,X,yy,BONE,2+pressure);
  }
  text('Δp · A',p+125,y+120,37,BONE,600);
  text('PRESSURE DIFFERENCE',p+115,y+244,15);
  path([[p-24,y+80],[p+20,y-100],[p+300,y-100]],1,BONE,.6);
  text('NET FORCE → POWER STROKE',p+25,y-110,14);
  text('HOT',80,253,88,HOT,850);text('THE WALL KEEPS ITS HEAT',83,288,16);
  text('WORKING CYLINDER',370,y+412,19);text('COLD DUTY MOVED OUTSIDE',370,y+438,15,HOT);
  for(let i=0;i<16;i++){const xx=x+i*55;line(xx,y+h+82,xx,y+h+90+(i%4===0?8:0),1,BONE,.5);}
  // Physical exhaust path is below the moving rod, so the two cannot be confused.
  const pipe=[[270,690],[270,910],[1130,910],[1130,570],[1270,570]];
  path(pipe,17,BONE);path(pipe,9,INK);
  circle(815,910,25,3,BONE,INK);line(795,910,835,910,4,HOT);
  text('EXHAUST / OPEN',724,961,16,HOT);
  for(let i=0;i<14;i++){
   const s=frac(t*.65+i/14),d=s*1560;let X,Y,dx=0,dy=0;
   if(d<220){X=270;Y=690+d;dy=15}else if(d<1080){X=270+d-220;Y=910;dx=15}else if(d<1420){X=1130;Y=910-(d-1080);dy=-15}else{X=1130+d-1420;Y=570;dx=15}
   line(X,Y,X+dx,Y+dy,3,HOT,.9);
  }
  text('STEAM PASSES TO THE COLD VESSEL',360,999,16,BONE,400,.6);
  return p;
 }
 function render(t){
  const q=t-5.4;c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.fillStyle=INK;c.fillRect(0,0,W,H);
  const reveal=ease((q-.13)/.63),follow=smooth((q-1.25)/.62);
  let cx=mix(1470,950,reveal),cy=mix(570,566,reveal),z=mix(1.8,.91,reveal),r=mix(.025,-.045,reveal);
  cx=mix(cx,650,follow);cy=mix(cy,520,follow);z=mix(z,1.5,follow);r=mix(r,.055,follow);
  const kick=Math.max(0,1-q/.12)*.06+Math.max(0,1-Math.abs(q-.66)/.1)*.02;
  c.save();c.translate(960,540);c.rotate(r);c.scale(z+kick,z+kick);c.translate(-cx,-cy);
  const p=drawCylinder(t);drawCondenser(t);
  text('CONNECTED.',180,104,137,BONE,850,ease((q-.08)/.2));
  line(180,132,1730,132,1,BONE,.45);
  text('TWO TEMPERATURES. ONE WORKING SYSTEM.',590,165,19);
  if(q>1.28){const e=ease((q-1.28)/.28);path([[p+160,770],[p+270,837],[p+610,837]],3,HOT,e);text('PUT IT TO WORK.',p+278,888,48,HOT,800,e);}
  for(const [x,y] of [[42,210],[1840,150],[1040,1018]]){line(x-12,y,x+12,y,1,BONE,.4);line(x,y-12,x,y+12,1,BONE,.4);}
  c.restore();return canvas;
 }
 return {canvas,render};
}
