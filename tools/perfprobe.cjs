'use strict';
const http=require('node:http');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright');
const {WebSocketServer}=require('ws');
(async()=>{
 let browser,server,ffmpeg,sockets;
 try{
  ffmpeg=spawn(process.env.FFMPEG_PATH || 'ffmpeg',['-hide_banner','-loglevel','error','-f','rawvideo','-pixel_format','rgba','-video_size','1280x720','-framerate','30','-i','pipe:0','-vf','vflip','-an','-c:v','libx264','-preset','fast','-crf','17','-pix_fmt','yuv420p','-f','null','-'],{windowsHide:true,stdio:['pipe','ignore','pipe']});
  ffmpeg.stderr.on('data',c=>process.stderr.write(c));ffmpeg.stdin.on('error',()=>{});
  server=http.createServer((req,res)=>{res.setHeader('Access-Control-Allow-Origin','*');res.setHeader('Access-Control-Allow-Headers','Content-Type');res.setHeader('Access-Control-Allow-Methods','POST, OPTIONS');if(req.method==='OPTIONS'){res.end();return;}let chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>{let data=Buffer.concat(chunks);if(req.url==='/encode')ffmpeg.stdin.write(data,()=>res.end('ok'));else res.end('ok');});});
  sockets=new WebSocketServer({server});sockets.on('connection',socket=>socket.on('message',bytes=>ffmpeg.stdin.write(bytes,()=>socket.send('ok'))));
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true,args:['--enable-webgl','--ignore-gpu-blocklist','--disable-background-timer-throttling','--disable-renderer-backgrounding']});
  let page=await browser.newPage({viewport:{width:1280,height:720}});await page.goto(process.env.DEMO_URL || 'http://127.0.0.1:5196/?export=1',{waitUntil:'networkidle'});await page.waitForFunction(()=>window.demo?.ready);await page.evaluate(()=>window.demo.setSize(1280,720));
  for(const mode of ['read','discard','encode','ws','png'])for(let i=0;i<3;i++){
   let result=await page.evaluate(async({mode,i,url})=>{let a=performance.now();window.demo.render(7.3+i/30);let b=performance.now(),canvas=document.getElementById('stage'),bytes=0;
    if(mode==='png'){bytes=canvas.toDataURL('image/png').length;return {mode,drawMs:b-a,pngMs:performance.now()-b,bytes};}
    const gl=canvas.getContext('webgl2');let pixels=new Uint8Array(1280*720*4);gl.readPixels(0,0,1280,720,gl.RGBA,gl.UNSIGNED_BYTE,pixels);let c=performance.now();
    if(mode==='ws'){if(!window._ws){window._ws=new WebSocket(url.replace('http:','ws:'));await new Promise(r=>window._ws.addEventListener('open',r,{once:true}));}await new Promise(r=>{window._ws.addEventListener('message',r,{once:true});window._ws.send(pixels);});}
    else if(mode!=='read'){let response=await fetch(url+'/'+mode,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:pixels});await response.text();}
    return {mode,drawMs:b-a,readMs:c-b,fetchMs:performance.now()-c,totalMs:performance.now()-a};
   },{mode,i,url:'http://127.0.0.1:'+server.address().port});console.log(JSON.stringify(result));
  }
 }finally{await browser?.close();ffmpeg?.stdin.end();ffmpeg?.kill();sockets?.close();server?.closeAllConnections();server?.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
