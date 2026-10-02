(()=>{
'use strict';
/* =========================================================
   DARK DHETH JOKER v040
   Rules (unchanged):
   - 2 vs 2, decimal blackjack (each card has +0.0〜+0.9), 52 + JOKER(0〜10)
   - start ¥50万 each. The single highest valid total wins and takes
     total×1万 from EACH living opponent (no overkill: capped at their money)
   - 0円 → skeleton. When one side has 1 alive + 1 dead, that team may RAISE once:
     survivor's money is split in half to revive the partner.
   - Tie for 1st or all bust → no contest.
   ========================================================= */
const $=s=>document.querySelector(s);
const W=540,H=960;
const NAME=['YOU','ALLY','ENEMY A','ENEMY B'];
const TYPE=['you','ally','enemyA','enemyB'];
const suits=['♠','♥','♦','♣'],ranks=['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const ACTS=['draw','discard','win','shout','hurt','collapse','revive','attack','attackBig','bust','turn'];
// v033: slower, with clear beats between events (ms)
const TEMPO={deal:230,hit:380,cpuThink:560,cpuDraw:520,near21:420,bust:1050,winPose:380,winFreeze:800,loserReact:450,money:800,deathHold:550,collapse:950,postRound:1100,raise:700,beat:420,roundCall:1400,turnCall:900,jokerCall:1300};
const BIG_HIT=20.0;
// v040 anti-stall rules: exact 21.0 = BLACKJACK (winner deals ×2). A busted loser takes ×2. They stack (×4).
const BJ_MULT=2, BUST_MULT=2;   // totals at/above this use the heavy attack

/* ---------------------------------------------------------
   STAGE SPRITE ANIMATION
   Frames: assets/stage_anim/<type>_<action>_<n>.png (360x360, facing right, feet on the bottom edge)
   Counts below match the files. To swap art, overwrite the PNGs (same names) or change a count.
   --------------------------------------------------------- */
const STAGE_ANIM={
  you:   {idle:4,turn:4,draw:4,discard:4,attack:4,attackBig:6,win:1,shout:1,hurt:3,bust:2,collapse:4,skeleton:1,revive:4},
  ally:  {idle:4,turn:4,draw:4,discard:4,attack:4,attackBig:6,win:1,shout:1,hurt:2,bust:1,collapse:4,skeleton:1,revive:4},
  enemyA:{idle:4,turn:4,draw:4,discard:4,attack:4,attackBig:6,win:1,shout:1,hurt:2,bust:1,collapse:4,skeleton:1,revive:4},
  enemyB:{idle:4,turn:4,draw:4,discard:4,attack:4,attackBig:6,win:1,shout:1,hurt:1,bust:1,collapse:4,skeleton:1,revive:4},
};
const STAGE_FPS={idle:2.2,skeleton:2,collapse:6,revive:5,attackBig:11,turn:8,default:9};
const PINGPONG={idle:true};   // idle plays 0-1-2-3-2-1 for a calmer breath
const LOOPING={idle:true,skeleton:true};
const BODY_H=[205,175,175,205];       // visible body height per actor (logical px) for FX placement

let P=[],deck=[],round=1,over=false,pending=null,phase='idle',timer=null,actionLock=false,session=0,scale=1;

const wait=ms=>new Promise(r=>setTimeout(r,ms));
const stale=token=>token!==session||over;
// money is kept in 万 units with one decimal: 50.5 → ¥50M5K, 20.0 → ¥20M, 0.5 → ¥5K
// money as HTML: digits white, ¥/M/K in the unit colour
const yenHTML=m=>yen(m).replace(/(\d+)/g,'<b class="mn">$1</b>');
const yen=m=>{const t=Math.round(Math.abs(m)*10),M=Math.floor(t/10),K=t%10;return '¥'+(t===0?'0':(M?M+'M':'')+(K?K+'K':''))};
const rnd=(a,b)=>a+Math.random()*(b-a);
function later(fn,ms){const t=session;return setTimeout(()=>{if(t===session)fn()},ms)}
const S=window.Sound||{unlock(){},play(){},playBgm(){},stopBgm(){},setMuted(){},muted:false};
const voice=(kind,team)=>S.play(`vo_${kind}_${team===0?'ally':'enemy'}`);
const click=()=>S.play('se_button');

/* ---------- screen fit: scale the fixed 540x960 canvas ---------- */
function fit(){
  const vw=window.innerWidth,vh=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;
  scale=Math.min(vw/W,vh/H);
  $('#game').style.transform=`scale(${scale})`;
  const v=$('#viewport');v.style.width=W*scale+'px';v.style.height=H*scale+'px';
}
window.addEventListener('resize',fit);
if(window.visualViewport)window.visualViewport.addEventListener('resize',fit);
fit();

function posOf(el){
  const g=$('#game').getBoundingClientRect(),r=el.getBoundingClientRect();
  return{x:(r.left-g.left+r.width/2)/scale,y:(r.top-g.top+r.height/2)/scale,w:r.width/scale,h:r.height/scale,top:(r.top-g.top)/scale,bottom:(r.bottom-g.top)/scale};
}
function actorBox(i){
  const b=posOf($('#actor'+i)),dir=P[i]&&P[i].team===1?-1:1,h=BODY_H[i]*(P[i]&&!P[i].alive?.5:1);
  return{x:b.x+dir*9,y:b.bottom-h/2,w:b.w*.4,h,top:b.bottom-h,bottom:b.bottom};
}

/* ---------- deck & scoring ---------- */
function newDeck(){
  const d=[];
  for(const s of suits)for(const r of ranks)d.push({r,s,d:Math.floor(Math.random()*10)/10,j:null});
  d.push({r:'JOKER',s:'★',d:Math.floor(Math.random()*10)/10,j:null});
  for(let i=d.length-1;i;i--){const k=Math.floor(Math.random()*(i+1));[d[i],d[k]]=[d[k],d[i]]}
  return d;
}
function base(c){return c.r==='A'?1:['J','Q','K'].includes(c.r)?10:c.r==='JOKER'?(c.j??0):+c.r}
function total(p){let t=p.hand.reduce((n,c)=>n+base(c)+c.d,0),a=p.hand.filter(c=>c.r==='A').length;while(a--&&t+10<=21.00001)t+=10;return Math.round(t*10)/10}
function bestJ(p,c){let bv=0,bt=-1;for(let v=0;v<=10;v++){c.j=v;const t=total(p);if(t<=21&&t>bt){bv=v;bt=t}}c.j=bv}

/* ---------- card markup (original card art; rank/decimal are drawn as text) ---------- */
const isRed=c=>c.s==='♥'||c.s==='♦';
const SUIT={'♠':'spade','♥':'heart','♦':'diamond','♣':'club'};
function cardHTML(c,size,extra=''){
  if(c.r==='JOKER')return `<span class="card ${size} jkc ${extra}"><b class="rk">★${c.j??'?'}</b><i class="dc">+${c.d.toFixed(1)}</i></span>`;
  const face=['J','Q','K'].includes(c.r),s=`assets/cards/suit_${SUIT[c.s]}.png`;
  const art=face?`<img class="em" src="assets/cards/emblem_${c.r}.png" alt=""><img class="ss" src="${s}" alt="">`:`<img class="su" src="${s}" alt="">`;
  return `<span class="card ${size} ${isRed(c)?'red':''} ${extra}"><b class="rk">${c.r}</b>${art}<i class="dc">+${c.d.toFixed(1)}</i></span>`;
}
const miniCard=(c,extra='')=>cardHTML(c,'mini',extra);
const bigCard=(c,extra='')=>cardHTML(c,'big',extra);

/* ---------- expression faces: 0 normal/1 confident/2 focus/3 shock/4 anger/5 damage/6 win/7 skull ---------- */
function faceFor(p){
  if(!p.alive)return 7;
  if(p.anim==='win'||p.anim==='attack'||p.anim==='attackBig')return 6;
  if(p.anim==='shout'||p.anim==='bust')return 4;
  if(p.anim==='hurt'||p.anim==='collapse')return 5;
  if(p.anim==='revive')return 1;
  const t=p.hand.length?total(p):0;
  if(t>21)return 5;
  if(p.money<=10)return 3;
  if(t>=20)return 2;
  if(p.money>=80)return 1;
  return 0;
}

/* ---------- render ---------- */
function render(){
  P.forEach((p,i)=>{
    const seat=$('#seat'+i),t=p.hand.length?total(p):0;
    seat.classList.toggle('turn',!!p.turn);
    seat.classList.toggle('dead',!p.alive);
    seat.classList.toggle('bust',p.alive&&t>21);
    seat.querySelector('.cards').innerHTML=p.hand.map((c,n)=>miniCard(c,n===p.incoming?'incoming':'')).join('');
    seat.querySelector('.score').textContent=!p.alive?'☠':p.hand.length?(t>21?'BUST':t.toFixed(1)):'--';
    const face=seat.querySelector('.face'),src=`assets/face_${TYPE[i]}_${faceFor(p)}.png`;
    if(face.getAttribute('src')!==src)face.setAttribute('src',src);
    const m=seat.querySelector('.money'),mt=yen(p.money);
    if(m.dataset.v!==mt){const first=!m.dataset.v;m.dataset.v=mt;m.innerHTML=yenHTML(p.money);if(!first){m.classList.remove("flash");void m.offsetWidth;m.classList.add("flash")}}
    const a=$('#actor'+i);a.classList.toggle('dead',!p.alive);a.classList.toggle('turn',!!p.turn&&p.alive);
    const d1=p.alive&&p.money<=20&&p.money>10,d2=p.alive&&p.money<=10;
    seat.classList.toggle('danger1',d1);seat.classList.toggle('danger2',d2);a.classList.toggle('danger1',d1);a.classList.toggle('danger2',d2);
  });
  // current leader (highest valid hand) gets a pulsing score box
  const live=['deal','player','cpu','resolve'].includes(phase)?P.filter(p=>p.alive&&p.hand.length>=2&&total(p)<=21):[];
  const top=live.length?Math.max(...live.map(total)):-1;
  P.forEach((p,i)=>$('#seat'+i).classList.toggle('lead',live.includes(p)&&total(p)===top));
  const blue=P.filter(p=>p.team===0).reduce((n,p)=>n+p.money,0),red=P.filter(p=>p.team===1).reduce((n,p)=>n+p.money,0);
  const pct=blue/((blue+red)||1)*100;
  $('#teamBlue').style.width=pct+'%';$('#barMark').style.left=pct+'%';
  $('#teamBlueMoney').innerHTML=yenHTML(blue);$('#teamRedMoney').innerHTML=yenHTML(red);
  $('#round').textContent=round;
  $('#deckPile span').textContent=deck.length;
  const me=P[0];
  $('#handCards').innerHTML=me.hand.map((c,n)=>bigCard(c,n===me.incoming?'incoming':'')).join('');
  const tb=$('.totalBox'),mt=me.hand.length?total(me):0;
  tb.classList.toggle('ghost',!me.alive);tb.classList.toggle('bust',me.alive&&mt>21);
  $('#total').textContent=!me.alive?'GHOST':me.hand.length?mt.toFixed(1):'0.0';
  const r=$('#raise');r.disabled=!(phase==='raise'&&canRaise(0));r.classList.toggle('ready',!r.disabled);
  $('#raiseChoice').style.display=phase==='raise'?'flex':'none';
}
function say(t){const e=$('#message');e.textContent=t;e.classList.remove('pop');void e.offsetWidth;e.classList.add('pop')}
function callout(main,sub='',kind='',ms=1100){
  const e=$('#callout');e.querySelector('.coMain').textContent=main;e.querySelector('.coSub').textContent=sub;
  e.className='callout';void e.offsetWidth;e.style.setProperty('--co-dur',ms+'ms');e.className='callout show '+kind;
  return wait(ms);
}
function fx(text,kind='good'){const e=$('#fx');e.textContent=text;e.className='fx';void e.offsetWidth;e.className='fx show '+kind}

/* =========================================================
   VISUAL FX KIT (Mega Drive style: hard flashes, pixel blood, shake)
   ========================================================= */
const FX={
  layer(){return $('#motionLayer')},
  particles(x,y,o){
    const L=this.layer(),n=o.n||12;
    for(let k=0;k<n;k++){
      const e=document.createElement('i');e.className='pt';
      const s=Math.round((o.size||5)*rnd(.6,1.4));
      e.style.cssText=`left:${x+rnd(-(o.jx||0),o.jx||0)}px;top:${y+rnd(-(o.jy||0),o.jy||0)}px;width:${s}px;height:${s}px;background:${o.colors[k%o.colors.length]}`;
      L.appendChild(e);
      const ang=((o.angle??-90)+rnd(-.5,.5)*(o.spread??360))*Math.PI/180,sp=(o.speed||80)*rnd(.35,1.1);
      const dx=Math.cos(ang)*sp,dy=Math.sin(ang)*sp,g=o.gravity||0,d=(o.dur||600)*rnd(.7,1.3);
      const an=e.animate([
        {transform:'translate(0,0)',opacity:1},
        {transform:`translate(${dx*.65}px,${dy*.65+g*.2}px)`,opacity:1,offset:.45},
        {transform:`translate(${dx}px,${dy+g}px)`,opacity:0}
      ],{duration:d,easing:'cubic-bezier(.15,.7,.4,1)',delay:o.delay?rnd(0,o.delay):0,fill:'both'});
      an.onfinish=()=>e.remove();
    }
  },
  blood(x,y,dir,big){
    this.particles(x,y,{n:big?34:18,colors:['#c40d0d','#8a0000','#ff2a1a','#5a0000'],size:big?7:5,speed:big?150:100,angle:dir>0?-30:-150,spread:big?150:110,gravity:big?140:100,dur:big?900:700,jx:6,jy:10});
  },
  slash(x,y,big,dir=1){
    const L=this.layer(),angs=big?[-32,28]:[-32];
    angs.forEach((a,k)=>{
      const e=document.createElement('div');e.className='slash'+(big?' big':'');
      e.style.left=x+'px';e.style.top=y+'px';L.appendChild(e);
      const r=a*dir;
      e.animate([
        {transform:`translate(-50%,-50%) rotate(${r}deg) scaleX(0)`,opacity:1},
        {transform:`translate(-50%,-50%) rotate(${r}deg) scaleX(1)`,opacity:1,offset:.3},
        {transform:`translate(-50%,-50%) rotate(${r}deg) scaleX(1.08) scaleY(.15)`,opacity:0}
      ],{duration:big?420:320,delay:k*70,easing:'ease-out',fill:'both'}).onfinish=()=>e.remove();
    });
  },
  ring(x,y,color='#fff',size=120){
    const e=document.createElement('div');e.className='ring';e.style.cssText=`left:${x}px;top:${y}px;border-color:${color}`;this.layer().appendChild(e);
    e.animate([{width:'10px',height:'10px',opacity:1},{width:size+'px',height:size+'px',opacity:0}],{duration:360,easing:'ease-out'}).onfinish=()=>e.remove();
  },
  shake(power=6,dur=300){
    const a=$('#arena'),k=[],steps=Math.max(4,Math.round(dur/40));
    for(let i=0;i<=steps;i++){const f=(1-i/steps)*power;k.push({transform:i===steps?'none':`translate(${rnd(-f,f)}px,${rnd(-f,f)}px)`})}
    a.animate(k,{duration:dur,easing:'linear'});
  },
  flash(color='#fff',dur=140,peak=.75){
    $('#arenaFlash').animate([{background:color,opacity:peak},{background:color,opacity:0}],{duration:dur,easing:'ease-out'});
  },
  dim(on){$('#arenaDim').classList.toggle('on',!!on)},
  pillar(x,bottom,h=300,color='rgba(90,170,255,'){
    const e=document.createElement('div');e.className='pillar';
    e.style.cssText=`left:${x}px;top:${bottom-h}px;height:${h}px;background:linear-gradient(90deg,${color}0),${color}.85) 35%,rgba(235,248,255,.95) 50%,${color}.85) 65%,${color}0))`;
    this.layer().appendChild(e);
    e.animate([{transform:'translateX(-50%) scaleX(0)',opacity:0},{transform:'translateX(-50%) scaleX(1)',opacity:1,offset:.2},{transform:'translateX(-50%) scaleX(.8)',opacity:.9,offset:.7},{transform:'translateX(-50%) scaleX(0)',opacity:0}],{duration:1000,easing:'ease-out'}).onfinish=()=>e.remove();
  },
  smoke(x,y,colors=['#3b2f3f','#584a5c','#2a222c'],n=14){this.particles(x,y,{n,colors,size:12,speed:40,angle:-90,spread:120,gravity:-30,dur:900,jx:18,jy:8})},
  dust(x,y){this.particles(x,y,{n:16,colors:['#6b5a44','#8a7556','#4a3d2e'],size:6,speed:70,angle:-90,spread:170,gravity:40,dur:600,jx:30,jy:2})},
  ash(x,y){this.particles(x,y,{n:22,colors:['#9a948c','#6e6862','#c9c2b6','#3a3633'],size:4,speed:90,angle:-90,spread:60,gravity:-60,dur:1300,jx:30,jy:40,delay:300})},
  burst(x,y,size=260){
    const e=document.createElement('div');e.className='jkBurst';e.style.left=x+'px';e.style.top=y+'px';e.style.width=e.style.height=size+'px';
    this.layer().appendChild(e);
    e.animate([{transform:'translate(-50%,-50%) scale(.2) rotate(0deg)',opacity:0},{transform:'translate(-50%,-50%) scale(1) rotate(40deg)',opacity:1,offset:.2},
      {transform:'translate(-50%,-50%) scale(1.15) rotate(120deg)',opacity:.85,offset:.75},{transform:'translate(-50%,-50%) scale(1.3) rotate(160deg)',opacity:0}],
      {duration:1300,easing:'ease-out'}).onfinish=()=>e.remove();
  },
  sparks(x,y,colors=['#fff6c0','#ffd24a','#ff9a2a']){this.particles(x,y,{n:14,colors,size:4,speed:120,spread:360,gravity:30,dur:450})},
};

/* ---------- actor animation (CSS motion + optional sprite frames) ---------- */
function spriteFrames(i,a){const n=(STAGE_ANIM[TYPE[i]]||{})[a]||0;return n?Array.from({length:n},(_,k)=>`assets/stage_anim/${TYPE[i]}_${a}_${k}.png`):null}
function playFrames(i,a){
  const p=P[i],img=$('#actor'+i+' .body');clearInterval(p.frameT);
  let frames=spriteFrames(i,a)||spriteFrames(i,'idle');
  if(PINGPONG[a]&&frames.length>2)frames=frames.concat(frames.slice(1,-1).reverse());
  let k=0;img.setAttribute('src',frames[0]);
  if(frames.length<2)return;
  const t=session,step=1000/(STAGE_FPS[a]||STAGE_FPS.default);
  p.frameT=setInterval(()=>{
    if(t!==session){clearInterval(p.frameT);return}
    k++;
    if(k>=frames.length){if(LOOPING[a])k=0;else{clearInterval(p.frameT);return}}   // one-shots hold the last frame
    img.setAttribute('src',frames[k]);
  },step);
}
function setAnim(p,a,ms=480){
  const i=P.indexOf(p),el=$('#actor'+i);
  p.anim=a;clearTimeout(p.animT);
  ACTS.forEach(k=>el.classList.remove('act-'+k));void el.offsetWidth;el.classList.add('act-'+a);
  playFrames(i,a);
  render();
  if(a==='collapse')return;
  const t=session;
  p.animT=setTimeout(()=>{if(t!==session)return;el.classList.remove('act-'+a);if(p.anim===a){p.anim='idle';playFrames(i,'idle');render()}},ms);
}
function clearActs(i){const el=$('#actor'+i);ACTS.forEach(k=>el.classList.remove('act-'+k));if(P[i]){clearInterval(P[i].frameT);playFrames(i,P[i].alive?'idle':'skeleton')}}
const PRELOAD=[];
function preloadSprites(){
  TYPE.forEach(t=>Object.keys(STAGE_ANIM[t]).forEach(a=>{for(let k=0;k<STAGE_ANIM[t][a];k++){const im=new Image();im.src=`assets/stage_anim/${t}_${a}_${k}.png`;PRELOAD.push(im)}}));
  ['front','back','joker','suit_spade','suit_heart','suit_diamond','suit_club','emblem_J','emblem_Q','emblem_K'].forEach(n=>{const im=new Image();im.src=`assets/cards/${n}.png`;PRELOAD.push(im)});
}

/* ---------- motion layer ---------- */
function flyCard(i,c){
  render();
  const target=i===0?$('#handCards .card.incoming'):$(`#seat${i} .card.incoming`);
  const p=P[i];
  if(!target){p.incoming=null;render();return}
  const from=posOf($('#deckPile')),to=posOf(target);
  const e=document.createElement('div');e.className='flyCard';
  e.innerHTML=i===0?bigCard(c):miniCard(c);
  e.style.left=from.x+'px';e.style.top=from.y+'px';
  FX.layer().appendChild(e);
  requestAnimationFrame(()=>requestAnimationFrame(()=>{e.classList.add('go');e.style.left=to.x+'px';e.style.top=to.y+'px'}));
  later(()=>{e.remove();if(p.incoming===p.hand.length-1)p.incoming=null;render()},310);
}
function floatText(el,text,cls,dy=-20,delay=0){
  later(()=>{const q=posOf(el),f=document.createElement('div');f.className='payFloat '+cls;f.textContent=text;f.style.left=q.x+'px';f.style.top=(q.y+dy)+'px';FX.layer().appendChild(f);setTimeout(()=>f.remove(),950)},delay);
}
function moneyMotion(fromIdx,toIdx,amount){
  const fromEl=$(`#seat${fromIdx} .portrait`),toEl=$(`#seat${toIdx} .portrait`);
  floatText(fromEl,`-${yen(amount)}`,'minus',-10);
  const a=actorBox(fromIdx),b=posOf(toEl);
  for(let n=0;n<7;n++)later(()=>{
    const c=document.createElement('i');c.className='coinFly';
    c.style.left=(a.x+rnd(-14,14))+'px';c.style.top=(a.y+rnd(-20,10))+'px';FX.layer().appendChild(c);
    requestAnimationFrame(()=>requestAnimationFrame(()=>{c.style.left=(b.x+rnd(-6,6))+'px';c.style.top=b.y+'px'}));
    setTimeout(()=>{c.style.opacity='0';setTimeout(()=>c.remove(),140)},470);
  },120+n*45);
}

/* ---------- raise ---------- */
function teamRaiseUsed(team){return P.some(p=>p.team===team&&p.raiseUsed)}
function canRaise(team){const a=P.filter(p=>p.team===team&&p.alive),d=P.filter(p=>p.team===team&&!p.alive);return a.length===1&&d.length===1&&!teamRaiseUsed(team)}
async function doRaise(team){
  const a=P.find(p=>p.team===team&&p.alive),d=P.find(p=>p.team===team&&!p.alive);
  if(!a||!d||teamRaiseUsed(team))return false;
  a.raiseUsed=true;d.raiseUsed=true;
  const di=P.indexOf(d),ai=P.indexOf(a),token=session;
  // beat 1: silence and darkness
  say(team?'THE ENEMY CALLS A RAISE...':'YOU CALL A RAISE...');
  if(team===1)S.play('vo_roundwin_enemy');
  FX.dim(true);setAnim(a,'shout',900);
  await wait(TEMPO.beat);if(stale(token))return true;
  // beat 2: flash + shout + title
  FX.flash('#ffffff',320,.95);FX.shake(7,320);S.play('vo_raise');
  callout('RAISE!!',`${NAME[di]} RISES FROM THE BONES`,'raise',1900);
  await wait(650);if(stale(token))return true;
  // beat 3: the revival itself
  const tot=Math.round(a.money*10),rev=Math.floor(tot/2);
  a.money=(tot-rev)/10;d.money=rev/10;d.alive=true;d.hand=[];d.incoming=null;
  setAnim(d,'revive',1500);
  const box=actorBox(di);
  FX.flash('#6fb8ff',420,.6);FX.pillar(box.x,box.bottom+6,box.h*1.7);
  FX.particles(box.x,box.bottom-10,{n:30,colors:['#bfe6ff','#6fb8ff','#ffffff'],size:4,speed:170,angle:-90,spread:40,gravity:-40,dur:1200,jx:26,jy:6});
  floatText($(`#seat${di} .portrait`),`+${yen(d.money)}`,'plus',-10,250);
  floatText($(`#seat${ai} .portrait`),`-${yen(d.money)}`,'minus',-10,250);
  say(`RAISE!! ${NAME[di]} RETURNS WITH ${yen(d.money)}`);
  await wait(1500);if(stale(token))return true;
  FX.dim(false);
  return true;
}

/* ---------- controls ---------- */
const SURE_STAND=20.0;   // at/above this total STAND glows
function ctrl(on){
  const ok=!!on&&!actionLock&&!over&&!pending&&phase==='player'&&P[0].alive;$('#hit').disabled=!ok;$('#stand').disabled=!ok;
  const t=P[0]&&P[0].hand.length?total(P[0]):0;
  $('#stand').classList.toggle('sure',ok&&t>=SURE_STAND&&t<=21);
}
function showJoker(cardObj,onDone){
  pending={card:cardObj,onDone};ctrl(false);
  const me=P[0];bestJ(me,cardObj);const best=cardObj.j;cardObj.j=null;render();
  $('#joker').classList.remove('hidden');
  const box=$('#jokerButtons');box.innerHTML='';
  for(let v=0;v<=10;v++){
    const b=document.createElement('button');b.type='button';b.textContent=v;
    cardObj.j=v;const tv=total(me);cardObj.j=null;
    if(tv>21)b.classList.add('over');else if(tv===21)b.classList.add('perfect');else if(v===best)b.classList.add('best');
    b.title=tv.toFixed(1);
    b.onclick=()=>{if(!pending||phase==='gameover')return;click();pending.card.j=v;const done=pending.onDone;pending=null;$('#joker').classList.add('hidden');render();done&&done()};
    box.appendChild(b);
  }
  say('JOKER! CHOOSE ITS VALUE');
}
// JOKER drawn: "it's here!" moment — sound, purple/gold flash, light burst on the card, callout
function jokerFx(i){
  const token=session;
  later(()=>{
    if(stale(token))return;
    S.play('se_joker');
    FX.flash('#d6a0ff',260,.7);later(()=>FX.flash('#ffe27a',220,.55),180);FX.shake(5,300);
    const card=i===0?$('#handCards .card.jkc:last-child'):$(`#seat${i} .card.jkc:last-child`);
    if(card){const q=posOf(card);FX.burst(q.x,q.y,i===0?280:200);
      FX.particles(q.x,q.y,{n:30,colors:['#fff6c0','#ffd24a','#e0b0ff','#ffffff'],size:5,speed:150,spread:360,gravity:20,dur:900})}
    callout('JOKER!!',i===0?'A WILD CARD — NAME YOUR NUMBER':`${NAME[i]} DRAWS THE JOKER`,'joker',TEMPO.jokerCall);
  },320);
}
function draw(p,human=false,onDone=null,delay=TEMPO.hit){
  if(!deck.length)deck=newDeck();
  const c=deck.pop();p.hand.push(c);p.incoming=p.hand.length-1;
  const i=P.indexOf(p);
  if(c.r==='JOKER'&&!human)bestJ(p,c);
  S.play('se_card',{rate:rnd(.96,1.04)});
  setAnim(p,'draw',450);flyCard(i,c);
  if(c.r==='JOKER')jokerFx(i);
  if(c.r==='JOKER'&&human){later(()=>showJoker(c,onDone),320+TEMPO.jokerCall*.8);return false}
  if(c.r==='JOKER')delay+=TEMPO.jokerCall;
  if(onDone)later(onDone,delay);
  return true;
}
function bustFx(p){
  const i=P.indexOf(p),b=actorBox(i);
  setAnim(p,'bust',700);voice('bust',p.team);
  FX.smoke(b.x,b.top+b.h*.25);FX.flash('#4a1060',180,.35);FX.shake(4,220);
}

/* ---------- round flow ---------- */
function startRound(){
  if(over)return;clearTimeout(timer);actionLock=false;phase='deal';pending=null;
  deck=newDeck();
  P.forEach((p,i)=>{p.hand=[];p.incoming=null;p.turn=false;p.anim='idle';clearTimeout(p.animT);clearActs(i)});
  ctrl(false);render();say(`ROUND ${round}`);
  const q=[];for(let n=0;n<2;n++)for(let i=0;i<4;i++)if(P[i].alive)q.push(i);
  const token=session;
  const next=()=>{if(stale(token))return;if(!q.length){render();later(beginPlayerPhase,TEMPO.beat);return}const i=q.shift();draw(P[i],i===0,()=>later(next,TEMPO.deal),150)};
  (async()=>{
    await wait(TEMPO.beat);if(stale(token))return;
    S.play('se_round_start');FX.flash('#ffffff',300,.9);FX.shake(5,260);
    callout(`ROUND ${round}`,round===1?'LET THE BLOOD FLOW':'THE DEAD DEAL AGAIN','rnd',TEMPO.roundCall);
    await wait(TEMPO.roundCall);if(stale(token))return;
    say(`ROUND ${round} — DEALING...`);later(next,120);
  })();
}
function beginPlayerPhase(){
  phase='player';P.forEach(p=>p.turn=false);P[0].turn=P[0].alive;render();
  if(!P[0].alive){ctrl(false);say('YOU ARE BONES... ALLY FIGHTS ON');callout('YOU ARE BONES','YOUR ALLY FIGHTS ON','',TEMPO.turnCall);later(autoPlay,TEMPO.turnCall);return}
  const t=total(P[0]);
  if(t>21){ctrl(false);bustFx(P[0]);say(`YOU ${t.toFixed(1)} — BUST!`);fx('BUST!','bad');later(autoPlay,TEMPO.bust);return}
  ctrl(false);setAnim(P[0],'turn',600);say(`YOUR TURN — ${t.toFixed(1)} — HIT OR STAND`);
  S.play('se_turn_ally');callout('YOUR TURN',`${t.toFixed(1)} — HIT OR STAND`,'ally',TEMPO.turnCall);
  later(()=>{if(phase==='player'&&!over)ctrl(true)},Math.round(TEMPO.turnCall*.55));
}
async function aiPlay(p,token){
  const i=P.indexOf(p);let g=0;
  while(total(p)<18.2&&g++<8){
    await wait(TEMPO.cpuThink);if(stale(token)||phase!=='cpu')return false;
    const gotJ=!draw(p,false)||p.hand[p.hand.length-1].r==='JOKER';say(`${NAME[i]} — HIT!`);
    await wait(TEMPO.cpuDraw+(gotJ?TEMPO.jokerCall:0));if(stale(token)||phase!=='cpu')return false;
    const t=total(p);
    if(t>21){bustFx(p);say(`${NAME[i]} ${t.toFixed(1)} — BUST!`);await wait(TEMPO.bust);return !(stale(token)||phase!=='cpu')}
    if(t>=20){await wait(TEMPO.near21);if(stale(token)||phase!=='cpu')return false}
  }
  setAnim(p,'discard',420);say(`${NAME[i]} — STAND ${total(p).toFixed(1)}`);
  await wait(TEMPO.cpuThink);
  return !(stale(token)||phase!=='cpu');
}
async function autoPlay(){
  if(over||phase==='cpu'||phase==='resolve'||phase==='gameover')return;
  const token=session;phase='cpu';ctrl(false);P.forEach(p=>p.turn=false);render();
  for(let i=1;i<4;i++)if(P[i].alive){
    P[i].turn=true;say(`${NAME[i]}'S TURN`);setAnim(P[i],'turn',600);render();
    S.play(P[i].team?'se_turn_enemy':'se_turn_ally');
    await callout(`${NAME[i]}'S TURN`,P[i].team?'THE ENEMY MOVES':'YOUR ALLY MOVES',P[i].team?'enemy':'ally',TEMPO.turnCall);
    if(stale(token)||phase!=='cpu')return;
    if(!(await aiPlay(P[i],token)))return;
    P[i].turn=false;render();await wait(120);if(stale(token)||phase!=='cpu')return;
  }
  if(!stale(token))resolve();
}
async function resolve(){
  const token=session,ok=()=>!(stale(token)||phase!=='resolve');
  phase='resolve';ctrl(false);P.forEach(p=>p.turn=false);render();
  await wait(TEMPO.beat);if(!ok())return;
  const valid=P.filter(p=>p.alive&&total(p)<=21);
  if(!valid.length){say('ALL BUST — NO CONTEST');fx('NO CONTEST','neutral');return holdNeutralRound(token)}
  const hi=Math.max(...valid.map(total)),w=valid.filter(p=>total(p)===hi);
  if(w.length!==1){say(`${hi.toFixed(1)} TIE — NO BLOOD SPILLED`);fx('DRAW','neutral');return holdNeutralRound(token)}
  const win=w[0],winIdx=P.indexOf(win),enemies=P.filter(p=>p.alive&&p.team!==win.team),big=hi>=BIG_HIT;

  // 1) winner declared: the winner freezes and shines (with se_win_flash), everyone else darkens
  $('#seat'+winIdx).classList.add('win');
  const wa=$('#actor'+winIdx);
  P.forEach((p,i)=>{if(i!==winIdx)$('#actor'+i).classList.add('shade')});
  setAnim(win,'win',TEMPO.winFreeze+TEMPO.winPose);clearInterval(win.frameT);   // hold the pose (freeze)
  wa.classList.add('winFreeze');
  S.play('se_win_flash');FX.flash('#fff6d0',160,.45);
  {const b=actorBox(winIdx);FX.burst(b.x,b.top+b.h*.45,240);FX.sparks(b.x,b.top+b.h*.45)}
  const bj=hi===21;
  if(bj){callout('BLACKJACK!!','DAMAGE ×2','bj',TEMPO.winFreeze+500);say(`${NAME[winIdx]} — BLACKJACK!! DAMAGE ×2`)}
  else{say(`${NAME[winIdx]} ${winIdx===0?'WIN':'WINS'} WITH ${hi.toFixed(1)}`);fx(`${hi.toFixed(1)} WIN!`,'good')}
  await wait(TEMPO.winFreeze+(bj?300:0));if(!ok())return;
  wa.classList.remove('winFreeze');P.forEach((p,i)=>$('#actor'+i).classList.remove('shade'));
  if(win.team===1)S.play('vo_roundwin_enemy');
  await wait(TEMPO.winPose);if(!ok())return;

  // 2) losers brace, winner attacks
  for(const e of enemies)setAnim(e,'shout',420);
  await wait(TEMPO.loserReact);if(!ok())return;
  if(big)FX.dim(true);
  setAnim(win,big?'attackBig':'attack',big?720:560);
  await wait(big?300:210);if(!ok())return;

  // 3) impact
  let gainT=0;const deaths=[],hurt=[];
  for(const e of enemies){
    const eBust=total(e)>21,mult=(bj?BJ_MULT:1)*(eBust?BUST_MULT:1);
    if(eBust)floatText($(`#seat${P.indexOf(e)} .score`),`BUST ×${BUST_MULT}`,'minus',-26,80);
    const due=Math.round(hi*10)*mult,have=Math.round(e.money*10),payT=Math.min(have,due),ei=P.indexOf(e),b=actorBox(ei),dir=e.team===0?-1:1;
    FX.slash(b.x,b.top+b.h*.38,big,win.team===0?1:-1);
    FX.blood(b.x,b.top+b.h*.38,dir,big||have-payT<=0);
    FX.sparks(b.x,b.top+b.h*.38);
    if(big)FX.ring(b.x,b.top+b.h*.4,'#fff',160);
    moneyMotion(ei,winIdx,payT/10);
    e.money=(have-payT)/10;gainT+=payT;
    if(e.money<=0){e.money=0;deaths.push(e);setAnim(e,'hurt',900)}else{hurt.push(e);setAnim(e,'hurt',640)}
  }
  S.play('se_money');
  if(hurt.length)voice('hurt',hurt[0].team);
  FX.flash(big?'#ffffff':'#ffe6e6',big?200:120,big?.8:.5);FX.shake(big?11:6,big?460:300);
  const gain=gainT/10;render();
  floatText($(`#seat${winIdx} .portrait`),`+${yen(gain)}`,'plus',-10,420);
  await wait(TEMPO.money);if(!ok())return;
  FX.dim(false);P.forEach((p,i)=>$('#actor'+i).classList.remove('shade'));
  win.money=Math.round((win.money+gain)*10)/10;say(`${NAME[winIdx]} +${yen(gain)}`);render();

  // 4) deaths: collapse → bones
  if(deaths.length){
    await wait(TEMPO.deathHold);if(!ok())return;
    voice('dead',deaths[0].team);
    FX.flash('#a00000',320,.55);FX.shake(9,420);
    for(const e of deaths){const ei=P.indexOf(e),b=actorBox(ei);setAnim(e,'collapse');FX.blood(b.x,b.top+b.h*.45,e.team===0?-1:1,true);FX.ash(b.x,b.top+b.h*.5)}
    fx('BROKE!','bad');say(`${deaths.map(e=>NAME[P.indexOf(e)]).join(' & ')} — BROKE... TURNED TO BONES`);
    await wait(TEMPO.collapse);if(!ok())return;
    for(const e of deaths){
      const ei=P.indexOf(e);e.alive=false;e.anim='idle';clearActs(ei);
      const el=$('#actor'+ei);el.classList.add('act-boneDrop');setTimeout(()=>el.classList.remove('act-boneDrop'),520);
    }
    render();
    for(const e of deaths){const b=actorBox(P.indexOf(e));FX.dust(b.x,b.bottom-2)}
    FX.shake(4,180);
  }
  timer=later(after,TEMPO.postRound);
}
async function holdNeutralRound(token){P.forEach(p=>p.turn=false);render();await wait(1400);if(stale(token)||phase!=='resolve')return;next()}
async function after(){
  document.querySelectorAll('.seat.win').forEach(s=>s.classList.remove('win'));
  for(const t of [0,1])if(!P.some(p=>p.team===t&&p.alive)){
    over=true;phase='gameover';ctrl(false);const victory=t===1;
    S.play('vo_team_win');
    say(victory?'YOUR TEAM STANDS VICTORIOUS':'YOUR TEAM FALLS...');fx(victory?'VICTORY!':'DEFEAT',victory?'good':'bad');
    FX.flash(victory?'#fff2b0':'#600000',500,.6);
    render();
    setTimeout(()=>showGameOver(victory),2200);return;
  }
  const token=session;
  if(canRaise(1)){await doRaise(1);if(stale(token))return;await wait(TEMPO.raise);if(stale(token))return}
  if(canRaise(0)){phase='raise';ctrl(false);say('RAISE CHANCE — REVIVE YOUR ALLY?');render();return}
  next();
}
function next(){
  P.forEach((p,i)=>$('#actor'+i).classList.remove('shade','winFreeze'));
  document.querySelectorAll('.seat.win').forEach(s=>s.classList.remove('win'));
  P.forEach(p=>p.turn=false);render();timer=later(()=>{if(!over){round++;startRound()}},TEMPO.postRound);
}

/* ---------- player actions ---------- */
function hitAction(){
  const p=P[0];if(over||pending||actionLock||!p.alive||phase!=='player')return;
  click();actionLock=true;ctrl(false);
  draw(p,true,()=>{
    actionLock=false;render();const t=total(p);
    if(t>21){bustFx(p);say(`YOU ${t.toFixed(1)} — BUST!`);fx('BUST!','bad');P[0].turn=false;later(autoPlay,TEMPO.bust)}
    else{ctrl(true);say(t===21?'21.0!! — STAND AND FIGHT':`YOU ${t.toFixed(1)} — HIT OR STAND?`)}
  });
}
function standAction(){
  if(over||pending||actionLock||phase!=='player'||!P[0].alive)return;
  click();actionLock=true;ctrl(false);setAnim(P[0],'discard',420);say(`YOU — STAND ${total(P[0]).toFixed(1)}`);P[0].turn=false;
  later(autoPlay,TEMPO.beat);
}
async function raiseAction(){if(phase==='raise'&&canRaise(0)){click();phase='resolve';render();const t=session;await doRaise(0);if(t===session&&!over)timer=later(next,TEMPO.raise)}}
function skipRaiseAction(){if(phase==='raise'){click();phase='resolve';say('RAISE HELD FOR LATER');render();next()}}

$('#hit').onclick=hitAction;$('#stand').onclick=standAction;$('#raise').onclick=raiseAction;$('#skipRaise').onclick=skipRaiseAction;
$('#restart').onclick=()=>{if(document.body.classList.contains('titleDone')){click();reset()}};
const muteBtn=$('#mute');
function paintMute(){muteBtn.textContent=S.muted?'♪ OFF':'♪ ON';muteBtn.classList.toggle('off',S.muted)}
muteBtn.addEventListener('pointerdown',e=>e.stopPropagation());
muteBtn.onclick=e=>{e.stopPropagation();S.unlock();S.setMuted(!S.muted);paintMute();if(!S.muted)click()};
paintMute();
window.addEventListener('keydown',e=>{
  if(!document.body.classList.contains('titleDone')||over)return;
  if(e.key==='m'||e.key==='M'){muteBtn.click();return}
  if(pending){
    const v=/^[0-9]$/.test(e.key)?+e.key:(e.key==='-'?10:null);
    if(v!==null){e.preventDefault();const b=$('#jokerButtons').children[v];if(b)b.click()}
    return;
  }
  const k=e.key.toLowerCase();
  if(phase==='player'&&(k==='h'||e.key==='ArrowUp')){e.preventDefault();hitAction()}
  else if(phase==='player'&&(k==='s'||e.key==='Enter'||e.key==='ArrowDown')){e.preventDefault();standAction()}
  else if(phase==='raise'&&(k==='r'||e.key==='Enter')){e.preventDefault();raiseAction()}
  else if(phase==='raise'&&(e.key==='Escape'||e.key==='Backspace')){e.preventDefault();skipRaiseAction()}
});

/* ---------- game over / reset / title ---------- */
function showGameOver(victory){
  const g=$('#gameOver');g.classList.remove('hidden');g.classList.toggle('victory',victory);
  $('#gameOverTitle').textContent=victory?'VICTORY':'GAME OVER';
  $('#gameOverSub').textContent=victory?`ROUND ${round} — THE ENEMY IS BONES`:`ROUND ${round} — YOUR TEAM IS BONES`;
  $('#gameOverStats').innerHTML=P.map((p,i)=>`<span class="${p.team?'enemy':'ally'} ${p.alive?'':'dead'}">${p.alive?'':'☠ '}${NAME[i]}</span><span class="v ${p.alive?'':'dead'}">${yenHTML(p.money)}</span>`).join('');
}
function reset(){
  session++;clearTimeout(timer);actionLock=false;pending=null;
  FX.layer().innerHTML='';FX.dim(false);$('#callout').className='callout';$('#gameOver').classList.add('hidden');$('#joker').classList.add('hidden');
  P.forEach(p=>{clearTimeout(p.animT);clearInterval(p.frameT)});
  P=NAME.map((name,i)=>({name,team:i<2?0:1,money:50,alive:true,hand:[],incoming:null,raiseUsed:false,anim:'idle',animT:null,frameT:null,turn:false}));
  P.forEach((p,i)=>clearActs(i));
  round=1;over=false;phase='idle';
  S.playBgm('bgm_game',true);
  startRound();
}
/* Title: BGM should play from the first frame. Browsers only allow sound after a user gesture,
   so we try at load; if audio is still blocked a black "TOUCH TO BEGIN" boot screen takes that first tap. */
let titleReady=false;
function showTitleWithMusic(){S.unlock();S.playBgm('bgm_title',false);titleReady=true}
function bootTap(e){
  const b=$('#boot');if(!b||b.classList.contains('hidden'))return;
  b.classList.add('hidden');showTitleWithMusic();
}
function titleInput(e){
  const t=$('#titleScreen');if(!t||t.classList.contains('exit'))return;
  if(!$('#boot').classList.contains('hidden'))return;
  if(!titleReady){showTitleWithMusic();return}
  click();t.classList.add('exit');
  setTimeout(()=>{t.remove();document.body.classList.add('titleDone');reset()},450);
}
$('#again').onclick=()=>{click();reset()};$('#backTitle').onclick=()=>location.reload();
const title=$('#titleScreen');
if(title){
  S.unlock();S.playBgm('bgm_title',false);      // works where autoplay is allowed
  setTimeout(()=>{if(S.state==='running')titleReady=true;else $('#boot').classList.remove('hidden')},250);
  $('#boot').addEventListener('click',bootTap);
  title.addEventListener('click',titleInput);
  window.addEventListener('keydown',e=>{if(document.body.classList.contains('titleDone'))return;if(!$('#boot').classList.contains('hidden'))bootTap(e);else titleInput(e)});
}
else{document.body.classList.add('titleDone');reset()}
preloadSprites();

// debug hook for automated checks
window.__DDJ={get P(){return P},get phase(){return phase},get round(){return round},raiseTest(t){const d=P.find(p=>p.team===t&&p!==P[t?2:0]);d.alive=false;d.money=0;render();return doRaise(t)},forceJoker(){deck.push({r:'JOKER',s:'★',d:.3,j:null})},FX};
})();
