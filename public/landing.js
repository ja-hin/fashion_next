/* =============== theme toggle (in-memory, light default) =============== */
const root=document.documentElement;
const modeBtn=document.getElementById("modeBtn"),modeTxt=document.getElementById("modeTxt");
modeBtn.addEventListener("click",()=>{
  const dark=root.getAttribute("data-theme")==="dark";
  root.setAttribute("data-theme",dark?"light":"dark");
  modeTxt.textContent=dark?"Dark":"Light";
});

/* =============== SVG croquis fallbacks (used if an image fails) =============== */
const skin="#E7C6A8",skin2="#D8AE8C",garment="#E4572E",garmentB="#B93E1F",hair="#2A231C";
const BACKDROPS=["#40506b","#7a5a41","#3c4a41","#5d4a5a","#54452f","#3f3f52"];
const bg=c=>`<rect width="100" height="133" fill="${c}"/>`;
const head=(x,y,r,back)=>back?`<circle cx="${x}" cy="${y}" r="${r}" fill="${hair}"/>`:`<circle cx="${x}" cy="${y}" r="${r}" fill="${skin}"/><path d="M${x-r},${y-2} a${r},${r} 0 0 1 ${2*r},0 z" fill="${hair}"/>`;
const POSES={
 front:c=>`${bg(c)}${head(50,30,9)}<path d="M42 40 q8 -5 16 0 l6 34 q-14 6 -28 0 z" fill="${garment}"/><path d="M42 40 l-5 26 M58 40 l5 26" stroke="${skin2}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M45 74 l-2 34 M55 74 l2 34" stroke="${skin}" stroke-width="5" stroke-linecap="round"/>`,
 walk:c=>`${bg(c)}${head(52,29,9)}<path d="M43 40 q9 -5 17 0 l4 33 q-13 6 -25 1 z" fill="${garment}"/><path d="M44 41 l-7 24 M60 41 l7 20" stroke="${skin2}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M47 73 l-8 33 M56 73 l9 32" stroke="${skin}" stroke-width="5" stroke-linecap="round"/>`,
 hip:c=>`${bg(c)}${head(49,30,9)}<path d="M41 40 q9 -5 17 0 l5 34 q-13 6 -26 0 z" fill="${garment}"/><path d="M42 41 q-10 8 -4 20 M59 41 l6 24" stroke="${skin2}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M46 74 l-2 34 M55 74 l2 34" stroke="${skin}" stroke-width="5" stroke-linecap="round"/>`,
 back:c=>`${bg(c)}${head(50,30,9,true)}<path d="M42 40 q8 -5 16 0 l6 34 q-14 6 -28 0 z" fill="${garmentB}"/><path d="M42 40 l-5 26 M58 40 l5 26" stroke="${skin2}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M45 74 l-2 34 M55 74 l2 34" stroke="${skin2}" stroke-width="5" stroke-linecap="round"/>`,
 close:c=>`${bg(c)}<circle cx="50" cy="60" r="30" fill="${skin}"/><path d="M20 60 a30 30 0 0 1 60 0 z" fill="${hair}"/><path d="M35 96 q15 -14 30 0 l0 37 -30 0 z" fill="${garment}"/><circle cx="42" cy="58" r="2.4" fill="${hair}"/><circle cx="58" cy="58" r="2.4" fill="${hair}"/>`,
 garment:c=>`${bg(c)}<path d="M38 34 l12 -6 l12 6 l-4 10 l-2 -3 l0 42 q-12 4 -24 0 l0 -42 l-2 3 z" fill="${garment}"/><path d="M46 30 q4 4 8 0" stroke="${garmentB}" stroke-width="2" fill="none"/>`,
 saree:c=>`${bg(c)}${head(50,28,8.5)}<path d="M43 38 q7 -4 14 0 l7 55 q-4 14 -14 14 q-10 0 -14 -14 z" fill="${garment}"/><path d="M43 38 l14 55" stroke="${garmentB}" stroke-width="3" fill="none"/><path d="M43 39 l-6 24 M57 39 l6 24" stroke="${skin2}" stroke-width="4" fill="none" stroke-linecap="round"/>`
};
const frameSVG=(p,c)=>`<svg viewBox="0 0 100 133" preserveAspectRatio="xMidYMid slice">${POSES[p](c)}</svg>`;

