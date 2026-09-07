/* The public site is light-only. The dark/light toggle lives in the studio
   top bar (src/components/TopBar.tsx), which persists the choice to
   localStorage , the marketing pages never set `data-theme` at all. */

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
 /* Menswear silhouettes: straight hem and trousers, so a shirt does not come
    back drawn as a dress while the real photography is still being shot.
    Trousers keep their own colour , only the garment takes the tint. */
 mfront:c=>`${bg(c)}${head(50,29,9.5)}<path d="M39 39 q11 -5 22 0 l2 30 q-13 4 -26 0 z" fill="${garment}"/><path d="M40 40 l-6 25 M60 40 l6 25" stroke="${garment}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M34 66 l-1 4 M66 66 l1 4" stroke="${skin}" stroke-width="4" stroke-linecap="round"/><path d="M44 69 l-2 39 M56 69 l2 39" stroke="#3B4252" stroke-width="8" stroke-linecap="round"/>`,
 mwalk:c=>`${bg(c)}${head(52,29,9.5)}<path d="M41 39 q11 -5 22 0 l2 30 q-13 4 -26 0 z" fill="${garment}"/><path d="M42 40 l-8 23 M62 40 l7 20" stroke="${garment}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M46 69 l-9 38 M58 69 l9 37" stroke="#3B4252" stroke-width="8" stroke-linecap="round"/>`,
 mback:c=>`${bg(c)}${head(50,29,9.5,true)}<path d="M39 39 q11 -5 22 0 l2 30 q-13 4 -26 0 z" fill="${garmentB}"/><path d="M40 40 l-6 25 M60 40 l6 25" stroke="${garmentB}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M44 69 l-2 39 M56 69 l2 39" stroke="#3B4252" stroke-width="8" stroke-linecap="round"/>`,
 mkurta:c=>`${bg(c)}${head(50,29,9.5)}<path d="M39 39 q11 -5 22 0 l3 49 q-14 4 -28 0 z" fill="${garment}"/><path d="M50 40 l0 48" stroke="${garmentB}" stroke-width="1.6" fill="none"/><path d="M40 40 l-6 27 M60 40 l6 27" stroke="${garment}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M45 88 l-1 20 M55 88 l1 20" stroke="#3B4252" stroke-width="7" stroke-linecap="round"/>`,
 saree:c=>`${bg(c)}${head(50,28,8.5)}<path d="M43 38 q7 -4 14 0 l7 55 q-4 14 -14 14 q-10 0 -14 -14 z" fill="${garment}"/><path d="M43 38 l14 55" stroke="${garmentB}" stroke-width="3" fill="none"/><path d="M43 39 l-6 24 M57 39 l6 24" stroke="${skin2}" stroke-width="4" fill="none" stroke-linecap="round"/>`
};
const frameSVG=(p,c)=>`<svg viewBox="0 0 100 133" preserveAspectRatio="xMidYMid slice">${POSES[p](c)}</svg>`;

/* =============== IMAGERY =============================================
   HOW TO USE YOUR OWN IMAGES (no code needed):
   1. Create a folder named  Webassets  next to this HTML file.
   2. Drop your photos in with these exact names (.jpg, .png or .webp):

      garment    , the input flat-lay/packshot        (sheet frame 00, hero)
      front      , model, front full-body             (sheet 01, hero, card 02)
      walk       , model walking                      (sheet 02, hero, card 02)
      hip        , model three-quarter                (sheet 03)
      back       , model from behind                  (sheet 04, hero, card 02)
      closeup    , model close-up                     (sheet 05, hero, card 02)
      saree      , ethnic-wear shot                   (hero drift)
      extra1..5  , any five varied shots              (hero, card 01 grid)

   e.g.  Webassets/front.jpg, Webassets/closeup.png, Webassets/extra3.webp
   Each slot tries your file first, then the Unsplash placeholder,
   then a drawn figure , the page never shows a broken image.
   ==================================================================== */
const ASSET_DIR="/webassets/";
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
  img.alt=alt||("AI-generated on-model fashion photo , "+slot.replace(/\d+$/,"")+" view, Faishon Studio sample");img.loading="lazy";
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

/* =============== hero: a shoot running =============== */
/* Frames live in /webassets/hero/ as s<set>-<frame>.jpg|png|webp , s1-1 … s5-4.
   A set joins the rotation once at least 3 of its frames exist, so adding a
   folder of stills is the whole deployment step. With no hero/ files at all a
   default set is built from the base slots, and the section still works. */
const HERO_DIR=ASSET_DIR+"hero/";
const HERO_MAX_SETS=5, HERO_MAX_FRAMES=4;

function probe(url){
  return new Promise(done=>{const im=new Image();im.onload=()=>done(url);im.onerror=()=>done(null);im.src=url;});
}
async function probeChain(base){
  /* The first extension on its own, then the rest together.
     Tried strictly one after another, an empty slot cost three round trips ,
     jpg 404, png 404, webp 404 , and the hero has twenty slots to check. This
     is one trip for the usual case (the file is a .jpg) and two for a miss,
     while still preferring EXTS order when more than one format exists. */
  const first=await probe(base+"."+EXTS[0]);
  if(first)return first;
  const rest=await Promise.all(EXTS.slice(1).map(e=>probe(base+"."+e)));
  return rest.find(Boolean)??null;
}
/* The same idea for a clip. `loadedmetadata` rather than `canplay`: it fires as
   soon as the header is in, so a missing file is ruled out in a round trip
   instead of a download , which matters when the file is megabytes. */
function probeVideo(url){
  return new Promise(done=>{
    const v=document.createElement("video");
    v.preload="metadata";v.muted=true;
    v.onloadedmetadata=()=>done(url);v.onerror=()=>done(null);
    v.src=url;
  });
}

(async function heroShow(){
  const collage=document.getElementById("collage");
  if(!collage)return;                       /* only the marketing page has one */

  const plates=[
    {media:()=>document.getElementById("mMain"),cap:document.getElementById("capMain"),flash:true},
    {media:()=>document.getElementById("mB"),cap:document.getElementById("capB")},
    {media:()=>document.getElementById("mD"),cap:document.getElementById("capD")},
    {media:()=>document.getElementById("mC"),cap:document.getElementById("capC")}
  ];
  const shutter=document.getElementById("shutter"),rec=document.getElementById("rec");
  const reduceH=matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Loading, and why it is shaped like this.
     This used to be two nested loops of `await`: five sets x four frames, every
     probe waiting on the one before it, and nothing painted until all twenty
     had answered. On loopback that is invisible; over a real connection it is
     twenty-six serial round trips before the first photograph appears , three
     to five seconds of empty frames.
     So: one set at a time, its four frames probed together, and the collage
     starts as soon as the FIRST set is in. The other four load behind it and
     join the rotation as they land , by then the section is already running. */
  const sets=[];
  const loadSet=async n=>{
    const urls=(await Promise.all(
      Array.from({length:HERO_MAX_FRAMES},(_,j)=>probeChain(`${HERO_DIR}s${n}-${j+1}`))
    )).filter(Boolean);
    return urls.length>=3?{name:"S"+n,urls}:null;
  };
  const others=()=>Array.from({length:HERO_MAX_SETS-1},(_,i)=>loadSet(i+2));

  const first=await loadSet(1);
  if(first){
    sets.push(first);
    /* Deliberately not awaited , the show starts on set 1. */
    Promise.all(others()).then(rest=>rest.forEach(st=>{if(st)sets.push(st);}));
  } else {
    /* No set 1, so there is nothing to start on: the rest have to be resolved
       before the fallback below can know whether it is needed. Still parallel. */
    (await Promise.all(others())).forEach(st=>{if(st)sets.push(st);});
  }

  /* fallback: the base slots, then the placeholder, then a drawn figure */
  if(!sets.length){
    const def=[];
    for(const [slot,pose,bgc] of [["front","front","#40506b"],["walk","walk","#7a5a41"],["hip","hip","#3c4a41"],["closeup","close","#3f3f52"]]){
      let hit=await probeChain(ASSET_DIR+slot);
      if(!hit&&IMG[slot])hit=await probe(U(IMG[slot],700));
      def.push(hit||{pose,bgc});
    }
    sets.push({name:"S1",urls:def});
  }

  function mediaNode(u){
    if(typeof u==="string"){
      const i=document.createElement("img");
      i.src=u;i.alt="AI on-model fashion photo , Faishon Studio sample";
      return i;
    }
    const d=document.createElement("div");d.style.cssText="position:absolute;inset:0";
    d.innerHTML=frameSVG(u.pose,u.bgc);
    d.querySelector("svg").style.cssText="width:100%;height:100%";
    return d;
  }

  function place(plate,set,fi){
    if(plate.flash){shutter.classList.remove("snap");void shutter.offsetWidth;shutter.classList.add("snap");}
    const el=plate.media();el.classList.add("out");
    /* swap at the far end of the fade, so the change is never seen mid-cut */
    setTimeout(()=>{el.innerHTML="";el.appendChild(mediaNode(set.urls[fi]));el.classList.remove("out");},380);
    plate.cap.textContent=`${set.name} · FRAME ${String(fi+1).padStart(2,"0")}`;
  }

  /* Hovering holds the shoot, so a frame worth looking at can be looked at. */
  let paused=false;
  collage.addEventListener("mouseenter",()=>paused=true);
  collage.addEventListener("mouseleave",()=>paused=false);
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  async function wait(ms){let t=0;while(t<ms){await sleep(70);while(paused)await sleep(120);t+=70;}}

  let recSec=0;
  setInterval(()=>{
    if(paused||reduceH)return;
    recSec++;
    if(rec)rec.textContent="● REC "+String(Math.floor(recSec/60)).padStart(2,"0")+":"+String(recSec%60).padStart(2,"0");
  },1000);

  if(reduceH){
    const s=sets[0];
    plates.forEach((_,k)=>place(plates[k],s,k%s.urls.length));
    if(rec)rec.textContent="NO STUDIO";
    return;
  }

  const STEP=250, SET_HOLD=500;
  let si=0;
  for(;;){
    const s=sets[si%sets.length];
    recSec=0;
    /* Cascade across every plate. Stepping to plates.length rather than to the
       frame count matters: a 3-frame set would otherwise leave the fourth plate
       showing the PREVIOUS set's photograph, so the collage would be two shoots
       at once. Frames repeat to fill instead. */
    const steps=Math.max(plates.length,s.urls.length);
    for(let fi=0;fi<steps;fi++){
      place(plates[fi%plates.length],s,fi%s.urls.length);
      await wait(STEP);
    }
    await wait(SET_HOLD);
    si++;
  }
})();

/* =============== rotating subline keyword =============== */
(function(){
  const el=document.getElementById("rotw");if(!el)return;
  if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  const words=["Amazon & Myntra listings","kurtis, sarees & co-ords","t-shirts & western wear","festive & wedding drops"];
  let i=0;
  setInterval(()=>{
    el.classList.add("sw");
    setTimeout(()=>{i=(i+1)%words.length;el.textContent=words[i];el.classList.remove("sw");},300);
  },2600);
})();

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
const priceZone=document.getElementById("priceZone");
const priceTrack=document.getElementById("priceTrack");
const priceFill=document.getElementById("priceFill");

/* =============== the platform rail: eight capability cards =============== */
/* Ported from the platform-panel reference. Built here rather than in the page
 * because each card's imagery is resolved at runtime: a real render at
 * /webassets/platform/cN if one has been dropped in, the reference's Unsplash
 * placeholder while it has not, and a drawn frame if even that is unreachable.
 * The horizontal travel is scrubbed from scroll further down and is unchanged.
 */
