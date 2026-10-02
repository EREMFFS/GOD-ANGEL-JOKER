/* =========================================================
   DARK DHETH JOKER — Sound (Web Audio)
   - http(s): loads assets/sound/*.mp3
   - file://  : fetch is blocked, so assets/sound/sound_data.js (base64) is loaded instead
   - bgm_game loops sample-exact (loop points corrected for MP3 encoder delay)
   ========================================================= */
window.Sound=(()=>{
  'use strict';
  const VOL={master:1.0,bgm:0.70,se:0.90,voice:1.0};
  // original WAV length / first sample above 0.05 (used to verify the decoded loop alignment)
  const LOOP={bgm_game:{len:5436591,onset:148,sr:44100}};
  const FILES=['bgm_title','se_button','se_card','se_money','se_round_start','se_win_flash','se_joker','se_turn_ally','se_turn_enemy','vo_bust_ally','vo_bust_enemy','vo_dead_ally','vo_dead_enemy','vo_hurt_ally','vo_hurt_enemy','vo_roundwin_enemy','vo_raise','vo_team_win','bgm_game'];
  let ctx=null,master,bgmBus,seBus,voBus,loading=null,buffers={},useData=location.protocol==='file:';
  let bgm=null,want=null,muted=false;
  try{muted=localStorage.getItem('ddj_muted')==='1'}catch(e){}

  function b64ToBuf(s){const bin=atob(s),u=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);return u.buffer}
  function decode(ab){return new Promise((res,rej)=>{const p=ctx.decodeAudioData(ab,res,rej);if(p&&p.then)p.then(res,rej)})}
  function loadDataScript(){
    if(window.DDJ_SOUND_DATA)return Promise.resolve();
    return new Promise((res,rej)=>{const s=document.createElement('script');s.src='assets/sound/sound_data.js';s.onload=res;s.onerror=rej;document.head.appendChild(s)});
  }
  async function loadOne(n){
    let ab=null;
    if(!useData){try{const r=await fetch(`assets/sound/${n}.mp3`);if(!r.ok)throw 0;ab=await r.arrayBuffer()}catch(e){useData=true}}
    if(!ab){await loadDataScript();ab=b64ToBuf(window.DDJ_SOUND_DATA[n])}
    buffers[n]=await decode(ab);
    if(want&&want.name===n)startBgm(want.name,want.loop);
  }
  async function loadAll(){
    await loadOne('bgm_title').catch(()=>{});            // title first so it starts ASAP
    await Promise.all(FILES.slice(1).map(n=>loadOne(n).catch(()=>{})));
  }

  /* iPhone silent switch: Web Audio is muted by the ringer switch unless the page is a "playback" app.
     1) navigator.audioSession.type='playback' (iOS 16.4+/17 Safari)
     2) fallback: a looping silent <audio> element started in the user gesture switches the session to playback. */
  const SILENT='data:audio/wav;base64,UklGRsQPAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YaAPAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA';
  let keeper=null;
  function forcePlayback(){
    try{if(navigator.audioSession&&navigator.audioSession.type!=='playback')navigator.audioSession.type='playback'}catch(e){}
    try{
      if(!keeper){keeper=new Audio(SILENT);keeper.loop=true;keeper.preload='auto';keeper.setAttribute('playsinline','');keeper.setAttribute('x-webkit-airplay','deny')}
      if(keeper.paused){const p=keeper.play();if(p&&p.catch)p.catch(()=>{})}
    }catch(e){}
  }
  function unlock(){
    forcePlayback();
    if(!ctx){
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return Promise.resolve();
      ctx=new AC();
      master=ctx.createGain();master.gain.value=muted?0:VOL.master;master.connect(ctx.destination);
      bgmBus=ctx.createGain();bgmBus.gain.value=VOL.bgm;bgmBus.connect(master);
      seBus=ctx.createGain();seBus.gain.value=VOL.se;seBus.connect(master);
      voBus=ctx.createGain();voBus.gain.value=VOL.voice;voBus.connect(master);
      // iOS: play a silent buffer inside the gesture
      const s=ctx.createBufferSource();s.buffer=ctx.createBuffer(1,1,22050);s.connect(master);s.start(0);
      loading=loadAll();
    }
    if(ctx.state==='suspended'){ctx.resume();const s=ctx.createBufferSource();s.buffer=ctx.createBuffer(1,1,22050);s.connect(master);s.start(0)}
    return loading;
  }

  /* loop points: if the decoder left MP3 padding in, find it by comparing the first strong sample */
  function loopPoints(n,buf){
    const L=LOOP[n],sr=buf.sampleRate;if(!L)return[0,buf.duration];
    const ratio=sr/L.sr,d=buf.getChannelData(0);let on=0;const lim=Math.min(d.length,20000);
    while(on<lim&&Math.abs(d[on])<=0.05)on++;
    let delay=on-L.onset*ratio;if(Math.abs(delay)<8)delay=0;
    const start=Math.max(0,delay)/sr,end=Math.min(buf.duration,start+L.len/L.sr);
    return[start,end];
  }
  function startBgm(name,loop){
    const buf=buffers[name];if(!buf||!ctx)return;
    stopBgm(0.05);
    const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=buf;src.connect(g);g.connect(bgmBus);
    let offset=0;
    if(loop){const[a,b]=loopPoints(name,buf);src.loop=true;src.loopStart=a;src.loopEnd=b;offset=a}
    src.start(0,offset);bgm={src,g,name};want=null;
    src.onended=()=>{if(bgm&&bgm.src===src)bgm=null};
  }
  function stopBgm(fade=0.4){
    if(!bgm||!ctx)return;const{src,g}=bgm,t=ctx.currentTime;bgm=null;
    g.gain.setValueAtTime(g.gain.value,t);g.gain.linearRampToValueAtTime(0,t+fade);try{src.stop(t+fade+0.02)}catch(e){}
  }
  function playBgm(name,loop=false){
    want={name,loop};
    if(!ctx)return;
    if(bgm&&bgm.name===name)return;
    if(buffers[name])startBgm(name,loop);else stopBgm(0.3);
  }
  function play(name,{vol=1,rate=1}={}){
    if(!ctx||muted)return;const buf=buffers[name];if(!buf)return;
    const src=ctx.createBufferSource(),g=ctx.createGain();src.buffer=buf;src.playbackRate.value=rate;g.gain.value=vol;
    src.connect(g);g.connect(name.startsWith('vo_')?voBus:seBus);src.start(0);
    return src;
  }
  function setMuted(m){
    muted=!!m;try{localStorage.setItem('ddj_muted',muted?'1':'0')}catch(e){}
    if(master&&ctx){const t=ctx.currentTime;master.gain.cancelScheduledValues(t);master.gain.setTargetAtTime(muted?0:VOL.master,t,0.03)}
    return muted;
  }
  document.addEventListener('visibilitychange',()=>{if(!ctx)return;if(document.hidden){ctx.suspend();if(keeper)keeper.pause()}else{ctx.resume();forcePlayback()}});
  // any tap re-asserts playback mode (iOS may drop it after interruptions)
  window.addEventListener('pointerdown',()=>{if(ctx){forcePlayback();if(ctx.state!=='running')ctx.resume()}},{passive:true});

  return{unlock,play,playBgm,stopBgm,setMuted,get state(){return ctx?ctx.state:'none'},get muted(){return muted},get ready(){return !!buffers.bgm_game},VOL};
})();