/* =============== IMAGERY =============================================
   HOW TO USE YOUR OWN IMAGES (no code needed):
   1. Create a folder named  Webassets  next to this HTML file.
   2. Drop your photos in with these exact names (.jpg, .png or .webp):

      garment    — the input flat-lay/packshot        (sheet frame 00, hero)
      front      — model, front full-body             (sheet 01, hero, card 02)
      walk       — model walking                      (sheet 02, hero, card 02)
      hip        — model three-quarter                (sheet 03)
      back       — model from behind                  (sheet 04, hero, card 02)
      closeup    — model close-up                     (sheet 05, hero, card 02)
      saree      — ethnic-wear shot                   (hero drift)
      extra1..5  — any five varied shots              (hero, card 01 grid)

   e.g.  Webassets/front.jpg, Webassets/closeup.png, Webassets/extra3.webp
   Each slot tries your file first, then the Unsplash placeholder,
   then a drawn figure — the page never shows a broken image.
   ==================================================================== */
const ASSET_DIR="Webassets/";
const EXTS=["jpg","png","webp"];
const U=(id,w)=>`https://images.unsplash.com/${id}?q=80&w=${w}&auto=format&fit=crop`;
const IMG={ /* slot -> Unsplash placeholder id */
  front:"photo-1515886657613-9f3515b0c78f",
  walk:"photo-1509631179647-0177331693ae",
  hip:"photo-1496747611176-843222e1e57c",
  back:"photo-1524504388940-b1c1722653e1",
  closeup:"photo-1529626455594-4ff0802cfb7e",
  saree:"photo-1583391733956-6c78276477e2",
  garment:"photo-1521572163474-6864f9cf17ab",
  extra1:"photo-1539109136881-3be0616acf4b",
  extra2:"photo-1483985988355-763728e1935b",
  extra3:"photo-1469334031218-e382a71b716b",
  extra4:"photo-1490481651871-ab68de25d43d",
  extra5:"photo-1487412720507-e7ab37603c6f"
};
/* image element that tries: assets/<slot>.jpg/.png/.webp -> Unsplash -> drawn figure */
function mkImg(slot,w,pose,bcolor,alt){
  const queue=EXTS.map(e=>ASSET_DIR+slot+"."+e);
  if(IMG[slot])queue.push(U(IMG[slot],w));
  const img=document.createElement("img");
  img.alt=alt||("AI-generated on-model fashion photo — "+slot.replace(/\d+$/,"")+" view, AImageGen sample");img.loading="lazy";
  img.addEventListener("error",()=>{
    if(queue.length){img.src=queue.shift();return;}
    const wrap=img.parentElement;if(!wrap)return;
    const s=document.createElement("div");
    s.style.cssText="position:absolute;inset:0";
    s.innerHTML=frameSVG(pose,bcolor);
    s.querySelector("svg").style.cssText="width:100%;height:100%";
    img.replaceWith(s);
  });
  img.src=queue.shift();
  return img;
}

/* =============== hero drifting frames =============== */
const heroBg=document.getElementById("heroBg");
const drift=[
 {img:"front",p:"front",x:5,y:10,w:170,d:.35},
 {img:"walk",p:"walk",x:20,y:56,w:200,d:.6},
 {img:"back",p:"back",x:78,y:6,w:180,d:.5},
 {img:"closeup",p:"close",x:85,y:52,w:210,d:.75},
 {img:"extra1",p:"hip",x:43,y:74,w:160,d:.45},
 {img:"saree",p:"saree",x:62,y:16,w:150,d:.3},
 {img:"garment",p:"garment",x:10,y:74,w:140,d:.55}
];
const driftEls=[];
drift.forEach((f,i)=>{
  const d=document.createElement("div");d.className="drift";
  d.style.left=f.x+"%";d.style.top=f.y+"%";d.style.width=f.w+"px";d.style.aspectRatio="3/4";
  d.appendChild(mkImg(f.img,400,f.p,BACKDROPS[i%BACKDROPS.length]));
  heroBg.appendChild(d);driftEls.push({el:d,d:f.d});
});