(function platformRail(){
  const track=document.getElementById("railTrack");
  if(!track)return;                         /* only the marketing page has one */

  const CARDS=[
    {t:'Any input, <b>auto-detected</b>',
     b:'Flat-lay, packshot or a photo of someone wearing it. Category and gender detected the moment you upload.',
     img:"photo-1521572163474-6864f9cf17ab", bg:"#54452f", pose:"full"},
    {t:'Full <b>art direction</b>',
     b:'Pose, backdrop, lighting, framing and mood. Every frame answers to you.',
     img:"photo-1483985988355-763728e1935b", bg:"#40506b", pose:"full"},
    {t:'<b>Marketplace-ready</b> framing',
     b:'Crops and compositions built for Amazon, Flipkart, Myntra and Meesho listings.',
     img:"photo-1515886657613-9f3515b0c78f", bg:"#3c4a41", pose:"full"},
    {t:'Shoot <b>continuity</b>',
     b:'Pause today, reshoot next season. Same model, same light, full continuity, no re-booking.',
     img:"photo-1529626455594-4ff0802cfb7e", bg:"#3f3f52", pose:"close"},
    {t:'Native <b>2K &amp; 4K</b>',
     b:'From product page to billboard, the same shoot scales. True native resolution, not upscaled.',
     img:"photo-1496747611176-843222e1e57c", bg:"#5d4a5a", pose:"full"},
    {t:'<b>100% commercial</b> rights',
     b:'Every image is yours, everywhere, forever. No licensing windows, no renewals, no usage fees.',
     img:"photo-1509631179647-0177331693ae", bg:"#7a5a41", pose:"full"},
    // {t:'Prepaid wallet, <b>GST invoicing</b>',
    //  b:'No subscription, no seats, no minimum SKUs. Load a wallet in rupees and shoot when you like.',
    //  img:"photo-1539109136881-3be0616acf4b", bg:"#54452f", pose:"full"},
    // {t:'Your designs <b>stay yours</b>',
    //  b:"Your uploads power your shoots and nothing else. Never shared, never resold, handled under India's DPDP law.",
    //  img:"photo-1583391733956-6c78276477e2", bg:"#40506b", pose:"full"}
  ];

  const skin="#C98F63",hair="#1E1712",gar="#C24418";
  const fallSVG=(bg,pose)=>`<svg viewBox="0 0 120 90" preserveAspectRatio="xMidYMid slice">`+
    `<rect width="120" height="90" fill="${bg}"/>`+
    `<circle cx="60" cy="26" r="9" fill="${skin}"/><path d="M51,24 a9,9 0 0 1 18,0 z" fill="${hair}"/>`+
    (pose==="close"
      ? `<circle cx="60" cy="52" r="22" fill="${skin}"/><path d="M38 52 a22 22 0 0 1 44 0 z" fill="${hair}"/>`
      : `<path d="M51 37 q9 -5 18 0 l5 38 q-14 6 -28 0 z" fill="${gar}"/>`)+
    `</svg>`;

  CARDS.forEach(async (c,i)=>{
    const card=document.createElement("article");
    card.className="rcard";
    /* Appended before the imagery resolves so the eight keep the order they are
       written in , awaiting first would let whichever image loads fastest land
       first, and the numbers would not match the copy. */
    track.appendChild(card);

    let media=await probeChain(ASSET_DIR+"platform/c"+(i+1));
    if(!media)media=await probe(U(c.img,640));
    const plain=c.t.replace(/<[^>]+>/g,"");
    const inner=media
      ? `<img src="${media}" alt="Faishon Studio , ${plain}" loading="${i>1?"lazy":"eager"}"/>`
      : fallSVG(c.bg,c.pose);

    card.innerHTML=
      `<div class="pimg">${inner}</div>`+
      `<div class="pt"><h3>${c.t}</h3><p>${c.b}</p></div>`;
  });

  /* Each card rises as the track carries it into view.
     Wired HERE, after the loop, and not at module scope: the cards are built by
     this function, so an observer set up earlier in the file would query an
     empty track, observe nothing, and leave every card at the opacity:0 that
     `.reveal` applies , an invisible rail.

     Unobserving makes it one-shot, so scrubbing the rail backwards does not
     replay eight animations. */
  track.classList.add("reveal");
  const rio=new IntersectionObserver(es=>{es.forEach(e=>{
    if(!e.isIntersecting)return;
    e.target.classList.add("in");rio.unobserve(e.target);
  });},{threshold:.12});
  track.querySelectorAll(".rcard").forEach(el=>rio.observe(el));
})();

/* =============== ensemble: the styling map =============== */
/* Six pieces beside one figure, each pinned to the spot it is styled onto.
 *
 * The obvious way to show an ensemble is pieces-in, look-out , but that only
 * says "they went in somewhere". Marking WHERE each one lands is the thing the
 * feature actually does, and it is what a stylist would point at.
 *
 * Coordinates are percentages of the frame, so they hold whether the figure is
 * the drawn fallback or a real render dropped into /webassets/ensemble.
 */
(function ensembleMap(){
  const box=document.getElementById("ensPieces");
  const pinBox=document.getElementById("ensPins");
  const figure=document.getElementById("ensFigure");
  const flag=document.getElementById("ensFlag");
  if(!box||!pinBox||!figure)return;          /* only the marketing page has one */

  /* x/y are percentages of the frame, measured against the shoot photograph ,
     each one lands on the piece itself: the brim, the lens, the pendant, the
     check, the clasp, the ankle strap. Percentages rather than pixels so the
     frame can be any size; a replacement render of the same crop keeps them. */
  const PIECES=[
    {k:"hat",     n:"Hat",       r:"sits on the crown",   x:49,   y:5},
    {k:"eyewear", n:"Eyewear",   r:"across the eyes",     x:50.4, y:11.5},
    {k:"necklace",n:"Necklace",  r:"at the collarbone",   x:50.4, y:23.4},
    {k:"dress",   n:"Dress",     r:"the base garment",    x:49.6, y:42},
    {k:"bag",     n:"Bag",       r:"held at the hip",     x:62.3, y:73.3},
    {k:"heels",   n:"Heels",     r:"on the feet",         x:63,   y:95.5}
  ];

  /* Drawn packshots, on paper, for a slot with no photograph of its own. */
  const paper='<rect width="100" height="100" fill="#F5F2EB"/>';
  const DRAWN={
    hat:`${paper}<ellipse cx="50" cy="62" rx="34" ry="10" fill="#B48C50"/><path d="M32 60 q0 -26 18 -26 q18 0 18 26 z" fill="#A07A42"/>`,
    eyewear:`${paper}<circle cx="35" cy="52" r="14" fill="none" stroke="#28241E" stroke-width="4.4"/><circle cx="67" cy="52" r="14" fill="none" stroke="#28241E" stroke-width="4.4"/><path d="M49 52 h4 M21 50 l-8 -4 M81 50 l8 -4" stroke="#28241E" stroke-width="4"/>`,
    necklace:`${paper}<path d="M28 34 q22 34 44 0" fill="none" stroke="#C8A45C" stroke-width="3.4"/><circle cx="38" cy="49" r="4" fill="#DDBE74"/><circle cx="50" cy="53" r="5" fill="#DDBE74"/><circle cx="62" cy="49" r="4" fill="#DDBE74"/>`,
    dress:`${paper}<path d="M38 22 q12 -6 24 0 l8 58 q-20 8 -40 0 z" fill="#C24418"/><path d="M44 22 q6 5 12 0" stroke="#8F3010" stroke-width="2.4" fill="none"/>`,
    bag:`${paper}<rect x="30" y="44" width="40" height="30" rx="3" fill="#8A5A34"/><path d="M38 44 q12 -18 24 0" fill="none" stroke="#8A5A34" stroke-width="3.2"/><rect x="46" y="56" width="8" height="6" rx="1.5" fill="#C8A45C"/>`,
    heels:`${paper}<path d="M22 62 l44 -16 q8 -2 10 6 l-38 16 z" fill="#7A281E"/><path d="M70 52 l3 24 l-6 0 l-3 -20 z" fill="#7A281E"/><path d="M30 78 l44 -16 q8 -2 10 6 l-38 16 z" fill="#7A281E" opacity=".55"/>`
  };
  const packshot=k=>`<svg viewBox="0 0 100 100" aria-hidden="true">${DRAWN[k]||paper}</svg>`;

  /* The figure, drawn to the same coordinates the pins use , hat at 12%, eyes
     at 18%, collarbone at 27%, and so on down to the shoes at 94%. */
  const FIGURE=`<svg viewBox="0 0 100 150" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <rect width="100" height="150" fill="#EFEBE3"/>
    <ellipse cx="50" cy="19" rx="21" ry="6" fill="#B48C50"/>
    <path d="M36 18 q0 -13 14 -13 q14 0 14 13 z" fill="#A07A42"/>
    <circle cx="50" cy="28" r="9" fill="#E7C6A8"/>
    <path d="M41 26 a9 9 0 0 1 18 0 z" fill="#2A231C"/>
    <rect x="42" y="26" width="6.4" height="4" rx="1.4" fill="#28241E"/>
    <rect x="51.6" y="26" width="6.4" height="4" rx="1.4" fill="#28241E"/>
    <path d="M48.4 28 h3.2" stroke="#28241E" stroke-width="1.4"/>
    <path d="M43 38 q7 7 14 0" fill="none" stroke="#C8A45C" stroke-width="1.8"/>
    <circle cx="50" cy="41.5" r="1.9" fill="#DDBE74"/>
    <path d="M41 40 q9 -5 18 0 l7 56 q-16 7 -32 0 z" fill="#C24418"/>
    <path d="M41 41 l-7 26 M59 41 l7 26" stroke="#E7C6A8" stroke-width="4.4" stroke-linecap="round"/>
    <rect x="66" y="70" width="13" height="11" rx="2" fill="#8A5A34"/>
    <path d="M69 70 q3.5 -6 7 0" fill="none" stroke="#8A5A34" stroke-width="1.6"/>
    <path d="M45 96 l-2 40 M55 96 l2 40" stroke="#E7C6A8" stroke-width="5" stroke-linecap="round"/>
    <path d="M38 138 l9 0 l2 4 l-13 0 z" fill="#7A281E"/>
    <path d="M53 138 l9 0 l2 4 l-13 0 z" fill="#7A281E"/>
  </svg>`;

  /* ---- build ---------------------------------------------------------- */
  const cards=[],pins=[];
  PIECES.forEach((p,i)=>{
    const card=document.createElement("button");
    card.type="button";card.className="ens-piece";card.dataset.c="";
    card.setAttribute("aria-label",`${p.n} , ${p.r}`);
    card.innerHTML=`<span class="ep-shot">${packshot(p.k)}</span>`+
      `<span class="ep-meta"><b>${p.n}</b><i>${p.r}</i></span>`+
      `<span class="ep-no">${String(i+1).padStart(2,"0")}</span>`;
    box.appendChild(card);cards.push(card);

    /* The supplied packshot of the actual item , the six product photographs
       that went into the shoot, square-cropped to /webassets/ensemble/pN.jpg.
       Packshots rather than crops of the finished frame: this section's claim
       is "these six went in, this one came out", and a crop of the output can
       only ever show the output. The drawing holds the slot until it loads. */
    probeChain(ASSET_DIR+"ensemble/p"+(i+1)).then(u=>{
      if(u)card.querySelector(".ep-shot").innerHTML=`<img src="${u}" alt="${p.n}"/>`;
    });

    const pin=document.createElement("span");
    pin.className="ens-pin";
    pin.style.left=p.x+"%";pin.style.top=p.y+"%";
    pinBox.appendChild(pin);pins.push(pin);
  });

  figure.innerHTML=FIGURE;
  /* The shoot itself. Probed first so a drop-in at /webassets/ensemble/model
     overrides it, then the file as delivered; the drawing holds the frame
     until one of them loads, so the section is never empty. */
  (async()=>{
    const u=await probeChain(ASSET_DIR+"ensemble/model")
         || await probe("/S0111_standing_front.jpg");
    if(u)figure.innerHTML=`<img src="${u}" alt="One model wearing every uploaded piece , hat, eyewear, necklace, dress, bag and heels"/>`;
  })();

  /* ---- the tour ------------------------------------------------------- */
  let at=-1,timer=null;
  function show(i){
    at=i;
    cards.forEach((c,k)=>c.classList.toggle("on",k===i));
    pins.forEach((p,k)=>p.classList.toggle("on",k===i));
    if(flag){
      const p=PIECES[i];
      /* The name only. It also carried the role, which put a ~180px pill 170px
         into a 296px frame , it ran off the right edge on every pin. The role
         is on the card two inches away; repeating it here bought nothing. */
      flag.textContent=p.n;
      /* Flipped to the left of any pin sitting right of centre, so the bag's
         label opens into the frame rather than out of it. */
      flag.classList.toggle("flip",p.x>55);
      flag.style.left=p.x+"%";flag.style.top=p.y+"%";
      flag.classList.add("on");
    }
  }
  function play(){
    if(reduce)return;
    clearInterval(timer);
    timer=setInterval(()=>show((at+1)%PIECES.length),2200);
  }
  function hold(){clearInterval(timer);}

  cards.forEach((c,i)=>{
    c.addEventListener("pointerenter",()=>{hold();show(i);});
    c.addEventListener("focus",()=>{hold();show(i);});
    c.addEventListener("click",()=>{hold();show(i);});
    c.addEventListener("pointerleave",play);
    c.addEventListener("blur",play);
  });

  show(0);
  /* Nothing cycles behind you. */
  new IntersectionObserver(es=>{es[0].isIntersecting?play():hold();},{threshold:.2})
    .observe(box);
})();

/* =============== in-page anchor scrolling =============== */
/* `scroll-behavior:smooth` on the root is not an option here: the comment in
 * landing.css explains that the root has to stay untouched or every sticky pin
 * on the page dies. So the smoothing is done per click instead, which also
 * lets a jump be instant under prefers-reduced-motion.
 *
 * Delegated from the document so it covers the header, the mobile sheet and
 * the footer without three sets of listeners , and so a link added later works
 * without wiring.
 */
addEventListener("click",e=>{
  const a=e.target instanceof Element?e.target.closest('a[href^="#"]'):null;
  if(!a)return;
  const id=a.getAttribute("href").slice(1);
  if(!id)return;
  const target=document.getElementById(id);
  if(!target)return;                        /* let the browser handle a dead one */
  e.preventDefault();
  target.scrollIntoView({behavior:reduce?"auto":"smooth",block:"start"});
  /* The address bar should still show where you are, but without a second jump
     on top of the smooth one. */
  history.replaceState(null,"","#"+id);
  /* A tap in the mobile sheet has to close it, or the destination scrolls in
     behind a full-screen menu. */
  document.body.classList.remove("mnav-open");
},{passive:false});

function zoneProgress(el){
  const r=el.getBoundingClientRect();
  const total=el.offsetHeight-innerHeight;
  return clamp(-r.top/Math.max(1,total),0,1);
}
/* ---- a row you scroll sideways -------------------------------------- */
/* Two sections use this: the feature rail and the pricing packs. The row's
 * position is a function of page scroll , the pinned zone is made as tall as
 * the track is wide, and zoneProgress maps one onto the other.
 *
 * So a drag does NOT write its own transform. It scrolls the page by the
 * equivalent amount and lets the frame loop place the cards. That is the whole
 * trick: anything that moved the track directly would be overwritten on the
 * next frame, and releasing it would snap the row back to wherever the scroll
 * happened to be. Going through scroll means there is one source of truth, so
 * hand and wheel can never disagree.
 */
