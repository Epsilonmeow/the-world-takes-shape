// Authored engineering animation. Dimensions are diagram coordinates, not measurements.
const W = 1920, H = 1080;
const INK = '#151917', PAPER = '#e9e2d2', ORANGE = '#ff6237', GRAY = '#8f958a';
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const mix = (a, b, t) => a + (b - a) * t;
const ease = v => 1 - Math.pow(1 - clamp(v), 3);
const smooth = v => {v = clamp(v); return v * v * (3 - 2 * v);};
const frac = v => v - Math.floor(v);
const pulse = (t, at, length = .16) => t < at ? 0 : Math.exp(-(t - at) * 32) * Math.sin((t - at) * 57) * (t < at + length ? 1 : 0);

export function createPlate() {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const c = canvas.getContext('2d', {alpha:false});
  let ink = PAPER, bg = INK;
  function line(x1, y1, x2, y2, width = 2, col = ink, alpha = 1) {
    c.globalAlpha = alpha; c.strokeStyle = col; c.lineWidth = width;
    c.beginPath(); c.moveTo(x1,y1); c.lineTo(x2,y2); c.stroke(); c.globalAlpha = 1;
  }
  function path(points, width = 2, col = ink, amount = 1, alpha = 1) {
    let total = 0; const ds = [];
    for(let i=1;i<points.length;i++){const d = Math.hypot(points[i][0]-points[i-1][0],points[i][1]-points[i-1][1]);ds.push(d);total+=d;}
    let left = total * clamp(amount), last = points[0];
    c.strokeStyle=col;c.lineWidth=width;c.globalAlpha=alpha;c.beginPath();c.moveTo(...last);
    for(let i=1;i<points.length&&left>0;i++){const p=points[i],q=points[i-1],d=ds[i-1],a=Math.min(1,left/d);last=[mix(q[0],p[0],a),mix(q[1],p[1],a)];c.lineTo(...last);left-=d;}
    c.stroke();c.globalAlpha=1;return last;
  }
  function text(str,x,y,size=17,col=ink,weight=400,align='left',alpha=1) {
    c.fillStyle=col;c.globalAlpha=alpha;c.font=`${weight} ${size}px ${size>45?'Archivo':'"Courier New"'}, sans-serif`;c.textAlign=align;c.fillText(str,x,y);c.globalAlpha=1;
  }
  function label(lines,x,y,col=ink,alpha=1){lines.forEach((s,i)=>text(s,x,y+i*20,15,col,400,'left',alpha));}
  function circle(x,y,r,width=2,col=ink,fill=null){c.beginPath();c.arc(x,y,r,0,Math.PI*2);if(fill){c.fillStyle=fill;c.fill();}c.strokeStyle=col;c.lineWidth=width;c.stroke();}
  function arrow(x1,y1,x2,y2,col=ORANGE,w=3){line(x1,y1,x2,y2,w,col);const a=Math.atan2(y2-y1,x2-x1);line(x2,y2,x2-13*Math.cos(a-.5),y2-13*Math.sin(a-.5),w,col);line(x2,y2,x2-13*Math.cos(a+.5),y2-13*Math.sin(a+.5),w,col);}
  function cross(x,y,size=10,col=ink){line(x-size,y,x+size,y,1,col);line(x,y-size,x,y+size,1,col);}
  function cursor(x,y,angle=-.2){c.save();c.translate(x,y);c.rotate(angle);c.fillStyle=ORANGE;c.strokeStyle=bg;c.lineWidth=2;c.beginPath();c.moveTo(0,0);c.lineTo(7,31);c.lineTo(15,21);c.lineTo(30,21);c.closePath();c.fill();c.stroke();circle(0,0,10,1,ORANGE);c.restore();}
  function bolt(x,y,r=12){circle(x,y,r,2);circle(x,y,r*.4,1);line(x-r*.75,y-r*.75,x+r*.75,y+r*.75,1);}
  function hatch(x,y,w,h,step=12,col=ink,alpha=.35){c.save();c.beginPath();c.rect(x,y,w,h);c.clip();for(let a=-h;a<w+h;a+=step)line(x+a,y+h,x+a+h,y,1,col,alpha);c.restore();}
  function dim(x1,x2,y,caption,col=ink){line(x1,y-8,x1,y+8,1,col);line(x2,y-8,x2,y+8,1,col);line(x1,y,x2,y,1,col);line(x1,y,x1+9,y-5,1,col);line(x2,y,x2-9,y+5,1,col);text(caption,(x1+x2)/2,y-12,15,col,400,'center');}
  function measureRail(x,y,w,vertical=false){c.save();c.translate(x,y);if(vertical)c.rotate(Math.PI/2);for(let a=0;a<w;a+=16){line(a,0,a,a%80===0?16:7,1,ink,.55);if(a%160===0)text(String(a/16),a,32,12,ink,400,'center',.6);}c.restore();}
  function notes(x,y,n=6,col=ink){const list=['CYLINDER / LONGITUDINAL SECTION','ADMISSION → CONDENSATION','PISTON SEAL / PACKING','PRESSURE DIFFERENCE ACROSS PISTON','WORKING CHAMBER: STEAM → WATER','HEAT PASSES INTO THE WALL','DISPLACEMENT ALONG THE AXIS','INJECTION COOLS THE METAL'];for(let i=0;i<n;i++)text(list[i%list.length],x,y+i*19,12,col,400,'left',.62);}
  function world(camera, fn){c.save();c.translate(960,540);c.rotate(camera.r);c.scale(camera.z,camera.z);c.translate(-camera.x,-camera.y);fn();c.restore();}
  function paperLines(t, light=false){
    const col=light?INK:PAPER;
    for(let i=0;i<19;i++){const y=70+i*61;line(60,y,1860,y,1,col,.033);}
    for(let i=0;i<33;i++){const x=60+i*57;line(x,40,x,1040,1,col,.028);}
    for(let i=0;i<37;i++){let x=100+frac(i*.618033)*1730,y=80+frac(i*.38197)*940;cross(x,y,4,col);}
    c.globalAlpha=1;
  }
  function cylinder(t,piston,{amount=1,heat=1,steam=1,construction=true,small=false}={}){
    const x=230,y=315,w=1140,h=410;
    // A thick, cut metal wall with repeated machining marks, not a floating icon.
    c.fillStyle=bg;c.fillRect(x-45,y-48,w+90,h+96);
    c.fillStyle=heat>.4?ORANGE:ink;c.globalAlpha=.08+.08*heat;c.fillRect(x,y-42,w,42);c.fillRect(x,y+h,w,42);c.globalAlpha=1;
    const boundary=[[x-35,y+h+45],[x-35,y-45],[x+w+35,y-45],[x+w+35,y+h+45],[x-35,y+h+45]];
    const tip=path(boundary,4,ink,amount);
    path([[x,y+h],[x,y],[x+w,y],[x+w,y+h],[x,y+h]],2,ink,amount);
    hatch(x,y-44,w,43,13,ink,.6);hatch(x,y+h,w,43,13,ink,.6);
    // A parallel rear edge and tie rods give the cutaway a solid body.
    path([[x-35,y-45],[x+10,y-90],[x+w+80,y-90],[x+w+35,y-45]],2,ink,1,.48);
    for(let i=0;i<30;i++)line(x+10+i*36,y-90,x-35+i*36,y-45,1,ink,.2);
    line(x+10,y-90,x+10,y-130,1,ink,.3);line(x+w+80,y-90,x+w+80,y-130,1,ink,.3);
    for(const yy of [y-53,y+h+52]){line(x-75,yy,x+w+72,yy,3,ink,.55);for(const xx of [x-83,x+w+70])for(let k=0;k<6;k++)line(xx+k*3,yy-8,xx+k*3,yy+8,1,ink,.8);}
    for(let a=0;a<20;a++){const xx=x+18+a*58;line(xx,y-41,xx+38,y-3,1,heat>.6?ORANGE:ink,.5);line(xx,y+h+3,xx+38,y+h+41,1,ink,.4);}
    // Flange, rings, studs and the thick iron end cap.
    for(const xx of [x-35,x+w+5]){c.fillStyle=bg;c.fillRect(xx-30,y-77,60,h+154);for(const dx of [-30,-22,22,30])line(xx+dx,y-77,xx+dx,y+h+77,2);for(const yy of [y-63,y+48,y+h-48,y+h+63])bolt(xx,yy,12);line(xx-30,y-77,xx+30,y-77);line(xx-30,y+h+77,xx+30,y+h+77);}
    line(x-90,y-105,x+w+80,y-105,1,ink,.45);if(construction){text('SECTION A—A',x-85,y-118,16);text('CAST IRON / BORED SURFACE',x+w-355,y-118,15);}
    // Inlet valve is open only on admission. The route exists physically in the drawing.
    path([[x-250,y+110],[x-115,y+110],[x-115,y+205],[x,y+205]],13,ink);
    path([[x-250,y+110],[x-115,y+110],[x-115,y+205],[x,y+205]],7,bg);
    circle(x-180,y+110,23,2);line(x-200,y+95,x-160,y+125,3,steam>.3?ORANGE:ink);
    circle(x-115,y+205,8,2,ORANGE,ORANGE);
    // Steam is made of flowing engraving strokes; its velocity is visibly directional.
    c.save();c.beginPath();c.rect(x+3,y+3,Math.max(1,piston-x-14),h-6);c.clip();
    const g=c.createLinearGradient(x,y,piston,y);g.addColorStop(0,'rgba(255,98,55,.05)');g.addColorStop(.75,`rgba(255,98,55,${.06+.22*steam})`);g.addColorStop(1,'rgba(255,98,55,.03)');c.fillStyle=g;c.fillRect(x,y,w,h);
    for(let i=0;i<128;i++){
      const yy=y+15+frac(i*.618034)*(h-30),p=frac(i*.27183+t*(.6+frac(i*.13)*.5));
      const xx=x+p*(piston-x); const l=10+frac(i*.381)*60;
      line(xx-l,yy,xx,yy, i%13===0?3:1, i%5===0?ink:ORANGE,(.18+frac(i*.43)*.6)*steam);
      if(i%13===0)line(xx,yy,xx-8,yy-4,1,ORANGE,steam);
    }
    c.restore();
    // Reciprocating assembly, packing rings and piston rod. All drawn at the same position.
    c.fillStyle=bg;c.fillRect(piston-40,y-2,82,h+4);hatch(piston-36,y,70,h,10,ink,.48);
    for(const dx of [-43,-34,-23,24,35,44])line(piston+dx,y+2,piston+dx,y+h-2,dx===-43||dx===44?4:1);
    c.fillStyle=bg;c.fillRect(piston+44,y+h/2-21,1000,42);line(piston+44,y+h/2-21,2280,y+h/2-21,4);line(piston+44,y+h/2+21,2280,y+h/2+21,4);line(piston+44,y+h/2-13,2280,y+h/2-13,1,ink,.5);
    for(let i=0;i<9;i++)line(piston+61+i*10,y+h/2-21,piston+61+i*10,y+h/2+21,1,ink,.5);
    circle(piston,y+h/2,16,2,ink,bg);cross(piston,y+h/2,8);
    // Datum and dimensions remain attached when the camera accelerates.
    c.setLineDash([22,7,3,7]);line(x-200,y+h/2,x+w+360,y+h/2,1,ink,.45);c.setLineDash([]);
    dim(x,piston,y+h+104,'S T R O K E   /   x');
    measureRail(x,y+h+132,w);
    if(construction){
      path([[piston-36,y+80],[piston-105,y+5],[piston-350,y+5]],1,ink,clamp((t-.35)*4),.6);
      label(['01 / PACKING RINGS','STEAM-TIGHT SLIDING SEAL'],piston-355,y-28,ink,clamp((t-.35)*4));
      path([[x+200,y+15],[x+275,y-60],[x+510,y-60]],1,ink,clamp((t-.12)*4),.6);
      text('02 / CYLINDER WALL',x+285,y-70,15,ink,400,'left',clamp((t-.2)*4));
      text('ADMIT',x-210,y+40,16,ORANGE);text(steam>.3?'VALVE / OPEN':'VALVE / CLOSED',x-255,y+280,13);
      text('Δp × A → FORCE',x+90,y+140,25,ink,600,'left',clamp((t-.7)*5));
      if(!small){
        for(let i=0;i<5;i++){
          const show=clamp((t-.16-i*.17)*9);const xx=x+85+i*190;
          path([[xx,y+h+50],[xx+22,y+h+82],[xx+145,y+h+82]],1,ink,show,.5);
          text(['SEAL / FIBRE PACKING','METAL / HEAT CAPACITY','BORE / SLIDING CONTACT','ROD / AXIAL LOAD','JOINT / FLANGED'][i],xx+26,y+h+79,10,ink,400,'left',show*.8);
        }
      }
      if(!small)label(['AXIAL DISPLACEMENT','ROD → EXTERNAL LOAD','SEAL MAINTAINS Δp'],x+w+120,y+h+166,ink,.62);
    }
    if(amount<1)cursor(...tip,.1);
  }

  function opening(t){
    ink=PAPER;bg=INK;c.fillStyle=bg;c.fillRect(0,0,W,H);
    const a=clamp(t/1.6),hit=pulse(t,.578)+pulse(t,.919)+pulse(t,1.26);
    const piston=530+ease((t-.18)/1.34)*555;
    const camera={x:600+ease(t/1.6)*280+hit*14,y:500-2*a,z:1.86-.84*ease(t/1.6)+hit*.022,r:-.085+.11*smooth(t/1.6)+hit*.009};
    world(camera,()=>{
      // The out-of-frame scale and cropped lettering establish a physical graphic world.
      text('PRESSURE',190,188,130,ink,800,'left',.96);
      text('RETURN',1490,645,30,ORANGE,800);text('STROKE',1490,687,30,ink,800);
      line(165,210,1640,210,1,ink,.5);
      text('01  /  ADMISSION',185,240,16,ORANGE);
      text('THE WORKING CHAMBER',1230,240,17,ink);
      cylinder(t,piston,{amount:Math.min(1,.18+t*1.3),heat:.8,steam:smooth(t/.32)});
      arrow(piston+155,780,piston+390,780,ORANGE,6);
      text('x →',piston+155,825,26,ink,500);
      notes(235,950,3);
      text('I',1680,1010,190,ink,800,'center',.22);
      if(t>.47&&t<1.35){const q=frac((t-.47)/.29);cursor(1230+q*130,260+q*76,-.7);cross(1230,260,10,ORANGE);}
      const p=ease((t-.88)/.4);path([[965,701],[1020,927],[1340,927]],2,ORANGE,p);text('A MOVING BOUNDARY',1040,952,15,ink,400,'left',p);
      text('ENGINE STUDIES  /  I',177,1040,12,ink,400,'left',.5);
    });
    // Short-lived ink ticks underline strikes rather than a permanent interface frame.
    if(hit>.2){line(0,40,W,40,6,ORANGE,hit*.4);}
  }

  function thermal(t){
    const q=t-1.6;ink=INK;bg=PAPER;c.fillStyle=bg;c.fillRect(0,0,W,H);
    const reheating=q>.78;
    const e=reheating?q-.78:q;
    const heat=reheating?smooth(e/.48):1-smooth(q/.38);
    const kick=pulse(q,0)+pulse(q,.34)+pulse(q,.78)+pulse(q,1.12);
    const camera=reheating
      ?{x:930-45*ease(e/.8),y:380,z:1.48-.1*ease(e/.8)+kick*.035,r:.095-.045*ease(e/.8)}
      :{x:770+90*smooth(q/1.7),y:325+30*Math.sin(q*2),z:1.48-.18*smooth(q/1.7)+kick*.035,r:-.17+.08*smooth(q/1.7)};
    world(camera,()=>{
      const piston=reheating?900+160*ease(e/.8):1085-270*ease(q/.7);
      cylinder(t,piston,{heat,steam:reheating?smooth(e/.3):1-smooth(q/.35),construction:false});
      // Steam collapse represented by contracting trajectories ending in droplets.
      c.save();c.beginPath();c.rect(238,320,piston-280,399);c.clip();
      for(let i=0;i<68;i++){
        const xx=270+frac(i*.618)*700,yy=350+frac(i*.271)*320;
        const collapse=smooth(q/.5);const x2=mix(xx,590+frac(i*.33)*100,collapse),y2=mix(yy,690,collapse);
        if(!reheating){line(xx,yy,x2,y2,1,ink,(1-collapse)*.48);circle(x2,y2,1.5+frac(i*.37)*2,1,ink,ink);}
      }c.restore();
      // Heat paths cut straight through the wall; reheating reverses their direction.
      for(let i=0;i<25;i++){
        const x=300+i*39,p=frac(q*1.8+i*.173);
        const y=reheating?360-p*82:278+p*82;
        line(x,278,x,360,1,ORANGE,.3);
        line(x,y,x,y+(reheating?1:-1)*(17+heat*20),2.5,ORANGE,.5+.5*(1-p));
        if(i%4===0)arrow(x,reheating?360:278,x,reheating?278:360,ORANGE,2);
      }
      const title=reheating?'AGAIN.':'HEAT. LOST.';
      text(title,reheating?650:260,reheating?150:94,reheating?165:123,INK,850);
      text(reheating?'02  /  FRESH STEAM. THE SAME COLD METAL.':'01  /  INJECTION CONDENSES THE STEAM',reheating?650:268,reheating?184:141,17,INK);
      text('Q',1160,205,70,ORANGE,750);
      text(reheating?'BACK INTO THE METAL':'WALL → INJECTION WATER',1220,175,15);
      label(reheating?['FRESH STEAM → COLD WALL','METAL ABSORBS HEAT']:['STEAM → WATER / p FALLS','THE METAL COOLS TOO'],1220,200,INK,.8);
      text('WALL',280,301,21,ORANGE,700);
      dim(325,575,204,'CYLINDER WALL',INK);
      if(reheating){
        text('HEAT. LOST.',250,111,86,INK,850,'left',.075);
        path([[430,425],[430,470],[665,470],[665,425]],1,INK,1,.4);
        text('PREVIOUS STROKE',460,490,12,INK,400,'left',.5);
        cursor(330+ease(e/.8)*620,280,-Math.PI/2);
      }else{cursor(1050-ease(q/.7)*500,286,2.5);}
      text(reheating?'II':'I',1450,600,290,INK,850,'center',.13);
      label(['WORKING SUBSTANCE / STEAM','STEAM ADMISSION → CONDENSATION','HEAT IN → HEAT OUT → HEAT IN'],240,815,INK,.8);
      const xs=[240,365,490,615,740];for(let i=0;i<4;i++){const yy=910;path([[xs[i],yy],[xs[i]+25,yy-52],[xs[i]+70,yy-52],[xs[i]+100,yy]],2,INK,clamp((q*2.5-i)*2),.5);text(String(i+1).padStart(2,'0'),xs[i]+40,yy+28,12,INK,400,'center',.6);}
      text('REPETITION IS THE PROBLEM.',860,925,27,INK,700);
    });
  }

  const route=[[1080,708],[1080,855],[1530,855],[1530,390],[2020,390],[2020,720],[2440,720]];
  function routeCamera(q){
    const p=smooth((q-.28)/.69),d=smooth((q-.78)/.26);
    return {x:mix(mix(845,1900,p),2020,d),y:mix(mix(510,555,p),720,d),z:mix(mix(.92,1.56,p),2.5,d),r:mix(-.025,-Math.PI*.25,smooth((q-.57)/.45))};
  }
  function aperture(t){const cam=routeCamera(t-3.3),x=(2020-cam.x)*cam.z,y=(720-cam.y)*cam.z;return [(960+Math.cos(cam.r)*x-Math.sin(cam.r)*y)/W,1-(540+Math.sin(cam.r)*x+Math.cos(cam.r)*y)/H];}
  function redraw(t){
    const q=t-3.3;ink=INK;bg=PAPER;c.fillStyle=bg;c.fillRect(0,0,W,H);
    const routeProgress=ease((q-.18)/.75);
    const camera=routeCamera(q);
    world(camera,()=>{
      text('III',100,200,180,INK,850,'left',.24);
      text('SAME CYCLE?',370,142,104,INK,850);
      text('NO.',1180,142,104,ORANGE,850,'left',ease(q/.18));
      line(360,165,1430,165,1,INK,.4);
      cylinder(t,1060,{heat:1,steam:.3,construction:true,small:true});
      // Old injection route is cancelled at its point of entry, then a distinct outlet is made.
      const old=[[620,265],[620,535],[750,535]];
      path(old,3,INK,1,.35);
      label(['IN-CYLINDER','CONDENSATION'],610,205,INK,.45);
      const cut=ease(q/.16);path([[575,218],[697,301],[581,281],[704,219]],5,ORANGE,cut);
      path([[585,326],[692,395],[590,395],[696,330]],3,ORANGE,cut);
      const tip=path(route,18,ORANGE,routeProgress);
      path(route,8,PAPER,routeProgress);
      path(route,2,ORANGE,routeProgress);
      for(let i=0;i<8;i++){const x=1100+i*52;if(routeProgress>.05+i*.03){arrow(x,880,x+28,880,ORANGE,2);}}
      if(q>.13)cursor(...tip,-.3);
      text('KEEP THE CYLINDER HOT.',320,1035,43,INK,800);
      text('MOVE THE COLD.',1430,1020,75,ORANGE,850);
      text('SEPARATE THE TWO TEMPERATURES',1545,315,23,INK,650);
      label(['NEW PATH / EXHAUST STEAM','OUTSIDE THE WORKING CHAMBER'],1560,350,INK,.85);
      measureRail(1500,1045,690);
      circle(2020,720,150,3,INK);circle(2020,720,126,1,INK);circle(2020,720,112,4,ORANGE);
      for(let i=0;i<12;i++){const a=i*Math.PI/6;bolt(2020+137*Math.cos(a),720+137*Math.sin(a),7);}
      cross(2020,720,175,INK);
      text('B',2020,513,42,INK,750,'center');
      label(['1765 / SEPARATE CONDENSER','J. WATT / NEW ARRANGEMENT'],2085,935,INK,.7);
      notes(1910,1140,5);
      if(q>.5){const p=ease((q-.5)/.25);path([[2050,870],[2210,1030],[2500,1030]],2,INK,p,.55);}
      // Marks cross the sheet boundary, opening an unbounded space.
      line(1730,-160,1730,1300,1,INK,.18);line(1722,-160,1722,1300,1,INK,.12);
    });
  }

  function render(t){
    c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.lineCap='butt';c.lineJoin='miter';
    if(t<1.6)opening(t);else if(t<3.3)thermal(t);else redraw(t);
    return canvas;
  }
  return {canvas,render,aperture};
}