/* =============== contact sheet =============== */
const sheetFrames=[
 {img:"garment",p:"garment",l:"THE GARMENT",tag:1},
 {img:"front",p:"front",l:"FRONT · FULL",id:1},
 {img:"walk",p:"walk",l:"WALKING",id:1},
 {img:"hip",p:"hip",l:"THREE-QUARTER",id:1},
 {img:"back",p:"back",l:"BACK",id:1},
 {img:"closeup",p:"close",l:"CLOSE-UP",id:1}
];
function renderSheet(){
  const host=document.getElementById("frames");host.innerHTML="";
  sheetFrames.forEach((f,i)=>{
    const c=f.p==="garment"?"#221f19":BACKDROPS[(i-1)%BACKDROPS.length];
    const d=document.createElement("div");d.className="frame pop"+(f.tag?" garment":"");
    d.style.animationDelay=(0.15+i*0.16)+"s";
    d.appendChild(mkImg(f.img,420,f.p,c));
    d.insertAdjacentHTML("beforeend",`<span class="fnum">${String(i).padStart(2,"0")}</span>${f.tag?'<span class="tag">Input</span>':''}${f.id?'<span class="idc"></span>':''}<span class="fpose">${f.l}</span>`);
    host.appendChild(d);
  });
  const s=document.getElementById("scan");s.classList.remove("run");void s.offsetWidth;s.classList.add("run");
}
let sheetRun=false;
document.getElementById("replay").addEventListener("click",renderSheet);

/* rail visuals */
function fillGrid(id,items){
  const g=document.getElementById(id);
  items.forEach((it,i)=>{
    const d=document.createElement("div");
    d.appendChild(mkImg(it.img,260,it.p,BACKDROPS[i%BACKDROPS.length]));
    g.appendChild(d);
  });
}
/* 01 — any pose/backdrop/mood: four different shots */
fillGrid("vg1",[{img:"extra2",p:"front"},{img:"extra3",p:"hip"},{img:"extra4",p:"walk"},{img:"extra5",p:"close"}]);
/* 02 — your own AI models, same face across SKUs */
fillGrid("vg2",[{img:"front",p:"front"},{img:"walk",p:"walk"},{img:"back",p:"back"},{img:"closeup",p:"close"}]);
/* 03 — custom prompt: typed prompt + resolved shot tags */
document.getElementById("pv1").innerHTML=`
  <div class="pline">&gt; golden-hour terrace, side profile, dupatta mid-swirl<span class="pc"></span></div>
  <div class="parrow">↳ COMPOSED</div>
  <div class="ptags"><span class="ptag hot">side profile</span><span class="ptag hot">golden hour</span><span class="ptag">terrace bg</span><span class="ptag">fabric in motion</span><span class="ptag">3/4 framing</span></div>`;
/* 04 — Prompt Genie: plain words in, studio-grade prompt out */
document.getElementById("pv2").innerHTML=`
  <div class="pline">you: "festive, rich, wedding-guest vibe"</div>
  <div class="parrow">↳ GENIE DRAFTS IN 2s</div>
  <div class="pline genie">&gt; editorial full-body, warm tungsten haze, sandstone arch backdrop, jewellery visible, confident stance, soft rim light<span class="pc"></span></div>`;

/* =============== custom cursor =============== */
const cur=document.getElementById("cur");
let cx=innerWidth/2,cy=innerHeight/2,tx=cx,ty=cy;
addEventListener("mousemove",e=>{tx=e.clientX;ty=e.clientY;});
document.querySelectorAll("a,button,[data-c]").forEach(el=>{
  el.addEventListener("mouseenter",()=>cur.classList.add("big"));
  el.addEventListener("mouseleave",()=>cur.classList.remove("big"));
});

/* =============== scroll engine =============== */
const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
let scrollY_s=window.scrollY;
const lerp=(a,b,t)=>a+(b-a)*t;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const ease=t=>1-Math.pow(1-t,3);