function scrollRail(zone,track,fill,tail){
  if(!zone||!track)return null;
  const pin=track.parentElement;
  if(!pin)return null;
  /* Below this the row is effectively already on screen, and pinning a screen
     and a half of scroll to move it forty pixels reads as the page having
     jammed. Treated as no travel at all. */
  const MIN_TRAVEL=160;
  const travel=()=>{const x=track.scrollWidth-innerWidth;return x>MIN_TRAVEL?x:0;};

  function layout(){
    const extra=travel();
    /* Nothing overflows , a wide screen fits every card , so there is nothing
       to scrub. The zone stops being taller than the screen, which leaves the
       sticky pin no range to hold in, and the row is just a centred row. */
    zone.classList.toggle("no-travel",!extra);
    zone.style.height=extra?(innerHeight+extra+innerHeight*(tail||0.4))+"px":"";
    if(!extra){track.style.transform="";if(fill)fill.style.width="0%";}
  }
  function frame(){
    const extra=travel();
    if(!extra)return;
    const p=zoneProgress(zone);
    track.style.transform=`translateX(${-extra*p}px)`;
    if(fill)fill.style.width=(p*100)+"%";
  }

  let startX=0,startY=0,fromScroll=0,ratio=1,axis=null,dragging=false;

  pin.addEventListener("pointerdown",e=>{
    if(e.pointerType==="mouse"&&e.button!==0)return;
    const extra=travel();
    if(!extra)return;                       /* nothing to travel */
    /* How much page-scroll equals one pixel of sideways travel. Read per drag
       rather than cached: both terms change with the viewport. */
    ratio=(zone.offsetHeight-innerHeight)/extra;
    startX=e.clientX;startY=e.clientY;fromScroll=scrollY;
    axis=null;dragging=true;
    track.classList.add("dragging");
    try{pin.setPointerCapture(e.pointerId);}catch{}
  });

  pin.addEventListener("pointermove",e=>{
    if(!dragging)return;
    const dx=e.clientX-startX, dy=e.clientY-startY;

    /* Axis lock. `touch-action:pan-y` leaves vertical swipes to the browser, so
       a downward flick scrolls the page natively , and this handler must keep
       its hands off it, or the page would move twice for one gesture. */
    if(!axis){
      if(Math.abs(dx)<6&&Math.abs(dy)<6)return;
      axis=Math.abs(dx)>Math.abs(dy)?"x":"y";
    }
    if(axis!=="x")return;

    e.preventDefault();
    /* Left drags the row forward, which is the same direction scrolling down
       takes it , hence the minus. */
    scrollTo(0,fromScroll-dx*ratio);
  },{passive:false});

  const end=()=>{
    if(!dragging)return;
    dragging=false;axis=null;
    track.classList.remove("dragging");
  };
  pin.addEventListener("pointerup",end);
  pin.addEventListener("pointercancel",end);

  /* `scrollTo` is exposed so the pricing dots can jump to a card the same way a
     drag does , by moving the page, never the track. */
  return {layout,frame,travel,
    scrollTo(p){
      const top=zone.getBoundingClientRect().top+scrollY;
      window.scrollTo({top:top+clamp(p,0,1)*(zone.offsetHeight-innerHeight),
                       behavior:reduce?"auto":"smooth"});
    }};
}

/* The pricing packs get a shorter tail: four cards, so there is less row to
   travel and less reason to hold the pin afterwards. */
const featureRail=scrollRail(railZone,railTrack,railFill,0.4);
const priceRail=scrollRail(priceZone,priceTrack,priceFill,0.2);
const RAILS=[featureRail,priceRail].filter(Boolean);
function layoutRails(){RAILS.forEach(r=>r.layout());}
layoutRails();addEventListener("resize",layoutRails);
const fmtIN=n=>n.toLocaleString("en-IN",{maximumFractionDigits:n<100?1:0});

/* ---- the nav gets out of the way ------------------------------------- */
/* Hidden on the way down, back on the way up , but only past the hero. While
   the opening screen is still on show the bar is part of it, and a header that
   vanished inside the first shot would read as a glitch rather than as room
   being made. A few pixels of deadband so a trackpad's jitter cannot flap it,
   and the mobile sheet always wins: it is anchored to the bar, so hiding one
   without the other would leave a menu open with no way back to it. */
const heroEl=document.querySelector(".hero");
let navLastY=window.scrollY;
function navChrome(y){
  if(!nav)return;
  const past=y>(heroEl?heroEl.offsetHeight:innerHeight);
  if(!past||document.body.classList.contains("mnav-open")){
    nav.classList.remove("nav-away");navLastY=y;return;
  }
  const dy=y-navLastY;
  if(Math.abs(dy)>6){nav.classList.toggle("nav-away",dy>0);navLastY=y;}
}

/* The frame loop.
 *
 * Every block is guarded on its own elements rather than the function bailing
 * out at the top, because this file is loaded by pages that are not the landing
 * page , /pricing, /privacy, /terms , for the theme toggle and the header, and
 * those carry none of the scrubbed sections.
 *
 * Guarded individually, and not for tidiness: an unguarded deref here throws
 * INSIDE the frame, so the `requestAnimationFrame(tick)` on the last line never
 * runs and the loop stops for good after one frame. On those pages that froze
 * the progress bar and the nav's scroll behaviour, with one console error to
 * show for it. */
function tick(){
  scrollY_s=reduce?window.scrollY:lerp(scrollY_s,window.scrollY,0.12);

  if(progress){
    const doc=document.documentElement;
    progress.style.width=(window.scrollY/(doc.scrollHeight-innerHeight)*100)+"%";
  }
  if(nav)nav.classList.toggle("solid",window.scrollY>40);
  navChrome(window.scrollY);

  if(narrWrap&&sc1&&sc2){
    const np=zoneProgress(narrWrap);
    const p1=clamp(1-(np-0.28)/0.22,0,1);
    const p2=clamp((np-0.42)/0.22,0,1);
    sc1.style.opacity=p1;sc1.style.transform=`scale(${0.94+0.06*p1}) translateY(${(1-p1)*-30}px)`;
    sc2.style.opacity=p2;sc2.style.transform=`scale(${0.94+0.06*p2}) translateY(${(1-p2)*30}px)`;
  }

  if(cntWrap&&bigNum&&barStudio&&barUs&&cntX){
    const cp=ease(clamp(zoneProgress(cntWrap)/0.85,0,1));
    const val=250-(250-25)*cp;
    bigNum.textContent=fmtIN(val);
    barStudio.style.height="220px";
    barUs.style.height=(220*Math.max(0.06,(25/250)+(1-cp)*0.9))+"px";
    cntX.classList.toggle("on",cp>0.96);
  }

  RAILS.forEach(r=>r.frame());

  if(cur){
    cx=lerp(cx,tx,0.22);cy=lerp(cy,ty,0.22);
    cur.style.transform=`translate(${cx-cur.offsetWidth/2}px,${cy-cur.offsetHeight/2}px)`;
  }
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
  /* Draws the card's top accent on the same beat the number starts moving. */
  if(el.closest)el.closest(".stat")?.classList.add("lit");
  const t0=performance.now(),dur=1400;
  (function st(t){const k=ease(clamp((t-t0)/dur,0,1));
    el.innerHTML=pre+(to*k).toFixed(dec)+(suf?`<small>${suf}</small>`:"");
    if(k<1)requestAnimationFrame(st);})(t0);
});},{threshold:.5});
document.querySelectorAll("[data-count]").forEach(el=>cio.observe(el));


/* =============== darkroom filmstrip =============== */
/* A reel that develops each frame as it crosses the beam. Reuses ASSET_DIR,
   EXTS, IMG, probe/probeChain, frameSVG and BACKDROPS from above.
   Every slot here is a real file in /webassets, so nothing falls through to a
   stock placeholder , the panel is showing actual output. */
const STRIP_ITEMS=[
 ["front","STUDIO","front"],   ["walk","WALKING","walk"],
 ["m1p3","EDITORIAL","front"], ["hip","THREE-QUARTER","hip"],
 ["m2p4","LOOKBOOK","hip"],    ["back","BACK VIEW","front"],
 ["m3p2","CATALOGUE","front"], ["closeup","BEAUTY","close"],
 ["m4p5","STREET","walk"],     ["m5p1","CAMPAIGN","front"]
];