const nav=document.getElementById("nav");
const progress=document.getElementById("progress");
const sc1=document.getElementById("sc1"),sc2=document.getElementById("sc2");
const narrWrap=document.getElementById("narrWrap");
const cntWrap=document.getElementById("cntWrap");
const bigNum=document.getElementById("bigNum");
const barStudio=document.getElementById("barStudio"),barUs=document.getElementById("barUs");
const cntX=document.getElementById("cntX");
const railZone=document.getElementById("railZone");
const railTrack=document.getElementById("railTrack");
const railFill=document.getElementById("railFill");

function zoneProgress(el){
  const r=el.getBoundingClientRect();
  const total=el.offsetHeight-innerHeight;
  return clamp(-r.top/Math.max(1,total),0,1);
}
function setRailHeight(){
  const extra=railTrack.scrollWidth-innerWidth;
  railZone.style.height=(innerHeight+Math.max(0,extra)+innerHeight*0.4)+"px";
}
setRailHeight();addEventListener("resize",setRailHeight);
const fmtIN=n=>n.toLocaleString("en-IN",{maximumFractionDigits:n<100?1:0});

function tick(){
  scrollY_s=reduce?window.scrollY:lerp(scrollY_s,window.scrollY,0.12);
  const y=scrollY_s;
  const doc=document.documentElement;
  progress.style.width=(window.scrollY/(doc.scrollHeight-innerHeight)*100)+"%";
  nav.classList.toggle("solid",window.scrollY>40);

  driftEls.forEach(o=>{o.el.style.transform=`translateY(${y*o.d*-0.35}px)`;});

  const np=zoneProgress(narrWrap);
  const p1=clamp(1-(np-0.28)/0.22,0,1);
  const p2=clamp((np-0.42)/0.22,0,1);
  sc1.style.opacity=p1;sc1.style.transform=`scale(${0.94+0.06*p1}) translateY(${(1-p1)*-30}px)`;
  sc2.style.opacity=p2;sc2.style.transform=`scale(${0.94+0.06*p2}) translateY(${(1-p2)*30}px)`;

  const cp=ease(clamp(zoneProgress(cntWrap)/0.85,0,1));
  const val=250-(250-25)*cp;
  bigNum.textContent=fmtIN(val);
  barStudio.style.height="220px";
  barUs.style.height=(220*Math.max(0.06,(25/250)+(1-cp)*0.9))+"px";
  cntX.classList.toggle("on",cp>0.96);

  const rp=zoneProgress(railZone);
  const extra=railTrack.scrollWidth-innerWidth;
  railTrack.style.transform=`translateX(${-extra*rp}px)`;
  railFill.style.width=(rp*100)+"%";

  cx=lerp(cx,tx,0.22);cy=lerp(cy,ty,0.22);
  cur.style.transform=`translate(${cx-cur.offsetWidth/2}px,${cy-cur.offsetHeight/2}px)`;
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

/* reveals & count-ups */
const io=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting){e.target.classList.add("in");io.unobserve(e.target);}});},{threshold:.14});
document.querySelectorAll(".rv").forEach(el=>io.observe(el));

const cio=new IntersectionObserver(es=>{es.forEach(e=>{
  if(!e.isIntersecting)return;cio.unobserve(e.target);
  const el=e.target,to=parseFloat(el.dataset.count),dec=+(el.dataset.dec||0);
  const pre=el.dataset.prefix||"",suf=el.dataset.suffix||"";
  const t0=performance.now(),dur=1400;
  (function st(t){const k=ease(clamp((t-t0)/dur,0,1));
    el.innerHTML=pre+(to*k).toFixed(dec)+(suf?`<small>${suf}</small>`:"");
    if(k<1)requestAnimationFrame(st);})(t0);
});},{threshold:.5});
document.querySelectorAll("[data-count]").forEach(el=>cio.observe(el));

const dio=new IntersectionObserver(es=>{es.forEach(e=>{if(e.isIntersecting&&!sheetRun){sheetRun=true;renderSheet();dio.disconnect();}});},{threshold:.35});
dio.observe(document.getElementById("sheetBox"));