(async function darkroom(){
  const strip=document.getElementById("strip"),track=document.getElementById("track");
  if(!strip||!track)return;                 /* only the marketing page has one */
  const reduceS=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const cells=[];

  const resolved=[];
  for(const [slot,cap,pose] of STRIP_ITEMS){
    let u=await probeChain(ASSET_DIR+slot);
    if(!u&&IMG[slot])u=await probe(U(IMG[slot],420));
    resolved.push({u,cap,pose});
  }

  /* Laid down twice so the wrap has an identical second copy to jump to ,
     the reset is invisible because the two halves are the same. */
  for(let rep=0;rep<2;rep++){
    resolved.forEach((it,i)=>{
      const c=document.createElement("div");c.className="cell";
      const inner=document.createElement("div");inner.className="inner";
      if(it.u){
        const im=document.createElement("img");
        im.src=it.u;im.alt="AI on-model fashion photo , "+it.cap.toLowerCase();
        inner.appendChild(im);
      } else {
        inner.innerHTML=frameSVG(it.pose,BACKDROPS[i%BACKDROPS.length]);
      }
      c.appendChild(inner);
      c.insertAdjacentHTML("beforeend",
        `<span class="neg">N-${String(i+1).padStart(2,"0")}</span><span class="cap">${it.cap}</span>`);
      track.appendChild(c);cells.push(c);
    });
  }

  if(reduceS)return;   /* CSS shows every frame developed and still */

  let x=0;                 /* track offset, px */
  const BASE=-32;          /* natural leftward drift, px/s */
  let vel=BASE;
  let dragging=false,lastPX=0,dragVel=0;
  let lastScrollY=scrollY,lastT=performance.now();

  strip.addEventListener("pointerdown",e=>{
    dragging=true;strip.classList.add("dragging");lastPX=e.clientX;dragVel=0;
    strip.setPointerCapture(e.pointerId);
  });
  strip.addEventListener("pointermove",e=>{
    if(!dragging)return;
    const dx=e.clientX-lastPX;lastPX=e.clientX;x+=dx;dragVel=dx*60;
  });
  /* Letting go hands the drag's own speed back to the reel, so it carries on
     the way it was thrown rather than snapping back to the drift. */
  const endDrag=()=>{
    if(!dragging)return;
    dragging=false;strip.classList.remove("dragging");vel=dragVel||BASE;
  };
  strip.addEventListener("pointerup",endDrag);
  strip.addEventListener("pointercancel",endDrag);

  function tick(t){
    const dt=Math.min(50,t-lastT)/1000;lastT=t;

    const dy=scrollY-lastScrollY;lastScrollY=scrollY;
    if(!dragging&&dy!==0)vel-=dy*6;          /* scrolling drives the reel */

    if(!dragging){
      x+=vel*dt;
      vel+=(BASE-vel)*Math.min(1,dt*1.6);    /* ease back to the drift */
    }

    const half=track.scrollWidth/2;
    if(x<=-half)x+=half;
    if(x>0)x-=half;
    track.style.transform=`translate3d(${x}px,0,0)`;

    /* develop by distance from the beam: grey and dim far out, full colour on it */
    const mid=innerWidth/2;
    const range=Math.min(420,innerWidth*0.38);
    for(const c of cells){
      const r=c.getBoundingClientRect();
      if(r.right<-60||r.left>innerWidth+60)continue;   /* skip offscreen cells */
      const dNorm=Math.min(1,Math.abs(r.left+r.width/2-mid)/range);
      const dev=1-dNorm;
      const inner=c.firstElementChild;
      inner.style.filter=`grayscale(${dNorm}) sepia(${dNorm*0.35}) brightness(${0.5+0.5*dev}) contrast(${1+0.12*dNorm})`;
      inner.style.transform=`scale(${1+0.05*dev})`;
      c.classList.toggle("lit",dev>0.72);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
})();

/* =============== casting matrix: one garment, every model =============== */
/* Wrapped in an IIFE on purpose. This panel needs its own `cells`, `reduce`,
   `show`, `timer` and so on, and every one of those names is already taken at
   the top level by the filmstrip or the hero. It reuses the shared figure
   helpers (ASSET_DIR, EXTS, frameSVG, skin/skin2/hair) rather than redeclaring
   them, so there is one set of croquis fallbacks for the whole page. */
(function castworld(){
  const panel=document.getElementById("panel"),loupe=document.getElementById("loupe");
  if(!panel||!loupe)return;                 /* only the marketing page has one */

  const MODELS=[
   {n:"Aisha",  o:"MUMBAI",    s:"#C98F63",s2:"#B57B50",h:"#1E1712"},
   {n:"Zara",   o:"DUBAI",     s:"#D8A87B",s2:"#C29065",h:"#2A1F16"},
   {n:"Mei",    o:"SINGAPORE", s:"#F0CDA8",s2:"#DDB78F",h:"#171310"},
   {n:"Ana",    o:"SÃO PAULO", s:"#B97F55",s2:"#A26C46",h:"#241A12"},
   {n:"Adaeze", o:"LAGOS",     s:"#7A4E30",s2:"#653F26",h:"#120D09"}
  ];
  const COLS=[
   {b:"STUDIO SEAMLESS", sh:"STUDIO",   c:"#40506b",p:"front"},
   {b:"GOLDEN TERRACE",  sh:"TERRACE",  c:"#7a5a41",p:"hip"},
   {b:"CITY STREET",     sh:"STREET",   c:"#3c4a41",p:"walk"},
   {b:"GARDEN LIGHT",    sh:"GARDEN",   c:"#54452f",p:"front"},
   {b:"WAREHOUSE LOFT",  sh:"LOFT",     c:"#5d4a5a",p:"back"},
   {b:"BEAUTY CLOSE-UP", sh:"CLOSE-UP", c:"#3f3f52",p:"close"}
  ];
  /* Recolour the shared croquis per model, so even the fallback keeps the
     "different people, same garment" point the panel is making. */
  const tintSVG=(pose,bgc,m)=>frameSVG(pose,bgc).replaceAll(skin,m.s).replaceAll(skin2,m.s2).replaceAll(hair,m.h);

  const N=MODELS.length, M=COLS.length, TOTAL=N*M;
  const RES=Array.from({length:TOTAL},()=>undefined);   /* undefined pending · null svg · string url */

  function resolveCombo(idx){
    const r=Math.floor(idx/M)+1, c=idx%M+1;
    const q=EXTS.map(e=>`${ASSET_DIR}m${r}p${c}.${e}`);
    return new Promise(done=>{
      const tryNext=()=>{
        if(!q.length){RES[idx]=null;done(null);return;}
        const url=q.shift(), im=new Image();
        im.onload=()=>{RES[idx]=url;done(url);};
        im.onerror=tryNext;
        im.src=url;
      };
      tryNext();
    });
  }

  function comboMedia(idx){
    const m=MODELS[Math.floor(idx/M)], col=COLS[idx%M];
    if(RES[idx]){
      const img=document.createElement("img");
      img.src=RES[idx];img.alt=`AI model ${m.n} , ${col.b.toLowerCase()}`;
      return img;
    }
    const d=document.createElement("div");
    d.style.cssText="position:absolute;inset:0";
    d.innerHTML=tintSVG(col.p,col.c,m);
    d.querySelector("svg").style.cssText="width:100%;height:100%";
    return d;
  }

  /* ---- the matrix ---- */
  const mmCols=document.getElementById("mmCols"),mmRows=document.getElementById("mmRows");
  const cells=[];

  /* No column headers and no row labels: the grid is thirty photographs, and
     naming every model and every backdrop around the edges asks the eye to read
     a table before it looks at any of them. The loupe still names whichever
     frame is playing, which is the only one being looked at.

     The header element stays in the markup and is removed HERE rather than
     deleted from the page. Guarded, this works whether or not it exists , so
     the two files cannot fall out of step and take the whole script down with
     them, which is exactly how this section broke once already. */
  if(mmCols)mmCols.remove();

  MODELS.forEach((m,ri)=>{
    const row=document.createElement("div");row.className="mm-row";
    COLS.forEach((_,ci)=>{
      const idx=ri*M+ci;
      const cell=document.createElement("div");cell.className="mm-cell";
      cell.addEventListener("click",()=>{show(idx);restartTimer();});
      row.appendChild(cell);cells.push(cell);
    });
    if(mmRows)mmRows.appendChild(row);
  });

  function paintCell(idx){
    const cell=cells[idx];if(!cell)return;
    cell.innerHTML="";cell.appendChild(comboMedia(idx));
  }
  cells.forEach((_,i)=>paintCell(i));               /* draw fallbacks at once */
  for(let i=0;i<TOTAL;i++)resolveCombo(i).then(()=>{
    paintCell(i);
    if(i===cur)show(i);                             /* refresh the loupe too */
  });

  /* ---- the loupe ---- */
  const cycleBar=document.getElementById("cycleBar"),
        pauseState=document.getElementById("pauseState");
  const reduceC=matchMedia("(prefers-reduced-motion: reduce)").matches;
  const STEP=reduceC?2200:450;
  let cur=-1,paused=false,timer=null;

  function show(idx){
    cur=idx;
    const old=document.getElementById("loupeMedia");
    /* Replaced rather than emptied, so the settle animation restarts each time. */
    const fresh=document.createElement("div");fresh.className="media";fresh.id="loupeMedia";
    fresh.appendChild(comboMedia(idx));
    if(old)old.replaceWith(fresh);
    /* The frame counter, the model's name and the setting line used to be
       written here. They are gone from the panel , the grid is thirty
       photographs and the labels were reading them out , so there is nothing
       left to caption. The progress bar stays: it is the only part that says
       how far through the set you are. */
    cells.forEach((c,k)=>{c.classList.toggle("on",k===idx);if(k===idx)c.classList.add("seen");});
    if(cycleBar)cycleBar.style.width=((idx+1)/TOTAL*100)+"%";
  }
  function restartTimer(){
    clearInterval(timer);
    timer=setInterval(()=>{if(!paused)show((cur+1)%TOTAL);},STEP);
  }

  /* Only the thumbnails hold the reel. Pausing on the whole panel meant the
     cycle stopped the moment the pointer crossed the loupe, the caption or the
     surrounding white , so simply reading the section froze the thing it was
     there to demonstrate. The grid is the part you stop on to study, so the
     grid is the part that pauses. */
  function setPaused(on){
    paused=on;
    if(pauseState)pauseState.textContent=on?"PAUSED , HOVERING":"PLAYING";
  }
  cells.forEach(c=>{
    c.addEventListener("mouseenter",()=>setPaused(true));
    c.addEventListener("mouseleave",()=>setPaused(false));
  });

  show(0);restartTimer();
})();

/* =============== contact sheet: four shoots, one sheet =============== */
/* Replaces the old single-set sheet. Scoped in an IIFE like the other panels ,
   it needs its own `cur`, `paused` and `reduce`, all taken at the top level.
   Sets live in /webassets/shoot as sN-in (the upload) plus sN-1..sN-5 (what it
   became); a set joins once the input and at least 3 outputs exist, so adding a
   folder is the whole deployment step. */
(function contactSheet(){
  const sheet=document.getElementById("sheetBox"),framesBox=document.getElementById("frames");
  if(!sheet||!framesBox)return;              /* only the marketing page has one */

  const SHOOT_DIR=ASSET_DIR+"shoot/";
  const MAX_SETS=4;
  const POSE_LABELS=["FRONT · FULL","WALKING","THREE-QUARTER","BACK","CLOSE-UP"];
  /* Per-set labels, because the four shoots do not contain the same five poses ,
     only S2 has a true back view, so a fixed list would caption three front
     shots "BACK". A set with no entry here falls back to POSE_LABELS, so
     dropping a new folder into shoot/ still needs no code change. */
  const SET_LABELS={
    1:["FRONT · FULL","WALKING","THREE-QUARTER","EDITORIAL","CLOSE-UP"],
    2:["FRONT · FULL","WALKING","THREE-QUARTER","BACK","RECLINING"],
    3:["FRONT · FULL","WALKING","THREE-QUARTER","SEATED","ON LOCATION"],
    4:["FRONT · FULL","WALKING","THREE-QUARTER","ON LOCATION","DETAIL"]
  };
  const FALLBACK_POSES=["front","walk","hip","back","close"];
  const AUTO_MS=3000;          /* dwell per set */
  const MANUAL_SUSPEND=8000;   /* hands off after a press, so it stops fighting */

  const topLbl=document.getElementById("topLbl"),footLbl=document.getElementById("footLbl"),
        thumbsBox=document.getElementById("thumbs"),scan=document.getElementById("scan");
  const reduceD=matchMedia("(prefers-reduced-motion: reduce)").matches;

  (async function(){
    const sets=[];
    for(let n=1;n<=MAX_SETS;n++){
      const input=await probeChain(`${SHOOT_DIR}s${n}-in`);
      const outs=[];
      for(let k=1;k<=5;k++)outs.push(await probeChain(`${SHOOT_DIR}s${n}-${k}`));
      if(input&&outs.filter(Boolean).length>=3)sets.push({name:"S"+n,input,outs,labels:SET_LABELS[n]});
    }
    /* Nothing in shoot/ yet. The m-grid is already five models photographed in
       six setups each, which is exactly what this panel is for , so it falls
       back to those rather than to a single set, and the carousel has somewhere
       to go. Replaced the moment real shoot/ sets appear. */
    if(!sets.length){
      const garmentIn=await probeChain(ASSET_DIR+"garment");
      for(let r=1;r<=5;r++){
        const outs=[];
        for(let c=1;c<=5;c++)outs.push(await probeChain(`${ASSET_DIR}m${r}p${c}`));
        if(outs.filter(Boolean).length>=3)sets.push({name:"S"+r,input:garmentIn,outs});
      }
    }
    /* Still nothing usable , one set from the base slots, so the panel shows
       the idea rather than rendering empty. */
    if(!sets.length){
      const grab=async slot=>{
        let h=await probeChain(ASSET_DIR+slot);
        if(!h&&IMG[slot])h=await probe(U(IMG[slot],420));
        return h;
      };
      sets.push({
        name:"S1",
        input:await grab("garment"),
        outs:[await grab("front"),await grab("walk"),await grab("hip"),await grab("back"),await grab("closeup")]
      });
    }

    function media(u,pose,bgc){
      if(typeof u==="string"){
        const i=document.createElement("img");
        i.src=u;i.alt="AI on-model fashion photo , Faishon Studio";
        return i;
      }
      const d=document.createElement("div");d.style.cssText="position:absolute;inset:0";
      d.innerHTML=frameSVG(pose,bgc);d.querySelector("svg").style.cssText="width:100%;height:100%";
      return d;
    }

    /* the navigator: each set is represented by the garment that produced it */
    sets.forEach((st,i)=>{
      const b=document.createElement("button");b.className="thumb";
      b.setAttribute("aria-label","Show set "+st.name);
      const tin=document.createElement("span");tin.className="tin";
      if(typeof st.input==="string"){
        const im=document.createElement("img");im.src=st.input;im.alt="";tin.appendChild(im);
      } else tin.innerHTML=frameSVG("garment","#221f19");
      b.appendChild(tin);
      b.insertAdjacentHTML("beforeend",`<span class="tlbl">${st.name}</span>`);
      b.addEventListener("click",()=>{goTo(i);suspend();});
      thumbsBox.appendChild(b);
    });
    const thumbs=[...thumbsBox.children];

    let cur=0,paused=false,suspendUntil=0,dwell=0,lastT=performance.now();

    function renderSet(i){
      cur=i;
      const st=sets[i];
      thumbs.forEach((t,k)=>{t.classList.toggle("on",k===i);t.style.setProperty("--p",0);});
      topLbl.textContent=`CONTACT SHEET`;

      framesBox.innerHTML="";
      /* frame 00 is the upload , the thing everything else came from */
      const f0=document.createElement("div");
      f0.className="frame garment"+(reduceD?"":" pop");
      f0.appendChild(media(st.input??{},"garment","#221f19"));
      f0.insertAdjacentHTML("beforeend",
        `<span class="fnum">00</span><span class="tag">Input</span><span class="fpose">THE GARMENT</span>`);
      framesBox.appendChild(f0);

      st.outs.forEach((u,k)=>{
        const d=document.createElement("div");
        d.className="frame"+(u==null?" missing":"")+(reduceD||u==null?"":" pop");
        if(!reduceD&&u!=null)d.style.animationDelay=(0.1+k*0.13)+"s";
        d.appendChild(media(u??{},FALLBACK_POSES[k],BACKDROPS[k%BACKDROPS.length]));
        d.insertAdjacentHTML("beforeend",
          `<span class="fnum">${String(k+1).padStart(2,"0")}</span>${u!=null?'<span class="idc"></span>':''}<span class="fpose">${(st.labels??POSE_LABELS)[k]}</span>`);
        framesBox.appendChild(d);
      });

      if(!reduceD){scan.classList.remove("run");void scan.offsetWidth;scan.classList.add("run");}
      dwell=0;
    }
    const goTo=i=>renderSet((i+sets.length)%sets.length);
    const suspend=()=>{suspendUntil=performance.now()+MANUAL_SUSPEND;};

    document.getElementById("prevB").addEventListener("click",()=>{goTo(cur-1);suspend();});
    document.getElementById("nextB").addEventListener("click",()=>{goTo(cur+1);suspend();});
    sheet.addEventListener("mouseenter",()=>paused=true);
    sheet.addEventListener("mouseleave",()=>paused=false);

    /* Arrow keys only while the sheet is actually on screen , otherwise they
       would hijack the page's own scrolling from anywhere. */
    addEventListener("keydown",e=>{
      if(e.key!=="ArrowLeft"&&e.key!=="ArrowRight")return;
      const r=sheet.getBoundingClientRect();
      if(r.bottom<0||r.top>innerHeight)return;
      goTo(cur+(e.key==="ArrowRight"?1:-1));suspend();
    });

    let tx0=null;
    sheet.addEventListener("touchstart",e=>{tx0=e.touches[0].clientX;},{passive:true});
    sheet.addEventListener("touchend",e=>{
      if(tx0==null)return;
      const dx=e.changedTouches[0].clientX-tx0;tx0=null;
      if(Math.abs(dx)>44){goTo(cur+(dx<0?1:-1));suspend();}
    },{passive:true});

    renderSet(0);
    if(reduceD||sets.length<2)return;

    function tick(t){
      const dt=t-lastT;lastT=t;
      const held=paused||t<suspendUntil;
      if(!held){dwell+=dt;if(dwell>=AUTO_MS)goTo(cur+1);}
      /* the ring around the active thumb IS the dwell timer */
      if(thumbs[cur])thumbs[cur].style.setProperty("--p",held?0:Math.min(100,dwell/AUTO_MS*100));
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();
})();

/* =============== how it works: the shot setup =============== */
/* Womenswear and Menswear are two separate setups, not one setup with a label:
 * each carries its own garments, its own cast and its own pose list, so
 * switching the tab rebuilds the three rows underneath it. Two garments ×
 * two models × three backgrounds × three poses is 36 combinations per
 * category, all driven by pills.
 *
 * On imagery: a real photo is used when one exists at
 *   /webassets/hiw/<garment>-<model>-<bg>-<pose>.jpg|png|webp
 *   e.g. saree-anouk-studio-standing
 * falling back to the older /webassets/hiw/<model>-<bg>-<pose> naming, and
 * then to the shared croquis , drawn for the chosen pose, tinted for the
 * chosen model's skin and the chosen garment's colour. That fallback is
 * deliberate: pointing the combinations at unrelated real photos would show a
 * studio frame when the visitor picked "Outdoor", and a panel whose whole job
 * is to prove control must not lie about what it just did.
 *
 * Garment thumbnails come from /webassets/hiw/g-<garment>.jpg|png|webp.
 */
(function howItWorks(){
  const view=document.getElementById("hiwView");
  if(!view)return;                          /* only the marketing page has one */

  const HIW_DIR=ASSET_DIR+"hiw/";

  /* Shared: the backdrop is the one choice that does not depend on who is
     wearing what. */
  const BGS=[
    {id:"studio",   n:"Studio white", c:"#D9D4C7"},
    {id:"catalogue",n:"Catalogue",    c:"#5d4a5a"},
    {id:"outdoor",  n:"Outdoor",      c:"#3c4a41"}
  ];

  /* `sil` overrides the drawn silhouette for full-length poses , a saree is
     not a dress with a different colour. `c`/`c2` tint the drawn garment, so
     switching garments changes the frame even with no photography in place. */
  const CATS=[
    {id:"womenswear",n:"Womenswear",
     /* One garment for now. Deliberately the Summer dress rather than the
        saree: it is the one with photography behind it, so every backdrop and
        pose below lands on a real frame instead of the drawn croquis. The row
        still shows , it names what is being shot , there is simply nothing to
        switch to yet. Add the saree back to this list and it becomes a picker
        again with no other change. */
     garments:[
       {id:"dress",n:"Summer dress",  s:"Ghost mannequin → on-model",           c:"#3F7C6A",c2:"#2A5A4C"}
     ],
     models:[
       {id:"anouk",n:"Anouk Steele",s:"#F0CDA8",s2:"#DDB78F",h:"#C9A227"},
       {id:"meera",n:"Meera Raj",   s:"#C08552",s2:"#A96F3F",h:"#1E1712"}
     ],
     poses:[
       {id:"standing",n:"Standing",p:"front"},
       {id:"walking", n:"Walking", p:"walk"},
       {id:"closeup", n:"Close-up",p:"close"}
     ]},
    {id:"menswear",n:"Menswear",
     garments:[
       {id:"shirt",n:"Linen shirt",  s:"Packshot → on-model",                 c:"#3C6E9E",c2:"#2A5075"}
     ],
     models:[
       {id:"luis", n:"Luis Ferrer",s:"#C98F63",s2:"#B57B50",h:"#1E1712"},
       {id:"arjun",n:"Arjun Mehta",s:"#A9713F",s2:"#8E5B2E",h:"#120E0A"}
     ],
     poses:[
       {id:"standing",n:"Standing",  p:"mfront"},
       {id:"walking", n:"Walking",   p:"mwalk"},
       {id:"back",    n:"Back view", p:"mback"}
     ]}
  ];

  let ci=0,gi=0,mi=0,bi=0,pi=0;
  const CACHE=new Map();                    /* combo key -> url | null */

  const cap=document.getElementById("hiwCap");
  const cCat=()=>CATS[ci],cGar=()=>cCat().garments[gi],cMod=()=>cCat().models[mi],cPose=()=>cCat().poses[pi];

  /* The croquis is one drawing shared by the whole page, so it is recoloured
     rather than redrawn: skin and hair from the model, garment from the
     garment. A close-up is a face, so it keeps its own silhouette. */
  function croquis(po,bgc,m,g){
    const shape=g.sil&&po.id==="standing"?g.sil:po.p;
    return frameSVG(shape,bgc)
      .replaceAll(skin,m.s).replaceAll(skin2,m.s2).replaceAll(hair,m.h)
      .replaceAll(garment,g.c).replaceAll(garmentB,g.c2);
  }

  function node(url,po,bgc,m,g){
    if(url){
      const i=document.createElement("img");
      i.src=url;
      i.alt=`AI on-model photo , ${g.n} on ${m.n}, ${BGS[bi].n}, ${po.n}`;
      return i;
    }
    const d=document.createElement("div");d.style.cssText="position:absolute;inset:0";
    d.innerHTML=croquis(po,bgc,m,g);
    d.querySelector("svg").style.cssText="width:100%;height:100%";
    return d;
  }

  /* Bumped on every render so a slow probe cannot repaint a combination the
     visitor has already clicked away from. */
  let seq=0;

  async function render(){
    const g=cGar(),m=cMod(),b=BGS[bi],po=cPose();
    const key=`${g.id}-${m.id}-${b.id}-${po.id}`;
    const my=++seq;

    cap.textContent=`${g.n} · ${m.n} · ${b.n} · ${po.n}`;

    /* Draw immediately from what is known, so a click never feels like it
       waited on the network; the probe only ever upgrades the frame. */
    const paint=url=>{
      const fresh=document.createElement("div");
      fresh.className="media";fresh.id="hiwMedia";
      fresh.appendChild(node(url,po,b.c,m,g));
      document.getElementById("hiwMedia").replaceWith(fresh);
    };

    if(CACHE.has(key)){paint(CACHE.get(key));return;}
    paint(null);
    const hit=await probeChain(HIW_DIR+key)
           || await probeChain(HIW_DIR+`${m.id}-${b.id}-${po.id}`);
    CACHE.set(key,hit);
    if(hit&&my===seq)paint(hit);
  }

  /* ---- the three pill rows -------------------------------------------- */
  function pills(hostId,items,extraClass,getIdx,setIdx){
    const host=document.getElementById(hostId);
    host.textContent="";                    /* rebuilt when the category changes */
    const btns=items.map((it,i)=>{
      const b=document.createElement("button");
      b.type="button";b.className="opt"+(extraClass?" "+extraClass:"");
      b.dataset.c="";
      b.textContent=it.n;
      b.setAttribute("aria-pressed",String(i===getIdx()));
      b.addEventListener("click",()=>{
        setIdx(i);
        btns.forEach((x,k)=>{x.classList.toggle("on",k===i);x.setAttribute("aria-pressed",String(k===i));});
        render();
      });
      host.appendChild(b);
      return b;
    });
    btns[getIdx()].classList.add("on");
    return btns;
  }

  /* ---- the garment picker --------------------------------------------- */
  /* The category control, with garments in it. Same track, same buttons, same
     selected-pill treatment , the only difference is what sits inside each
     button: a 20px chip of the garment instead of a drawn silhouette.
     Icon-only for the same reason the categories are: the label is carried by
     `title` and `aria-label`, so nothing is lost to a screen reader or to a
     tooltip, and the row costs a third of the width a labelled tile did. */
  function garments(){
    const host=document.getElementById("hiwGarments");
    host.textContent="";                    /* rebuilt when the category changes */

    const btns=cCat().garments.map((g,i)=>{
      const b=document.createElement("button");
      b.type="button";b.className="hiw-tab gtab"+(i===gi?" on":"");b.dataset.c="";
      b.setAttribute("aria-pressed",String(i===gi));
      /* Name and flow line both live here, since the button shows neither. */
      b.title=`${g.n} , ${g.s}`;
      b.setAttribute("aria-label",g.n);
      b.innerHTML=`<span class="gt"></span>`;

      /* The chip is the flat-lay the visitor would upload, so it draws the
         garment on its own , the model comes later, in the frame. A real
         photograph at /webassets/hiw/g-<id> replaces the drawing when one
         exists. */
      const thumb=b.querySelector(".gt");
      thumb.innerHTML=croquis({p:"garment"},"#221f19",cCat().models[0],g);
      probeChain(HIW_DIR+"g-"+g.id).then(u=>{
        if(!u)return;
        const im=document.createElement("img");im.src=u;im.alt="";
        thumb.textContent="";thumb.appendChild(im);
      });

      b.addEventListener("click",()=>{
        gi=i;
        btns.forEach((x,k)=>{x.classList.toggle("on",k===i);x.setAttribute("aria-pressed",String(k===i));});
        render();
      });
      host.appendChild(b);
      return b;
    });
  }


  /* ---- the category tabs ---------------------------------------------- */
  /* Switching the category swaps the garments, the cast and the pose list, so
     everything below is rebuilt and reset to that category's first choice.
     The background survives , it is the one row the categories share. */
  function build(){
    garments();
    pills("hiwModels",cCat().models,"model",()=>mi,i=>mi=i);
    pills("hiwPoses", cCat().poses, "",     ()=>pi,i=>pi=i);
    render();
  }

  /* Two figures on a 24 grid, keyed by category id. Deliberately the restroom
     pictogram , an A-line body against a straight one , because that pairing is
     read as "women / men" instantly and at any size, where a dress-versus-shirt
     pair asks the eye to identify two garments first. The words are still there
     as the button's label and tooltip. */
  const CAT_ICON={
    womenswear:'<circle cx="12" cy="4.9" r="2.6"/>'+
               '<path d="M12 8.4c-2 0-3.2 1.2-3.7 3L6.9 17h10.2l-1.4-5.6c-.5-1.8-1.7-3-3.7-3z"/>'+
               '<path d="M9.9 17l-.5 4M14.1 17l.5 4"/>',
    menswear:'<circle cx="12" cy="4.9" r="2.6"/>'+
             '<path d="M8.4 17v-5.4A3.6 3.6 0 0 1 12 8a3.6 3.6 0 0 1 3.6 3.6V17z"/>'+
             '<path d="M10.2 17v4M13.8 17v4"/>'
  };
  const catSVG=id=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"`+
    ` stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${CAT_ICON[id]||""}</svg>`;

  const tabHost=document.getElementById("hiwCats");
  const tabs=CATS.map((c,i)=>{
    const b=document.createElement("button");
    b.type="button";b.className="hiw-tab"+(i===ci?" on":"");b.dataset.c="";
    b.setAttribute("role","tab");b.setAttribute("aria-selected",String(i===ci));
    /* The name leaves the button but not the page: it stays the accessible
       name and the tooltip, so nothing is lost to a screen reader or to a
       visitor who does not read the silhouette. */
    b.innerHTML=catSVG(c.id);
    b.title=c.n;b.setAttribute("aria-label",c.n);
    b.addEventListener("click",()=>{
      if(ci===i)return;
      ci=i;gi=0;mi=0;pi=0;
      tabs.forEach((x,k)=>{x.classList.toggle("on",k===i);x.setAttribute("aria-selected",String(k===i));});
      build();
    });
    tabHost.appendChild(b);
    return b;
  });

  pills("hiwBgs",BGS,"",()=>bi,i=>bi=i);
  build();
})();

/* =============== "what do you want to create" accordion =============== */
/* Hover expands a panel; leaving the row collapses everything back to equal.
   Driven from JS rather than a bare CSS :hover so the same open state can be
   reached by tapping and by tabbing , on a phone there is no hover at all, and
   a keyboard user would otherwise never see the copy inside a panel. */
(function createPicker(){
  const row=document.getElementById("createRow");
  if(!row)return;

  const PANELS=[
    {slot:"photography",fb:"front",  pose:"front",name:"Photography",
     h:"Photography", p:"Turn one garment photo into a full on-model catalogue-ready shoot.", href:"/register"},
    {slot:"models",     fb:"hip",    pose:"hip",  name:"Models",
     h:"Models", p:"Cast models from across the world, every skin tone, body type and look and save them forever.", href:"/register"},
    /* `clips` is what makes this panel move. Tried in order, so a purpose-made
       file dropped beside the other create slots wins over the render that
       ships in public/ , and if neither is there the panel falls back to a
       still like the other two, with nothing to notice. */
    {slot:"video",      fb:"walk",   pose:"walk", name:"Video",
     h:"Video", p:"Turn any photoshoot into reel-ready video for PDPs, Instagram and ads.", href:"/register",
     clips:[ASSET_DIR+"create/video.mp4",ASSET_DIR+"create/video.webm","/video.mp4"]},
  ];

  const panels=PANELS.map((it,i)=>{
    /* A link, not a div: each panel goes somewhere, so it should be reachable
       by keyboard and openable in a new tab like anything else that does. */
    const a=document.createElement("a");
    a.className="cpanel";a.href=it.href;a.setAttribute("data-c","");
    a.insertAdjacentHTML("beforeend",
      `<span class="cname">${it.name}</span>
       <span class="cdetail">
         <h3>${it.h}</h3>
         <p>${it.p}</p>
       </span>`);
    row.appendChild(a);

    /* imagery: create/<slot> -> the base slot it borrows -> drawn croquis */
    (async()=>{
      let u=await probeChain(ASSET_DIR+"create/"+it.slot);
      if(!u)u=await probeChain(ASSET_DIR+it.fb);
      if(!u&&IMG[it.fb])u=await probe(U(IMG[it.fb],900));

      /* A panel with clips becomes a <video> POSTERED by that still, rather
         than a video instead of it. Closed, the panel still reads as a
         photograph and nothing has been downloaded past the header; the motion
         only exists once the panel is opened. */
      if(it.clips){
        let src=null;
        for(const c of it.clips){src=await probeVideo(c);if(src)break;}
        if(src){
          const v=document.createElement("video");
          v.src=src;v.loop=true;v.muted=true;v.playsInline=true;v.preload="metadata";
          if(u)v.poster=u;
          v.setAttribute("aria-hidden","true");
          a.prepend(v);
          /* The file can land after a hover has already happened , probing is a
             round trip and a pointer is faster. Without this the panel would sit
             open on a frozen poster until you left and came back. */
          if(a.classList.contains("on"))playPanel(a);
          return;
        }
      }

      if(u){
        const im=document.createElement("img");
        im.src=u;im.alt=it.h;im.loading=i>1?"lazy":"eager";
        a.prepend(im);
      } else {
        const d=document.createElement("div");
        d.style.cssText="position:absolute;inset:0";
        d.innerHTML=frameSVG(it.pose,BACKDROPS[i%BACKDROPS.length]);
        d.querySelector("svg").style.cssText="width:100%;height:100%";
        a.prepend(d);
      }
    })();

    return a;
  });

  let idx=-1;

  /* Muted, looping and started only on open , the three things a browser needs
     before it will play anything without a click. Reduced motion opts out: the
     poster is a real frame from the clip, so that state still shows the work. */
  const playPanel=p=>{
    const v=p.querySelector("video");
    if(!v||reduce)return;
    v.play().catch(()=>{});                 /* interrupted by a fast re-hover */
  };
  /* Rewound, not just paused: coming back to a panel should start the clip
     again rather than resume it three seconds in. */
  const stopPanel=p=>{
    const v=p.querySelector("video");
    if(!v)return;
    v.pause();v.currentTime=0;
  };

  function open(el){
    idx=el?panels.indexOf(el):-1;
    panels.forEach(p=>{
      const on=p===el;
      p.classList.toggle("on",on);
      if(on)playPanel(p);else stopPanel(p);
    });
    row.classList.toggle("has-on",!!el);
  }

  /* The round arrow from the reference. Made to actually advance the open panel
     rather than sit there as decoration , it gives touch and keyboard users a
     way through the set that hover alone never offers. */
  const next=document.createElement("button");
  next.type="button";next.className="cnext";next.setAttribute("aria-label","Next");
  next.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h13"/><path d="M12 5l7 7-7 7"/></svg>';
  next.addEventListener("click",()=>open(panels[(idx+1)%panels.length]));
  row.appendChild(next);

  panels.forEach(p=>{
    /* Stacked, the scroll is in charge , a tap that also fires mouseenter
       would otherwise yank the selection off whatever the scroll had chosen. */
    p.addEventListener("mouseenter",()=>{if(!narrow.matches)open(p);});
    p.addEventListener("focus",()=>open(p));
    /* First tap opens, second follows the link , otherwise a phone user would
       never see the copy before being navigated away. */
    p.addEventListener("click",e=>{
      if(matchMedia("(hover: none)").matches&&!p.classList.contains("on")){
        e.preventDefault();open(p);
      }
    });
  });
  row.addEventListener("mouseleave",e=>{
    if(narrow.matches)return;              /* stacked, the scroll owns it */
    if(next.contains(e.relatedTarget))return;
    open(null);
  });

  /* ---- stacked: the scroll picks the open card ----------------------- */
  /* On a phone the panels are a column of bars and there is no hover to open
     one with, so the section would sit there closed until tapped. Scroll
     position drives it instead: come down the page and each card opens as it
     reaches the reading line, closing the one before it.
     A tap still works, and now usually goes straight through to the link ,
     the card under your thumb is already the open one.

     The section is PINNED while this happens: the zone below is given extra
     height, the row sticks to the top of it, and that extra height is what the
     scroll spends stepping through the cards. Without it, arriving at speed
     flies past all four , the whole point of the section is that you see each
     door, and a fast flick should cost you the scroll rather than the content.

     The index comes from progress through the zone, not from any panel's live
     position. Opening a card is a ~290px layout change, so a rule measured off
     the panels is measuring edges its own last decision just moved: nearest-
     to-line flaps, and top-edge-passed settles but paces unevenly. The zone's
     height never changes, so its progress is a clean, evenly divided input. */
  const narrow=matchMedia("(max-width:860px)");
  const zone=document.getElementById("createZone");
  /* Scroll spent on each card, as a fraction of the viewport. Bigger holds
     each card longer and makes the section harder to rush. */
  const HOLD=0.55;
  let ticking=false;

  /* The pin needs one viewport to sit in plus the travel the cards consume.
     Cleared above the breakpoint so the desktop fan keeps its natural height. */
  function sizeZone(){
    if(!zone)return;
    zone.style.height=narrow.matches
      ? Math.round(innerHeight*(1+panels.length*HOLD))+"px"
      : "";
  }

  function pickByScroll(){
    ticking=false;
    if(!narrow.matches||!zone)return;
    const t=zoneProgress(zone);
    const k=Math.max(0,Math.min(panels.length-1,Math.floor(t*panels.length)));
    if(k!==idx)open(panels[k]);
  }
  function onScroll(){
    if(ticking)return;
    ticking=true;requestAnimationFrame(pickByScroll);
  }
  addEventListener("scroll",onScroll,{passive:true});
  addEventListener("resize",()=>{sizeZone();onScroll();});
  /* Crossing the breakpoint hands control over cleanly rather than leaving a
     card stuck open in a layout that never chose it. */
  narrow.addEventListener("change",()=>{open(null);sizeZone();onScroll();});
  sizeZone();onScroll();
})();

/* =============== "built for brands at every stage" deck =============== */
/* Seven categories, three cards on screen. Positions are computed from each
   card's signed distance to the active one so the same formula covers the fan,
   the wrap-around and the cards parked off-stage , there is no per-slot CSS to
   keep in sync. */
(function catsDeck(){
  const stage=document.getElementById("catsStage"),pillBox=document.getElementById("catsPills");
  if(!stage||!pillBox)return;

  /* `slug` is the only thing outside this file: a card looks for its photo at
     /webassets/cats/<slug> and falls back to the drawn croquis when there is
     none, so adding artwork later needs no code change. The deck's geometry is
     entirely N-driven, so the length of this list is free. */
  const CATS=[
    {slug:"ethnic",     n:"Ethnic", pose:"saree",
     p:"Sarees, kurtis and lehengas, drape-true and festive-ready"},
    {slug:"western",    n:"Western", pose:"front",
     p:"Dresses, tops and co-ords, shot editorial-clean"},
    {slug:"streetwear", n:"Casual", pose:"mfront",
     p:"Graphic tees and drops with lookbook attitude"},
    {slug:"swimwear",   n:"Swimwear", pose:"hip",
     p:"Resort and swim in sunlit, tasteful frames, marketplace-safe"},
    {slug:"coord",      n:"Co-ords", pose:"walk",
     p:"Matched top and bottom, shot as one look, print-true across both pieces"},
    {slug:"athleisure", n:"Athleisure", pose:"mwalk",
     p:"Movement-ready poses that show stretch, fit and function"}
  ];
  const N=CATS.length;
  let active=0;

  /* Cards. Each is a link , a category is a destination, so it should behave
     like one for the keyboard and for "open in new tab". */
  const cards=CATS.map((c,i)=>{
    const a=document.createElement("a");
    a.className="ccard";a.href="/register";a.setAttribute("data-c","");
    a.setAttribute("aria-label",c.n);
    a.insertAdjacentHTML("beforeend",
      `<span class="ccard-in">
        <h3>${c.n}</h3>
       </span>`);
        // <h3>${c.n}</h3>
        //  <p>${c.p}</p>
    /* A side card's first job is to come forward, not to navigate. */
    a.addEventListener("click",e=>{
      if(i!==active){e.preventDefault();go(i);}
    });
    stage.appendChild(a);

    (async()=>{
      const u=await probeChain(ASSET_DIR+"cats/"+c.slug);
      if(u){
        const im=document.createElement("img");
        im.src=u;im.alt=`${c.n} , AI on-model photography sample`;im.loading=i?"lazy":"eager";
        a.prepend(im);
      } else {
        /* Deliberately the drawn croquis, not a borrowed photo: a studio frame
           under "Ethnic Wear" or a dress under "T-shirt" would misrepresent the
           category, and an obvious placeholder is the honest failure. */
        const d=document.createElement("div");
        d.style.cssText="position:absolute;inset:0";
        d.innerHTML=frameSVG(c.pose,BACKDROPS[i%BACKDROPS.length]);
        d.querySelector("svg").style.cssText="width:100%;height:100%";
        a.prepend(d);
      }
    })();
    return a;
  });

  const pills=CATS.map((c,i)=>{
    const b=document.createElement("button");
    b.type="button";b.className="cpill";b.textContent=c.n;
    b.setAttribute("role","tab");
    b.addEventListener("click",()=>go(i));
    pillBox.appendChild(b);
    return b;
  });

  /* Shortest signed distance around the ring, so moving from the last category
     to the first slides one step forward instead of six steps back. */
  function offset(i){
    let d=i-active;
    if(d>N/2)d-=N;
    if(d<-N/2)d+=N;
    return d;
  }

  function layout(drag){
    drag=drag||0;
    const wide=innerWidth>860;
    const spread=wide?Math.min(330,innerWidth*0.23):innerWidth;   /* phone: park them off-screen */
    cards.forEach((el,i)=>{
      /* Continuous, not the integer offset: mid-drag a card sits BETWEEN slots,
         and rotation and scale have to interpolate with it or the deck snaps
         between poses while the finger is still moving. */
      const pos=offset(i)+drag/spread;
      const a=Math.abs(pos);
      const far=a>1.6;
      el.style.transform=
        `translate(-50%,0) translateX(${pos*spread}px) rotate(${wide?pos*9:0}deg) scale(${1-Math.min(a,1)*0.12})`;
      /* fade out over the last stretch rather than vanishing at a hard edge */
      el.style.opacity=far?"0":String(a>1?1-(a-1)/0.6:1);
      el.style.zIndex=String(10-Math.round(a*10)/10);
      el.classList.toggle("mid",a<0.5);
      /* Off-stage cards must leave the tab order , otherwise tabbing walks into
         four invisible links. */
      el.setAttribute("aria-hidden",far?"true":"false");
      if(far)el.setAttribute("tabindex","-1");else el.removeAttribute("tabindex");
    });
    pills.forEach((b,i)=>{
      b.classList.toggle("on",i===active);
      b.setAttribute("aria-selected",String(i===active));
    });
  }

  /* On a phone the pills are one scrolling strip, so the chosen one has to be
     brought into view , swiping the deck would otherwise leave the active pill
     off-screen and the row looking unresponsive. Only scrolls the strip itself,
     never the page. */
  function revealPill(){
    const b=pills[active];
    if(!b||pillBox.scrollWidth<=pillBox.clientWidth)return;
    const target=b.offsetLeft-(pillBox.clientWidth-b.offsetWidth)/2;
    pillBox.scrollTo({left:Math.max(0,target),behavior:"smooth"});
  }

  function go(i){active=(i+N)%N;layout();revealPill();}

  /* ---- drag: mouse, touch and pen through one set of handlers ---- */
  let x0=null,dx=0,moved=false;

  stage.addEventListener("pointerdown",e=>{
    if(e.button)return;                      /* left button / touch only */
    x0=e.clientX;dx=0;moved=false;
    stage.classList.add("dragging");
    /* Capture so the drag survives the pointer leaving the stage , releasing
       over the page beyond it should still finish the gesture, not abandon it. */
    stage.setPointerCapture(e.pointerId);
  });

  stage.addEventListener("pointermove",e=>{
    if(x0==null)return;
    dx=e.clientX-x0;
    if(Math.abs(dx)>6)moved=true;
    layout(dx);
  });

  function endDrag(){
    if(x0==null)return;
    x0=null;
    stage.classList.remove("dragging");
    const spread=innerWidth>860?Math.min(330,innerWidth*0.23):innerWidth;
    /* A third of a slot is enough to mean it , past that the next card is
       already more than half uncovered, so snapping back would feel wrong. */
    if(Math.abs(dx)>spread*0.32)go(active+(dx<0?1:-1));
    else layout();                           /* settle back into place */
    dx=0;
  }
  stage.addEventListener("pointerup",endDrag);
  stage.addEventListener("pointercancel",endDrag);
  /* A drag that ends on a card must not also register as a click on it. */
  stage.addEventListener("click",e=>{
    if(moved){e.preventDefault();e.stopPropagation();moved=false;}
  },true);

  addEventListener("resize",()=>layout());
  layout();
})();

/* =============== mobile navigation =============== */
/* Below 960px the burger is the only navigation on the page, so this stays
   deliberately simple and defensive: any exit closes it, and the sheet is
   removed from the tree with [hidden] whenever it is shut so its links can
   never be reached by a screen reader or the tab key while invisible. */
(function mobileNav(){
  const burger=document.getElementById("burger"),sheet=document.getElementById("mobileNav");
  if(!burger||!sheet)return;
  const scrim=document.getElementById("mnavScrim");
  const links=sheet.querySelectorAll("a");

  let open=false;

  function set(next){
    if(next===open)return;
    open=next;
    burger.setAttribute("aria-expanded",String(open));
    burger.setAttribute("aria-label",open?"Close menu":"Open menu");

    if(open){
      sheet.hidden=false;
      /* One frame with the sheet in the tree but still translated off, so the
         transition has a start state to animate FROM. */
      requestAnimationFrame(()=>document.body.classList.add("mnav-open"));
      /* Hold the page still underneath , a menu that scrolls the article behind
         it feels broken on a phone. */
      document.body.style.overflow="hidden";
    } else {
      document.body.classList.remove("mnav-open");
      document.body.style.overflow="";
      const done=()=>{if(!open)sheet.hidden=true;};
      /* transitionend can be missed (reduced motion, background tab), so the
         timeout guarantees the sheet is eventually taken out of the tree. */
      setTimeout(done,420);
    }
  }

  burger.addEventListener("click",()=>set(!open));
  scrim&&scrim.addEventListener("click",()=>set(false));
  links.forEach(a=>a.addEventListener("click",()=>set(false)));
  addEventListener("keydown",e=>{if(e.key==="Escape")set(false);});
  /* Rotating to landscape can cross the breakpoint, which would leave the body
     locked with no visible way to unlock it. */
  addEventListener("resize",()=>{if(innerWidth>960)set(false);});
})();

/* =============== prompt genie: summoned by the scroll =============== */
/* The whole summon is one scrubbed gesture rather than a click: the tile
   rises into the pinned stage, bursts into smoke at the halfway mark, and the
   demo panel forms out of the same burst. Every value is read from the zone's
   0..1 progress, so scrolling back up runs it backwards , the panel collapses,
   the smoke gathers, and Genie re-forms. Nothing is on a timer, which is what
   makes it feel attached to the wheel rather than triggered by it. */
(function genieSummon(){
  const wrap=document.getElementById("genieWrap");
  if(!wrap)return;                          /* only the marketing page has one */

  const veil=document.getElementById("genieVeil");
  const copy=document.getElementById("genieCopy");
  const hint=document.getElementById("genieHint");
  const tile=document.getElementById("genieTile");
  const modal=document.getElementById("genieModal");
  const media=document.getElementById("genieMedia");

  /* Stops along the zone. The poof is a window rather than a point so the tile
     has room to shrink into its own smoke instead of blinking out. */
  const RISE=0.24, POOF0=0.40, POOF1=0.50, OPEN=0.66;

  /* ---- the burst ---------------------------------------------------- */
  /* Deliberately outside the DOM the section owns: ~20 throwaway nodes that
     live for under a second, animate transform/opacity/filter only and remove
     themselves. Same palette as the Genie inside the app. */
  const PUFF_COLS=["rgba(178,150,255,.7)","rgba(214,180,110,.6)","rgba(255,255,255,.8)",
                   "rgba(150,120,240,.65)","rgba(196,160,255,.7)","rgba(230,215,180,.6)"];
  const rnd=(a,b)=>a+Math.random()*(b-a);

  function puff(cls,size,x,y){
    const el=document.createElement("div");
    el.className=cls;
    el.style.cssText=`width:${size}px;height:${size}px;left:${x-size/2}px;top:${y-size/2}px`;
    document.body.appendChild(el);
    return el;
  }

  /* gather:false scatters outward (Genie leaving), true converges (returning) */
  function burst(x,y,gather){
    if(reduce)return;                        /* the tile still goes and comes back */

    const core=puff("gcore",190,x,y);
    core.animate(
      gather
        ?[{transform:"scale(1.8)",opacity:0,filter:"blur(14px)"},{opacity:.7,offset:.35},{transform:"scale(.3)",opacity:0,filter:"blur(4px)"}]
        :[{transform:"scale(.25)",opacity:.9,filter:"blur(4px)"},{opacity:.85,offset:.35},{transform:"scale(2.4)",opacity:0,filter:"blur(16px)"}],
      {duration:gather?640:760,easing:"ease-out"}
    ).onfinish=()=>core.remove();

    for(let i=0;i<18;i++){
      const size=rnd(34,78);
      const el=puff("gsmoke",size,x,y);
      const c=PUFF_COLS[i%PUFF_COLS.length];
      el.style.background=`radial-gradient(circle at 50% 45%,${c} 0%,${c} 22%,transparent 68%)`;
      const ang=rnd(0,Math.PI*2),dist=rnd(40,110);
      const dx=Math.cos(ang)*dist;
      /* Drifting up on the way out reads as smoke; on the way in it converges. */
      const dy=Math.sin(ang)*dist-(gather?0:rnd(55,100));
      el.animate(
        gather
          ?[{transform:`translate(${dx}px,${dy-20}px) scale(1.8)`,opacity:0,filter:"blur(10px)"},
            {transform:`translate(${dx*.4}px,${dy*.4}px) scale(1.15)`,opacity:.7,offset:.45,filter:"blur(6px)"},
            {transform:"translate(0,8px) scale(.2)",opacity:0,filter:"blur(2px)"}]
          :[{transform:"translate(0,0) scale(.5)",opacity:0,filter:"blur(2px)"},
            {transform:`translate(${dx*.45}px,${dy*.45}px) scale(1.5)`,opacity:.9,offset:.3,filter:"blur(5px)"},
            {transform:`translate(${dx}px,${dy}px) scale(3)`,opacity:0,filter:"blur(13px)"}],
        {duration:gather?rnd(680,880):rnd(1000,1450),easing:gather?"ease-out":"cubic-bezier(.15,.6,.2,1)"}
      ).onfinish=()=>el.remove();
    }

    if(gather)return;
    const ring=puff("gring",120,x,y);
    ring.animate([{transform:"scale(.2)",opacity:.6},{transform:"scale(2.8)",opacity:0}],
      {duration:680,easing:"ease-out"}).onfinish=()=>ring.remove();
  }

  /* ---- the panel's video -------------------------------------------- */
  /* Drop /webassets/genie-demo.mp4 (or .webm) in and the panel plays it; with
     no file there it holds a still instead, the same way every other slot on
     this page degrades. */
  let vid=null,playing=false;

  /* Tried in order. A purpose-made genie-demo in webassets wins if one is ever
     dropped there; failing that the omni render that ships in public/ plays.
     Its name carries a space, so it has to go through encodeURI or the request
     404s and the panel falls back to a still for no visible reason. */
  const SOURCES=[
    ASSET_DIR+"genie-demo.mp4",
    ASSET_DIR+"genie-demo.webm",
    encodeURI("/omni_f22e5154--BG Tokyo.mp4"),
  ];

  (async function fillMedia(){
    for(const url of SOURCES){
      const hit=await probeVideo(url);
      if(!hit)continue;
      vid=document.createElement("video");
      vid.src=hit;vid.loop=true;vid.muted=true;vid.playsInline=true;vid.preload="metadata";
      vid.setAttribute("playsinline","");
      media.appendChild(vid);

      /* Autoplay only survives muted, so the only control worth having is the
         one that turns the sound back on. */
      const snd=document.createElement("button");
      snd.type="button";snd.className="gm-sound";snd.dataset.c="";snd.textContent="Sound on";
      snd.addEventListener("click",ev=>{
        ev.stopPropagation();
        vid.muted=!vid.muted;
        snd.textContent=vid.muted?"Sound on":"Sound off";
      });
      media.appendChild(snd);
      return;
    }
    media.appendChild(mkImg("walk",900,"walk",BACKDROPS[0],"Prompt Genie , sample frame from a generated shoot"));
  })();

  /* ---- the frame ----------------------------------------------------- */
  let poofed=false;

  function frame(){
    const t=zoneProgress(wrap);
    const rise=clamp(t/RISE,0,1);
    const k=clamp((t-POOF0)/(POOF1-POOF0),0,1);          /* vanish   */
    const m=clamp((t-POOF1)/(OPEN-POOF1),0,1);           /* materialise */
    const er=ease(rise),em=ease(m);

    copy.style.opacity=rise*(1-.55*m);
    copy.style.transform=`translateY(${(1-er)*26}px)`;
    // Guarded like the rest: frame() is called synchronously when the loop
    // starts, so a missing hint here does not fade a caption , it throws out of
    // this IIFE and stops every section further down the file from running.
    if(hint)hint.style.opacity=rise*(1-clamp((t-0.16)/0.16,0,1));

    /* Shrinking into the burst rather than fading: the smoke leaves from the
       tile's centre, so the tile has to end up there too. */
    tile.style.opacity=rise*(1-k);
    tile.style.transform=`translateY(${(1-er)*44-8*k}px) scale(${(.88+.12*er)*(1-.9*k)})`;
    tile.style.filter=`blur(${7*k}px)`;
    tile.style.pointerEvents=k>.5?"none":"auto";
    tile.tabIndex=k>.5?-1:0;

    /* Fired on the crossing, not every frame , and gathering on the way back
       up, so a reversed scroll pulls the smoke in instead of blowing it out
       a second time. */
    const gone=k>.12;
    if(gone!==poofed){
      poofed=gone;
      const r=tile.getBoundingClientRect();
      burst(r.left+r.width/2,r.top+r.height/2,!gone);
    }

    veil.style.opacity=em;
    modal.style.opacity=m;
    modal.style.transform=`scale(${.72+.28*em})`;
    modal.style.filter=`blur(${(1-m)*10}px)`;
    modal.style.pointerEvents=m>.9?"auto":"none";
    modal.setAttribute("aria-hidden",String(m<.5));

    const wantPlay=m>.55;
    if(vid&&wantPlay!==playing){
      playing=wantPlay;
      if(wantPlay)vid.play().catch(()=>{});   /* a blocked autoplay is not an error */
      else vid.pause();
    }
  }

  /* Same shape as the page's other scroll work: one permanent rAF reading one
     rect. Gating it on an observer only adds a state that can be wrong, and a
     summon frozen half-way because the gate never opened is worse than the
     rect. */
  (function loop(){frame();requestAnimationFrame(loop);})();

  /* The tile is still a button: pressing it scrolls to the point in the zone
     where the panel is open, so a click plays the same summon the scroll does
     rather than a second animation that has to be kept in step with it. */
  tile.addEventListener("click",()=>{
    const total=Math.max(1,wrap.offsetHeight-innerHeight);
    const top=wrap.getBoundingClientRect().top+scrollY+total*0.78;
    scrollTo({top,behavior:reduce?"auto":"smooth"});
  });
})();

/* =============== the output: a fan of frames that play =============== */
/* Nine frames from one shoot laid out on an arc. Each holds a clip that stays
 * paused on its poster until you hover it , then the card straightens out of
 * the arc and plays. Leaving puts it back on its first frame, so the row is
 * always a sheet of stills until someone asks for motion.
 *
 * Clips live at  /webassets/reels/r1.mp4 … r9.mp4  (.webm also works), with an
 * optional poster at  /webassets/reels/r1.jpg|png|webp.  A slot with no clip
 * of its own falls back to a single shared  /webassets/reels/demo.mp4  and
 * plays its own moment of it , card three starts a third of the way in , so
 * one file is enough to see the whole row work. A slot with neither still
 * shows its frame; it just has nothing to play, and says so by not offering a
 * play badge.
 */
(function reelArc(){
  const arc=document.getElementById("reelArc");
  if(!arc)return;                           /* only the marketing page has one */

  /* The clips, in the order they fan. Real files in /VDOs, named for the preset
     that produced them , `file` is the name on disk and `t` is what the caption
     shows, so a rename is one string, not two places to keep in step. */
  const REEL_DIR="/VDOs/";
  const CLIPS=[
    {file:"Studio PDP.mp4",     t:"Studio PDP",     s:"Clean seamless backdrop · slow turns · detail push-in"},
    {file:"Editorial.mp4",      t:"Editorial",      s:"Fast cinematic cuts · full-body to detail"},
    {file:"On Location-2.mp4",  t:"On location",    s:"Sunlit street · natural relaxed motion"},
    {file:"Detail  Fabric.mp4", t:"Detail / fabric",s:"Macro on texture, drape and print"},
    {file:"Turn Table.mp4",     t:"Turntable / 360",s:"Clean product-forward rotation"},
    {file:"Runway.mp4",         t:"Runway",         s:"Confident stride to camera · dramatic light"},
    {file:"Insta Reel.mp4",     t:"Instagram reel", s:"Trendy rapid cuts · social-first vertical"},
    {file:"Slow-mo Glam.mp4",   t:"Slow-mo glam",   s:"Luxurious slow motion · fabric and hair flow"},
    {file:"Golden Hour-2.mp4",  t:"Golden hour",    s:"Warm sunset backlight · aspirational"},
    {file:"Street Style.mp4",   t:"Street style",   s:"Edgy urban · dynamic and cool"},
    {file:"Editorial-2.mp4",    t:"Editorial, take two", s:"The same brief, a second read"}
  ];
  const N=CLIPS.length;
  /* Derived, not fixed: the fan should occupy the same arc whatever the clip
     count is. A constant per-card step widened the whole spread every time a
     file was added, and the outer cards walked off the screen. */
  const SPREAD=59.2;                        /* total degrees, end to end */
  const STEP=SPREAD/Math.max(1,N-1);

  const wide=matchMedia("(min-width:861px)");
  /* Wording only , NOT a gate on the listeners. `(hover:hover)` reads false on
     a touchscreen laptop and in device-emulation, and gating hover on it left
     those machines with click as the only way in. Both are always wired now,
     and the hint corrects itself on the first real pointer event below. */
  const hint=document.getElementById("reelHint");
  let canHover=matchMedia("(hover:hover)").matches;
  const say=h=>{if(hint)hint.textContent=h?"Playing on its own , hover any frame to take over"
                                          :"Tap a frame to play it";};
  say(canHover);


  /* ---- the cards ------------------------------------------------------ */
  const cards=CLIPS.map((clip,i)=>{
    const card=document.createElement("div");
    card.className="reel";

    const box=document.createElement("button");
    box.type="button";box.className="reel-in";box.dataset.c="";
    box.setAttribute("aria-label",`Play ${clip.t} , clip ${i+1} of ${N}`);

    /* The clip IS the card, from the first paint , there is no still underneath
       to swap out. `#t=0.1` is the poster: it makes the browser seek to a tenth
       of a second and paint THAT frame, so what you see at rest is the video's
       own opening rather than a black box or a separate thumbnail that has to
       be kept in step with the file. `preload="metadata"` is what keeps eleven
       of these from pulling 30 MB on load , enough to draw the frame, no more. */
    const v=document.createElement("video");
    v.src=encodeURI(REEL_DIR+clip.file)+"#t=0.1";
    v.loop=true;v.muted=true;v.playsInline=true;v.preload="metadata";
    v.setAttribute("playsinline","");
    box.appendChild(v);

    const badge=document.createElement("span");
    badge.className="reel-play";
    box.appendChild(badge);

    /* The caption rides on the frame it describes rather than sitting in a
       shared line under the arc. With eleven cards fanned out, a single line
       below could only ever name one of them , on the card, every frame says
       what it is the moment you reach it. */
    const cap=document.createElement("span");
    cap.className="reel-cap-in";
    cap.innerHTML=`<b></b><i></i>`;
    cap.querySelector("b").textContent=clip.t;
    /* The description only. The "Clip 08 ·" counter came from when the caption
       sat under the arc and had to say which of eleven cards it meant; now that
       every card carries its own, it was numbering a set nobody counts through.
       The count survives where it still helps , the button's aria-label above
       still says "clip 8 of 11", which is a screen reader's only sense of
       position in the row. */
    cap.querySelector("i").textContent=clip.s;
    box.appendChild(cap);

    card.appendChild(box);
    arc.appendChild(card);
    return {card,box,i,video:v,start:0};
  });

  /* ---- the arc -------------------------------------------------------- */
  /* Radius comes from the rendered card width so the overlap holds at every
     size: neighbours sit a little over three-quarters of a card apart, which
     is the chord of STEP degrees on a circle of this radius. */
  function layout(){
    if(!wide.matches){
      cards.forEach(({card})=>{card.style.transform="";card.style.zIndex="";card.style.transitionDelay="";});
      arc.style.height="";
      return;
    }
    const w=cards[0].card.offsetWidth||180, h=cards[0].card.offsetHeight||w*4/3;
    const R=w*0.78/(2*Math.sin(STEP*Math.PI/360));
    const mid=(N-1)/2;
    let low=h;
    cards.forEach(({card},i)=>{
      const deg=(i-mid)*STEP, rad=deg*Math.PI/180;
      const x=R*Math.sin(rad), y=R*(1-Math.cos(rad));
      /* A rotated card's footprint is taller than the card, and the rotation
         is about its own centre , so this is where its lowest corner lands. */
      low=Math.max(low,y+h/2+(w*Math.abs(Math.sin(rad))+h*Math.abs(Math.cos(rad)))/2);
      card.style.setProperty("--rot",deg+"deg");
      card.style.transform=`translate(calc(-50% + ${x.toFixed(1)}px),${y.toFixed(1)}px) rotate(${deg.toFixed(2)}deg)`;
      /* The middle card is the one in front, and each step out sits behind
         the one before it , the same order the eye reads the fan in. */
      card.style.zIndex=String(30-Math.round(Math.abs(i-mid)));
    });

    /* Derived rather than measured: layout runs while the fan is still opening,
       so a rect read here would size the box to a half-finished animation. */
    arc.style.height=Math.round(low+18)+"px";
  }

  /* ---- playback ------------------------------------------------------- */
  let playing=null;

  function stop(c){
    if(!c||!c.video)return;
    c.video.pause();
    c.video.currentTime=c.start||0;         /* back to the still it came from */
    c.card.classList.remove("playing");
    if(playing===c)playing=null;
  }

  function start(c){
    if(!c.video)return;
    if(playing&&playing!==c)stop(playing);   /* one clip at a time */
    playing=c;
    c.card.classList.add("playing");
    c.video.play().catch(()=>{});            /* a blocked autoplay is not an error */
  }


  cards.forEach(c=>{
    /* A tap fires pointerenter and then click, so without this the tap would
       start the clip and the click that follows would immediately pause it.
       The flag lets that one click through untouched; every later click on the
       same card toggles as normal. */
    let entered=false;

    c.card.addEventListener("pointerenter",e=>{
      /* The first real pointer settles the question the media query got wrong. */
      if(e.pointerType==="mouse"&&!canHover){canHover=true;say(true);}
      else if(e.pointerType==="touch"&&canHover){canHover=false;say(false);}
      entered=e.pointerType!=="mouse";
      start(c);
    });
    c.card.addEventListener("pointerleave",()=>{stop(c);});

    /* Keyboard reaches the same thing the pointer does. */
    c.box.addEventListener("focus",()=>{start(c);});
    c.box.addEventListener("blur",()=>{stop(c);});

    /* Caption first: it is free and instant, where playback may be refused. */
    c.box.addEventListener("click",()=>{
      tourAt=c.i;                             /* the tour carries on from here */
      if(!c.video)return;
      if(entered){entered=false;return;}      /* the tap already started it */
      c.video.paused?start(c):stop(c);
    });
  });

  /* ---- the tour ------------------------------------------------------- */
  /* The row runs itself: one card at a time straightens, plays and captions
     itself, then hands over to the next. A pointer on the row takes the wheel
     , the tour stands down while you are driving and picks up from wherever it
     was left when you go. Held to `reduce`, which opts out of both the moving
     row and the autoplaying video in one go. */
  const DWELL=4200;                        /* ms each frame holds the row */
  let tourAt=-1,tourT=null;

  /* Only the mobile strip scrolls. On the desktop arc there is nothing to
     scroll, and scrollIntoView there would drag the page instead of the row ,
     so this moves the container itself rather than asking the card to be seen. */
  let selfScroll=0;                        /* while set, scrolls are our own */
  function centre(c){
    if(wide.matches)return;
    const left=c.card.offsetLeft-(arc.clientWidth-c.card.offsetWidth)/2;
    selfScroll=performance.now()+800;      /* covers the smooth scroll's run */
    arc.scrollTo({left:Math.max(0,left),behavior:reduce?"auto":"smooth"});
  }

  function show(i){
    const c=cards[i];
    if(!c)return;
    tourAt=i;start(c);centre(c);
  }

  /* Skips slots that never got a clip: a card with nothing to play would sit
     there as a dead beat in the rotation. */
  function nextIdx(){
    for(let n=1;n<=N;n++){
      const i=(tourAt+n)%N;
      if(cards[i].video)return i;
    }
    return -1;
  }

  function step(){
    const i=nextIdx();
    /* Every card has its clip from the first paint now, so this only guards
       the degenerate case of an empty list. */
    if(i<0)return;
    show(i);
    tourT=setTimeout(step,DWELL);
  }

  function tourPlay(){
    if(reduce)return;
    clearTimeout(tourT);
    if(tourAt<0){step();return;}           /* cold start: begin at once */
    show(tourAt);                          /* warm: put our own frame back on */
    tourT=setTimeout(step,DWELL);
  }
  function tourPause(){clearTimeout(tourT);}

  /* Driving beats the tour, in both directions. */
  arc.addEventListener("pointerenter",tourPause);
  arc.addEventListener("pointerleave",tourPlay);
  arc.addEventListener("focusin",tourPause);
  arc.addEventListener("focusout",tourPlay);

  /* A hand on the strip wins. Without this the tour would yank the row back to
     its own card on the next tick and a swipe would be unusable , so a manual
     scroll re-seats the tour on whatever was scrolled to and carries on from
     there. `selfScroll` is what keeps centre()'s own smooth scroll from being
     read as the user's and re-triggering this in a loop. */
  let settle=null;
  arc.addEventListener("scroll",()=>{
    if(wide.matches||performance.now()<selfScroll)return;
    tourPause();
    clearTimeout(settle);
    settle=setTimeout(()=>{
      const mid=arc.scrollLeft+arc.clientWidth/2;
      let best=tourAt,bd=Infinity;
      cards.forEach(({card},i)=>{
        const d=Math.abs(card.offsetLeft+card.offsetWidth/2-mid);
        if(d<bd){bd=d;best=i;}
      });
      tourAt=best;tourPlay();
    },280);
  },{passive:true});

  /* ---- reveal --------------------------------------------------------- */
  /* The fan opens from a stack when the section arrives: the cards start piled
     at the centre, and the layout above is what they animate to. Staggered
     from the middle out, so it reads as one hand of cards being spread. */
  let opened=false;
  new IntersectionObserver((es,obs)=>{
    if(!es[0].isIntersecting)return;
    obs.disconnect();
    opened=true;
    const mid=(N-1)/2;
    cards.forEach(({card},i)=>{
      card.style.transitionDelay=reduce?"0s":(Math.abs(i-mid)*0.05).toFixed(2)+"s";
      card.classList.add("in");
    });
    layout();
    setTimeout(()=>cards.forEach(({card})=>{card.style.transitionDelay="";}),1200);
  },{threshold:.15}).observe(arc);

  /* Nothing plays behind you: the tour halts with the clip when the row leaves
     the screen and resumes on the same frame when it comes back, so returning
     to the section neither finds it frozen nor restarts it from the top. */
  new IntersectionObserver(es=>{
    if(es[0].isIntersecting){tourPlay();return;}
    tourPause();stop(playing);
  },{threshold:0}).observe(arc);

  let rt;
  addEventListener("resize",()=>{clearTimeout(rt);rt=setTimeout(()=>{if(opened)layout();},150);});
})();

/* =============== pricing packs: the dots =============== */
/* The packs now ride the same scroll-scrubbed rail as the feature row, so there
 * is no autoplay any more: the row moves because the page does, and a carousel
 * that advanced on its own would have to scroll the page out from under you to
 * do it. What is left is the readout , which of the four you are looking at ,
 * and a way to jump to one.
 *
 * The dots never move the track. They ask the rail to scroll the page to the
 * position that centres a card, exactly as a drag does, so there is still one
 * source of truth. Phone only: the desktop has the hairline instead.
 */
(function planDots(){
  const track=document.getElementById("priceTrack");
  const dotBox=document.getElementById("planDots");
  if(!track||!dotBox||!priceRail)return;
  const cards=[...track.querySelectorAll(".plan")];
  if(cards.length<2)return;                 /* one pack is not a slider */

  const narrow=matchMedia("(max-width:620px)");
  let at=-1;

  /* Where a card has to sit for its middle to be the middle of the screen,
     expressed as rail progress. */
  function progressFor(i){
    const extra=priceRail.travel();
    if(!extra)return 0;
    const c=cards[i];
    return clamp((c.offsetLeft+c.offsetWidth/2-innerWidth/2)/extra,0,1);
  }

  const dots=cards.map((c,i)=>{
    const b=document.createElement("button");
    b.type="button";b.className="pdot";b.dataset.c="";
    b.setAttribute("aria-label",`Show pack ${i+1} of ${cards.length}`);
    b.addEventListener("click",()=>priceRail.scrollTo(progressFor(i)));
    dotBox.appendChild(b);
    return b;
  });

  /* Read off the rail rather than tracked separately , the row can be moved by
     scroll, by a drag or by a dot, and only its actual position is true. */
  function paint(){
    if(dotBox.hidden)return;
    const mid=innerWidth/2, m=new DOMMatrixReadOnly(getComputedStyle(track).transform);
    let best=0,bd=Infinity;
    cards.forEach((c,i)=>{
      const d=Math.abs(c.offsetLeft+c.offsetWidth/2+m.m41-mid);
      if(d<bd){bd=d;best=i;}
    });
    if(best===at)return;
    at=best;
    dots.forEach((d,i)=>{
      d.classList.toggle("on",i===at);
      d.setAttribute("aria-current",String(i===at));
    });
  }

  function sync(){dotBox.hidden=!narrow.matches;at=-1;paint();}
  narrow.addEventListener("change",sync);
  addEventListener("scroll",paint,{passive:true});
  addEventListener("resize",paint);
  sync();
})();

/* =============== contact form =============== */
/* Progressive enhancement, not a replacement: the markup is a real <form> with
 * a real action, so with this file blocked it still posts and still works. All
 * this does is keep the visitor on the page.
 *
 * The success state replaces the form outright rather than clearing the fields.
 * A form that empties itself looks the same as a form that lost your message,
 * and someone who is not sure it sent will send it again.
 */
(function leadForm(){
  const form=document.getElementById("leadForm");
  const btn=document.getElementById("leadBtn");
  const msg=document.getElementById("leadMsg");
  if(!form||!btn||!msg)return;

  const say=(t,cls)=>{msg.textContent=t;msg.className="ct-msg"+(cls?" "+cls:"");};

  form.addEventListener("submit",async e=>{
    e.preventDefault();
    if(form.classList.contains("sending"))return;

    const fd=new FormData(form);
    const body={};
    fd.forEach((v,k)=>{body[k]=typeof v==="string"?v:"";});
    body.source="landing";

    /* Checked here as well as on the server, only so the answer is instant.
       The server is still the one that decides , see lib/leads.ts. */
    if(!String(body.name||"").trim()){say("Please tell us your name","err");return;}
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(body.email||"").trim())){
      say("That email address does not look right","err");return;
    }
    if(String(body.message||"").trim().length<5){say("Please tell us what you need","err");return;}

    form.classList.add("sending");
    btn.disabled=true;
    say("Sending…");

    try{
      const r=await fetch("/api/leads",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify(body),
      });
      const j=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(j.detail||j.error||"Something went wrong. Please try again.");

      const name=String(j.name||"").split(" ")[0];
      form.innerHTML=
        '<div class="ct-done">'+
          '<div class="ct-tick">✓</div>'+
          "<h3>Thanks"+(name?", "+name.replace(/[<>&]/g,""):"")+".</h3>"+
          "<p>Your enquiry is with us. We reply within one working day , "+
          "check your spam folder if you don't hear back, and it will be from our studio address.</p>"+
        "</div>";
      form.classList.remove("sending");
    }catch(err){
      form.classList.remove("sending");
      btn.disabled=false;
      /* The typed message stays in the fields: the one thing worse than a
         failed send is a failed send that also ate what you wrote. */
      say(err&&err.message?err.message:"Something went wrong. Please try again.","err");
    }
  });
})();
