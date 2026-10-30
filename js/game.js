import * as THREE from 'three';
import {createWorld} from './world.js';
import {Net} from './net.js';
import {Actor,itemMesh,loadKits,makeBuggy,makeChest} from './entities.js';

const $=id=>document.getElementById(id);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const now=()=>performance.now()/1000;
const TYPES=['bear','wolf','deer','boar'];
const COL=[0x3a6ea5,0xc0392b,0x27ae60,0xf1c40f];

// ======================= DONNÉES =======================
const ITEMS={
  fist:{name:'Poings',dmg:6,range:2.4,cd:.45,h:{tree:8,rock:2,iron:0}},
  pickaxe:{name:'Pioche',dmg:14,range:2.7,cd:.5,h:{tree:15,rock:35,iron:25}},
  bat:{name:'Batte',dmg:20,range:2.6,cd:.5,h:{tree:12,rock:3,iron:0}},
  spear:{name:'Lance',dmg:24,range:3.8,cd:.65,h:{tree:8,rock:5,iron:0}},
  iron_pickaxe:{name:'Pioche en fer',dmg:24,range:2.8,cd:.45,h:{tree:25,rock:60,iron:50}},
  iron_spear:{name:'Lance en fer',dmg:40,range:4,cd:.6,h:{tree:12,rock:8,iron:0}},
  steel_sword:{name:'Épée en acier',dmg:58,range:3,cd:.45,h:{tree:20,rock:10,iron:0}},
  bow:{name:'Arc',dmg:32,range:70,cd:.9,ranged:true},
  rifle:{name:'Fusil',dmg:45,range:130,cd:.45,ranged:true},
};
const ORDER=['fist','pickaxe','bat','spear','iron_pickaxe','iron_spear','steel_sword','bow','rifle'];
const RECIPES=[
  {id:'table',name:'Établi (se pose devant vous)',cost:{wood:10,stone:4},free:true},
  {id:'pickaxe',cost:{wood:5,stone:3},free:true},
  {id:'bat',cost:{wood:8},free:true},
  {id:'spear',cost:{wood:6,stone:4},free:true},
  {id:'bow',cost:{wood:12}},
  {id:'steel',name:'Acier ×1',cost:{iron:2,wood:2}},
  {id:'iron_pickaxe',cost:{iron:4,wood:3}},
  {id:'iron_spear',cost:{iron:5,wood:3}},
  {id:'steel_sword',cost:{steel:4,wood:2}},
  {id:'rifle',cost:{steel:6,iron:4}},
  {id:'buggy',name:'Buggy (2 places)',cost:{wood:15,iron:8,steel:2}},
];
const RES_LABEL={wood:'Bois',stone:'Pierre',iron:'Fer',steel:'Acier',meat:'Viande'};
const PIECES={floor:['Sol',6],wall:['Mur',4],door:['Porte',4],roof:['Toit',5]};
const PKEYS=['floor','wall','door','roof'];
const MODES={
  coop:{name:'Survie coop',pvp:false,animals:true,arena:false},
  team:{name:'Équipe vs bots IA',pvp:false,animals:false,arena:true,bots:true,goal:20},
  duel:{name:'Duel 1v1',pvp:true,animals:false,arena:true,goal:5},
  treasure:{name:'1v1 Chasse au trésor',pvp:true,animals:true,arena:false,treasure:true},
};
const AN={
  bear:{hp:140,spd:5.2,wspd:1.4,det:24,dmg:22,hostile:1},
  wolf:{hp:60,spd:7.5,wspd:2,det:30,dmg:9,hostile:1},
  deer:{hp:40,spd:9,wspd:1.5,flee:1},
  boar:{hp:70,spd:6,wspd:1.3,dmg:12},
};
const ANR={bear:1.2,wolf:.75,deer:.8,boar:.75};

// ======================= RENDU =======================
const cv=$('c');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;
const scene=new THREE.Scene();
const HAZE=0xf0d2ad;
scene.background=new THREE.Color(HAZE);
scene.fog=new THREE.Fog(HAZE,140,820);
const camera=new THREE.PerspectiveCamera(75,1,.1,1500);
camera.rotation.order='YXZ';
scene.add(camera);
// lumière de fin de journée : soleil bas et doré, ciel bleu, sol vert chaud
scene.add(new THREE.HemisphereLight(0xdcebff,0x6a7a42,1.8));
const sun=new THREE.DirectionalLight(0xffc98f,2.6);sun.position.set(170,70,-120);scene.add(sun);
// ombres longues du soleil bas ; la zone d'ombre suit la caméra (voir frame())
const SUN_DIR=sun.position.clone().normalize();
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
Object.assign(sun.shadow.camera,{left:-110,right:110,top:110,bottom:-110,near:1,far:700});
sun.shadow.bias=-.0004;sun.shadow.normalBias=.6;scene.add(sun.target);
// qualité graphique : choisie dans le menu, mémorisée, et abaissée automatiquement si le jeu rame
const QUAL={high:{pr:1.5,sh:2048,name:'Élevés'},medium:{pr:1,sh:1024,name:'Moyens'},low:{pr:.75,sh:0,name:'Bas'}};
let quality='medium';const perf={t:0,n:0,warm:8,slow:0};
try{const q=localStorage.getItem('quality');if(QUAL[q])quality=q}catch(e){}
function applyQuality(q){
  quality=q;const Q=QUAL[q];
  renderer.setPixelRatio(Math.min(devicePixelRatio,Q.pr));
  renderer.shadowMap.enabled=sun.castShadow=Q.sh>0;
  if(Q.sh){sun.shadow.mapSize.set(Q.sh,Q.sh);if(sun.shadow.map){sun.shadow.map.dispose();sun.shadow.map=null}}
  scene.traverse(o=>{if(o.material)for(const m of[].concat(o.material))m.needsUpdate=true});
  try{localStorage.setItem('quality',q)}catch(e){}
  perf.warm=8;perf.t=perf.n=perf.slow=0;
  const s=document.getElementById('quality');if(s)s.value=q;
}
applyQuality(quality);
document.getElementById('quality').addEventListener('change',e=>applyQuality(e.target.value));
// les shaders se compilent après chaque changement (quelques secondes figées) : on attend 8 s avant de mesurer,
// et on ne baisse la qualité qu'après deux mesures lentes de suite
function autoQuality(dt){
  if(perf.warm>0){perf.warm-=dt;return}
  perf.t+=dt;perf.n++;
  if(perf.t<5)return;
  const fps=perf.n/perf.t;perf.t=perf.n=0;
  perf.slow=fps<22?perf.slow+1:0;
  if(perf.slow>=2&&quality!=='low'){perf.slow=0;applyQuality(quality==='high'?'medium':'low');showBanner('Graphismes abaissés à « '+QUAL[quality].name+' » pour plus de fluidité',2500)}
}
// ciel : dégradé zénith bleu -> horizon pêche, halo autour du soleil
const sky=new THREE.Mesh(new THREE.SphereGeometry(1200,32,16),new THREE.ShaderMaterial({
  side:THREE.BackSide,depthWrite:false,fog:false,
  uniforms:{sunDir:{value:sun.position.clone().normalize()}},
  vertexShader:'varying vec3 vP;void main(){vP=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec3 vP;uniform vec3 sunDir;void main(){float h=clamp(vP.y,0.,1.);vec3 top=vec3(.12,.3,.66),mid=vec3(.5,.7,.92),hor=vec3(1.,.8,.6);vec3 c=mix(hor,mid,smoothstep(0.,.22,h));c=mix(c,top,smoothstep(.18,.85,h));float s=max(dot(vP,sunDir),0.);c+=vec3(1.,.66,.3)*pow(s,5.)*.55+vec3(1.,.92,.75)*pow(s,300.)*3.;c=pow(c,vec3(2.2));gl_FragColor=vec4(c,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
}));
sky.renderOrder=-10;scene.add(sky);
// nuages : grands voiles doux autour de l'horizon
{
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  const g=x.createRadialGradient(64,64,4,64,64,62);g.addColorStop(0,'rgba(255,240,225,.9)');g.addColorStop(.5,'rgba(255,225,200,.35)');g.addColorStop(1,'rgba(255,220,190,0)');
  x.fillStyle=g;x.fillRect(0,0,128,128);
  const tex=new THREE.CanvasTexture(c);
  for(let i=0;i<22;i++){
    const a=i/22*Math.PI*2+Math.sin(i*7.3)*.2,r=650+Math.sin(i*3.1)*120;
    const s=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.55+Math.sin(i*5.7)*.2,depthWrite:false,fog:false}));
    s.position.set(Math.cos(a)*r,130+(i%5)*35,Math.sin(a)*r);s.scale.set(260+(i%4)*60,80,1);scene.add(s);
  }
}
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}
addEventListener('resize',resize);resize();

const vm=new THREE.Group();camera.add(vm);
let viewItem=null;
function setView(id){
  viewItem=id;while(vm.children.length)vm.remove(vm.children[0]);
  const m=itemMesh(id),r=!!ITEMS[id].ranged;
  m.position.set(r?.28:.32,-.32,-.55);m.rotation.set(r?0:-.5,0,r?0:-.15);
  vm.add(m);vm.userData.m=m;vm.userData.r=r;
}

// ======================= ÉTAT =======================
let world=null,net=null,mode='coop',running=false;
const me={id:'',name:'Joueur',idx:0,pos:new THREE.Vector3(),vel:new THREE.Vector3(),yaw:0,pitch:0,hp:100,dead:false,deadT:0,
  inv:{wood:0,stone:0,iron:0,steel:0,meat:0},tools:new Set(['fist']),slot:0,onGround:false,veh:null,
  build:false,bpiece:'wall',bmat:'wood',cd:0,att:0,lastHurt:0,lastAttacker:null,viewAnim:0,bob:0};
const S={players:new Map(),animals:new Map(),bots:new Map(),vehicles:new Map(),scores:{},treasure:null,chest:null,round:0};
const H={animals:new Map(),bots:new Map(),nid:1,next:0,respawn:[],removed:new Set(),snapT:0,restartAt:0,winner:false,botNext:0,scores:{}};
const hot=()=>ORDER.filter(i=>me.tools.has(i));
const cur=()=>{const h=hot();return h[Math.min(me.slot,h.length-1)]};
const nameOf=id=>id===me.id?me.name:(S.players.get(id)?.name||'Joueur');
const keys={};let mouseDown=false,invOpen=false;

// ======================= MENU / CONNEXION =======================
const status=t=>$('status').textContent=t;
async function prep(){me.name=($('name').value||'Joueur').trim().slice(0,14);status('Chargement…');await loadKits()}
function wire(){
  net.onmsg=onmsg;net.onpeer=onPeer;
  net.onleave=id=>{removePlayer(id);net.bcast({t:'left',id})};
  net.onclose=()=>{showBanner("Connexion à l'hôte perdue — rechargez la page",600000)};
}
$('btn-host').onclick=async()=>{
  await prep();net=new Net();wire();
  try{await net.host()}catch(e){status('Erreur réseau : '+(e.type||e.message));return}
  mode=$('mode').value;
  startGame({seed:(Math.random()*2e9)|0,idx:0});
  hostStart();
  $('info').innerHTML=`${MODES[mode].name} — code à donner à ton ami : <b style="font-size:18px;letter-spacing:2px">${net.code}</b>`;
};
$('btn-solo').onclick=async()=>{
  await prep();net=new Net();wire();net.solo();
  mode=$('mode').value;
  startGame({seed:(Math.random()*2e9)|0,idx:0});
  hostStart();
  $('info').textContent=`${MODES[mode].name} — solo`;
};
$('btn-join').onclick=async()=>{
  const code=$('code').value.trim();if(code.length<5){status('Entre le code à 5 caractères');return}
  await prep();net=new Net();wire();
  status('Connexion…');
  try{await net.join(code)}catch(e){status('Échec : '+(e.message||e.type));return}
  status('Connecté, chargement de la carte…');
};
function onPeer(id){
  const idx=++H.next;
  net.sendTo(id,{t:'init',seed:world.seed,mode,idx,pieces:world.pieces,removed:[...H.removed],
    veh:[...S.vehicles.values()].map(vState),tr:S.treasure,sc:H.scores,r:S.round});
}
function startGame(cfg){
  me.idx=cfg.idx;me.id=net.id;
  world=createWorld(scene,cfg.seed);
  if(MODES[mode].arena)for(const t of['spear','bow','rifle'])me.tools.add(t);
  setView('fist');spawnMe();
  $('menu').classList.add('hidden');$('hud').classList.remove('hidden');
  running=true;last=performance.now();
  renderer.setAnimationLoop(frame);
  try{cv.requestPointerLock()}catch(e){}
}

// ======================= MESSAGES RÉSEAU =======================
function onmsg(from,m){
  switch(m.t){
    case'init':{
      mode=m.mode;startGame({seed:m.seed,idx:m.idx});
      for(const s of m.pieces)world.addPiece(s);
      for(const id of m.removed)world.removeNode(id);
      for(const v of m.veh)createVehicle(v);
      S.scores=m.sc||{};S.round=m.r;if(m.tr)setTreasure(m.tr);
      $('info').textContent=`${MODES[mode].name} — partie de ${nameOf(from)||'l\'hôte'}`;
      break;
    }
    case'st':{
      if(m.id===me.id)break;
      let p=S.players.get(m.id);
      if(!p){
        p={id:m.id,actor:new Actor('human',{color:COL[m.i%4],name:m.n}),tx:m.x,ty:m.y,tz:m.z,ry:m.r,att:m.at,speed:0,hp:100,it:'fist'};
        p.actor.root.position.set(m.x,m.y,m.z);scene.add(p.actor.root);S.players.set(m.id,p);
      }
      p.name=m.n;p.idx=m.i;p.tx=m.x;p.ty=m.y;p.tz=m.z;p.ry=m.r;p.hp=m.hp;p.it=m.it;p.veh=m.v;p.seen=now();
      if(m.at!==p.att){p.pulse=true;p.att=m.at}
      break;
    }
    case'left':removePlayer(m.id);break;
    case'build':world.addPiece(m.s);break;
    case'rm':world.removeNode(m.id);break;
    case'vspawn':createVehicle(m.v);break;
    case'veh':{const v=S.vehicles.get(m.id);if(v&&v.occ[0]!==me.id){v.tx=m.x;v.ty=m.y;v.tz=m.z;v.try=m.ry}break}
    case'enter':{const v=S.vehicles.get(m.id);if(v)v.occ[m.seat]=m.pid;break}
    case'exit':{const v=S.vehicles.get(m.id);if(v)for(let i=0;i<2;i++)if(v.occ[i]===m.pid)v.occ[i]=null;break}
    case'loot':for(const k in m.res)me.inv[k]=(me.inv[k]||0)+m.res[k];if(invOpen)renderInv();break;
    case'dmg':takeDamage(m.amt,m.from);break;
    case'fx':tracer(new THREE.Vector3(...m.a),new THREE.Vector3(...m.b));break;
    case'banner':showBanner(m.txt,m.ms||3500);break;
    case'snap':applySnap(m);break;
    case'round':onRound(m);break;
    default:
      if(net.isHost&&m.t&&m.t.startsWith('req_'))hostHandle(from,m);
  }
}
function removePlayer(id){
  const p=S.players.get(id);if(!p)return;
  scene.remove(p.actor.root);S.players.delete(id);
  for(const v of S.vehicles.values())for(let i=0;i<2;i++)if(v.occ[i]===id)v.occ[i]=null;
}
function onRound(m){
  S.round=m.r;S.scores=m.sc||{};if(m.tr)setTreasure(m.tr);
  if(MODES[mode].arena){me.hp=100}
  spawnMe();showBanner('Nouvelle manche !',2500);
}

// ======================= JOUEUR LOCAL =======================
function spawnPoint(){
  const M=MODES[mode];let i=0;
  if(M.treasure||mode==='duel')i=me.idx%2;
  const p=world.spawnPoint(i);
  return{x:p.x+(Math.random()-.5)*8,z:p.z+(Math.random()-.5)*8};
}
function spawnMe(){
  const p=spawnPoint();
  me.pos.set(p.x,world.groundAt(p.x,p.z,100)+.05,p.z);me.vel.set(0,0,0);
  me.hp=100;me.dead=false;me.veh=null;me.yaw=Math.atan2(p.x,p.z)+Math.PI*0;me.pitch=0;
}
function takeDamage(amt,src){
  if(me.dead||!running)return;
  me.hp-=amt;me.lastHurt=now();me.lastAttacker=src;
  const h=$('hurt');h.style.opacity=1;setTimeout(()=>h.style.opacity=0,120);
  if(me.hp<=0)die();
}
function die(){
  me.dead=true;me.deadT=3.2;me.hp=0;mouseDown=false;
  if(me.veh)exitVehicle(true);
  showBanner('Vous êtes mort…',3000);
  net.toHost({t:'req_died',killer:me.lastAttacker});
}
// ---- manette (Gamepad API) : stick gauche bouger, stick droit viser, RT frapper/tirer/poser, A sauter,
// L3 courir, X interagir, Y manger, B construire, LB/RB changer d'objet, Start inventaire,
// en construction : croix gauche/droite = pièce, croix haut = matériau ; inventaire : croix haut/bas + A.
const pad={x:0,y:0,rx:0,ry:0,fire:false,jump:false,sprint:false,active:false,prev:[]};
let invSel=0,padHelp=true,padSig='';
// aide manette à l'écran : touches utiles selon le contexte, la touche pressée s'allume
function padRows(){
  if(free)return[[null,'⟲','st','Stick gauche : se déplacer'],[null,'⟳','st','Stick droit : regarder'],[7,'RT','trig','Monter'],[6,'LT','trig','Descendre'],[10,'L3','st','Rapide'],[13,'↓','dp','Quitter la caméra libre']];
  if(invOpen)return[[12,'↑','dp','Monter'],[13,'↓','dp','Descendre'],[0,'A','a','Fabriquer'],[1,'B','b','Fermer'],[9,'☰','sm','Fermer']];
  if(me.veh)return[[null,'⟲','st','Stick gauche : conduire'],[2,'X','x','Sortir du buggy'],[10,'L3','st','Boost'],[11,'R3','st','Changer de vue'],[8,'⧉','sm','Masquer l\'aide']];
  if(me.build)return[[7,'RT','trig','Poser'],[14,'←','dp','Pièce précédente'],[15,'→','dp','Pièce suivante'],[12,'↑','dp','Bois / pierre'],[1,'B','b','Quitter la construction'],[8,'⧉','sm','Masquer l\'aide']];
  return[[7,'RT','trig','Frapper / tirer'],[0,'A','a','Sauter'],[2,'X','x','Interagir'],[3,'Y','y','Manger'],[1,'B','b','Construire'],[4,'LB','sh','Objet précédent'],[5,'RB','sh','Objet suivant'],[10,'L3','st','Courir'],[11,'R3','st','Changer de vue'],[13,'↓','dp','Caméra libre'],[9,'☰','sm','Inventaire / craft'],[8,'⧉','sm','Masquer l\'aide']];
}
function updatePadHelp(){
  const el=$('padhelp'),on=padHelp&&pad.active&&running;
  el.classList.toggle('hidden',!on);
  if(!on)return;
  const rows=padRows(),sig=rows.map(r=>r[1]+(pad.prev[r[0]]?1:0)).join('')+third;
  if(sig===padSig)return;padSig=sig;
  el.innerHTML='<div class="ph-t">Manette</div>'+rows.map(r=>`<div class="ph-r${pad.prev[r[0]]?' on':''}"><span class="gb ${r[2]}">${r[1]}</span>${r[3]}</div>`).join('');
}
function pollPad(dt){
  const list=navigator.getGamepads?[...navigator.getGamepads()]:[];
  const gp=list.find(g=>g&&g.connected);
  if(!gp){pad.x=pad.y=pad.rx=pad.ry=0;pad.fire=pad.jump=pad.sprint=false;return}
  const dz=v=>Math.abs(v)<.15?0:v;
  pad.x=dz(gp.axes[0]||0);pad.y=dz(gp.axes[1]||0);pad.rx=dz(gp.axes[2]||0);pad.ry=dz(gp.axes[3]||0);
  const b=i=>!!gp.buttons[i]&&gp.buttons[i].pressed;
  const edge=i=>b(i)&&!pad.prev[i];
  pad.fire=b(7);pad.jump=b(0);pad.sprint=b(10);pad.lt=b(6);
  if(pad.x||pad.y||pad.rx||pad.ry||gp.buttons.some(x=>x.pressed))pad.active=true;
  if(running){
    if(edge(8))padHelp=!padHelp;
    if(edge(11))toggleView();
    if(free){
      if(edge(13))toggleFree();
      fc.yaw-=pad.rx*dt*2.4;fc.pitch=clamp(fc.pitch-pad.ry*dt*1.8,-1.5,1.5);
    }
    else if(edge(9))toggleInv();
    else if(invOpen){
      if(edge(13))invSel=(invSel+1)%RECIPES.length;
      if(edge(12))invSel=(invSel+RECIPES.length-1)%RECIPES.length;
      if(edge(0))craft(RECIPES[invSel].id);
      if(edge(1))toggleInv();
      if(edge(12)||edge(13))renderInv();
    }else if(!me.dead){
      if(edge(2))interact();
      if(edge(3))eat();
      if(edge(1)&&!me.veh){me.build=!me.build;ghostKey=''}
      if(edge(13)&&!me.build)toggleFree();
      if(me.build){
        if(edge(14))me.bpiece=PKEYS[(PKEYS.indexOf(me.bpiece)+3)%4];
        if(edge(15))me.bpiece=PKEYS[(PKEYS.indexOf(me.bpiece)+1)%4];
        if(edge(12))me.bmat=me.bmat==='wood'?'stone':'wood';
      }else{
        const n=hot().length;
        if(edge(5))me.slot=(Math.min(me.slot,n-1)+1)%n;
        if(edge(4))me.slot=(Math.min(me.slot,n-1)+n-1)%n;
      }
      me.yaw-=pad.rx*dt*3;me.pitch=clamp(me.pitch-pad.ry*dt*2.2,-1.5,1.5);
    }
  }
  pad.prev=gp.buttons.map(x=>x.pressed);
}
function walkUpdate(dt){
  // touches physiques : KeyW/A/S/D = ZQSD en AZERTY et WASD en QWERTY
  const ix=clamp((keys.KeyD?1:0)-(keys.KeyA?1:0)+pad.x,-1,1);
  const iz=clamp((keys.KeyW?1:0)-(keys.KeyS?1:0)-pad.y,-1,1);
  const inWater=world.heightAt(me.pos.x,me.pos.z)<-.3;
  const sp=((keys.ShiftLeft||keys.ShiftRight||pad.sprint)?8.5:5.2)*(inWater?.55:1);
  const sy=Math.sin(me.yaw),cy=Math.cos(me.yaw);
  // avant = (-sin, -cos) ; droite = (cos, -sin)
  let wx=(-sy)*iz+cy*ix,wz=(-cy)*iz-sy*ix;
  const l=Math.hypot(wx,wz);if(l>1){wx/=l;wz/=l}
  const k=Math.min(1,dt*10);
  me.vel.x+=(wx*sp-me.vel.x)*k;me.vel.z+=(wz*sp-me.vel.z)*k;
  me.pos.x+=me.vel.x*dt;me.pos.z+=me.vel.z*dt;
  world.collide(me.pos,.4,me.pos.y);
  const g=world.groundAt(me.pos.x,me.pos.z,me.pos.y);
  if((keys.Space||pad.jump)&&me.onGround){me.vel.y=8.5;me.onGround=false}
  me.vel.y-=25*dt;me.pos.y+=me.vel.y*dt;
  if(me.pos.y<=g){me.pos.y=g;me.vel.y=0;me.onGround=true}
  else me.onGround=me.pos.y-g<.05&&me.vel.y<=0;
  me.bob+=Math.hypot(me.vel.x,me.vel.z)*dt*1.6;
}
function drive(dt){
  const v=S.vehicles.get(me.veh.id);if(!v)return;
  const iz=clamp((keys.KeyW?1:0)-(keys.KeyS?1:0)-pad.y,-1,1),ix=clamp((keys.KeyD?1:0)-(keys.KeyA?1:0)+pad.x,-1,1);
  if(me.veh.seat===0){
    const target=iz*((keys.ShiftLeft||pad.sprint)?24:18);
    v.spd+=(target-v.spd)*dt*(iz?1.1:1.8);
    v.ry-=ix*dt*1.9*clamp(v.spd/6,-1,1);
    const nx=v.x-Math.sin(v.ry)*v.spd*dt,nz=v.z-Math.cos(v.ry)*v.spd*dt;
    if(world.heightAt(nx,nz)<-.8){v.spd*=.3}
    else{
      const t=new THREE.Vector3(nx,v.y,nz);world.collide(t,1.5,v.y);
      if(Math.hypot(t.x-nx,t.z-nz)>.02)v.spd*=.6;
      v.x=t.x;v.z=t.z;
    }
    const gy=world.groundAt(v.x,v.z,v.y+.5);
    v.y+=(gy-v.y)*Math.min(1,dt*12);
  }
  const seat=me.veh.seat===0?[-.5,.55,.2]:[.5,.55,.2];
  const c=Math.cos(v.ry),s=Math.sin(v.ry);
  me.pos.set(v.x+seat[0]*c+seat[2]*s,v.y+seat[1],v.z-seat[0]*s+seat[2]*c);
  me.vel.set(0,0,0);
}
// vue à la 3e personne (V ou R3) : caméra derrière le joueur, qui devient visible avec ses animations
let third=false,meActor=null,lastAtt=0;
function toggleView(){
  third=!third;
  if(third&&!meActor){meActor=new Actor('human',{color:COL[me.idx%4]});scene.add(meActor.root)}
  if(meActor)meActor.root.visible=third;
  showBanner(third?'Vue à la 3ᵉ personne':'Vue à la 1ʳᵉ personne',1000);
}
// caméra libre (C ou croix bas) : on vole librement pour regarder l'île, le joueur reste sur place
let free=false;const fc={pos:new THREE.Vector3(),yaw:0,pitch:0};
function toggleFree(){
  free=!free;
  if(free){
    fc.pos.copy(camera.position);fc.yaw=me.yaw;fc.pitch=me.pitch;mouseDown=false;
    if(!meActor){meActor=new Actor('human',{color:COL[me.idx%4]});scene.add(meActor.root)}
    showBanner('Caméra libre — ZQSD + souris · Espace / Ctrl : monter / descendre · Maj : rapide · C : quitter',3500);
  }else showBanner('Caméra libre désactivée',1000);
  $('crosshair').style.display=free?'none':'';
}
function updateFree(dt){
  const ix=clamp((keys.KeyD?1:0)-(keys.KeyA?1:0)+pad.x,-1,1),iz=clamp((keys.KeyW?1:0)-(keys.KeyS?1:0)-pad.y,-1,1);
  const iy=clamp((keys.Space||pad.fire?1:0)-(keys.ControlLeft||keys.ControlRight||pad.lt?1:0),-1,1);
  const sp=(keys.ShiftLeft||keys.ShiftRight||pad.sprint?60:18)*dt;
  const cp=Math.cos(fc.pitch),sy=Math.sin(fc.yaw),cy=Math.cos(fc.yaw);
  fc.pos.x+=(-sy*cp*iz+cy*ix)*sp;fc.pos.z+=(-cy*cp*iz-sy*ix)*sp;fc.pos.y+=(Math.sin(fc.pitch)*iz+iy)*sp;
  const r=Math.hypot(fc.pos.x,fc.pos.z);if(r>900){fc.pos.x*=900/r;fc.pos.z*=900/r}
  fc.pos.y=clamp(fc.pos.y,world.heightAt(fc.pos.x,fc.pos.z)+.5,400);
  camera.position.copy(fc.pos);camera.rotation.set(fc.pitch,fc.yaw,0);
}
function updateThird(dt){
  if(!meActor)return;
  const show=(third||free)&&!me.dead&&!me.veh;
  meActor.root.visible=show;
  if(!third&&!free)return;
  if(show){
    meActor.root.position.copy(me.pos);meActor.root.rotation.y=me.yaw;
    meActor.setItem(me.build?'fist':cur());
    const pulse=me.att!==lastAtt;lastAtt=me.att;
    meActor.update(dt,Math.hypot(me.vel.x,me.vel.z),pulse);
  }
  if(me.dead||free)return;
  // caméra recule derrière la tête, raccourcie par le relief ou les murs
  const head=camera.position.clone(),cp=Math.cos(me.pitch);
  const back=new THREE.Vector3(Math.sin(me.yaw)*cp,-Math.sin(me.pitch),Math.cos(me.yaw)*cp);
  const hit=world.rayWorld(head,back,4.2);
  let dist=hit?Math.max(.6,hit.t-.3):4.2;
  for(let t=.6;t<dist;t+=.4){ // les troncs d'arbres et rochers raccourcissent aussi la distance
    const px=head.x+back.x*t,pz=head.z+back.z*t;let blocked=false;
    world.nearNodes(px,pz,2.5,n=>{if(n.alive&&Math.hypot(n.x-px,n.z-pz)<n.r+.35)blocked=true});
    if(blocked){dist=Math.max(.6,t-.4);break}
  }
  camera.position.addScaledVector(back,dist);
  camera.position.y+=.35;
  const gh=world.heightAt(camera.position.x,camera.position.z)+.4;if(camera.position.y<gh)camera.position.y=gh;
}
function updateMe(dt){
  me.cd=Math.max(0,me.cd-dt);me.viewAnim=Math.max(0,me.viewAnim-dt*4);
  pollPad(dt);
  if(free){if(me.dead){me.deadT-=dt;if(me.deadT<=0)spawnMe()}updateFree(dt);updateThird(dt);vm.visible=false;$('water').style.display=camera.position.y<0?'block':'none';$('hint').textContent='';return}
  if(me.dead){me.deadT-=dt;if(me.deadT<=0)spawnMe();}
  else{
    if(me.veh)drive(dt);else walkUpdate(dt);
    if(now()-me.lastHurt>10&&me.hp<100)me.hp=Math.min(100,me.hp+dt*.8);
    if((mouseDown||pad.fire)&&!invOpen)primary();
  }
  const eye=me.dead?.4:1.65;
  camera.position.set(me.pos.x,me.pos.y+eye+(me.dead?0:Math.sin(me.bob)*.04*Math.min(1,Math.hypot(me.vel.x,me.vel.z)/5)),me.pos.z);
  camera.rotation.set(me.dead?-1.2:me.pitch,me.yaw,me.dead?.6:0);
  updateThird(dt);
  // objet en main
  const c=me.build?'fist':cur();
  if(c!==viewItem)setView(c);
  vm.visible=!third&&!me.dead&&!me.veh&&!me.build;
  const m=vm.userData.m,a=me.viewAnim;
  if(m){if(vm.userData.r)m.position.z=-.55+a*.12;else m.rotation.x=-.5-Math.sin(a*Math.PI)*1.1}
  $('water').style.display=camera.position.y<0?'block':'none';
  updateHint();
}

// ======================= ACTIONS =======================
function rs(c,r,o,d,range){
  const vx=c.x-o.x,vy=c.y-o.y,vz=c.z-o.z,t=vx*d.x+vy*d.y+vz*d.z;
  if(t<0||t>range+r)return null;
  const d2=vx*vx+vy*vy+vz*vz-t*t;
  return d2<r*r?Math.max(0,t-Math.sqrt(r*r-d2)):null;
}
function pickTarget(o,d,range,it){
  let best=null;const consider=(t,o2)=>{if(t!==null&&t<=range&&(!best||t<best.t))best={...o2,t}};
  if(!it.ranged){
    world.nearNodes(o.x+d.x*range/2,o.z+d.z*range/2,range/2+2,n=>{
      if(!n.alive||!it.h[n.kind])return;
      const tree=n.kind==='tree',rr=tree?.75:n.r+.25;
      for(const y of tree?[.6,1.6,2.6,3.6]:[.6])consider(rs({x:n.x,y:n.y+y,z:n.z},rr,o,d,range),{k:'n',id:n.id,nk:n.kind});
    });
  }
  for(const[id,a]of S.animals){const p=a.actor.root.position;consider(rs({x:p.x,y:p.y+.9,z:p.z},ANR[a.type],o,d,range),{k:'a',id})}
  for(const[id,b]of S.bots){const p=b.actor.root.position;for(const y of[.6,1.3])consider(rs({x:p.x,y:p.y+y,z:p.z},.5,o,d,range),{k:'b',id})}
  if(MODES[mode].pvp)for(const[id,p]of S.players){
    if(p.hp<=0)continue;const q=p.actor.root.position;
    for(const y of[.6,1.3])consider(rs({x:q.x,y:q.y+y,z:q.z},.5,o,d,range),{k:'p',id});
  }
  return best;
}
const tracers=[];
function tracer(a,b){
  const l=new THREE.Line(new THREE.BufferGeometry().setFromPoints([a,b]),new THREE.LineBasicMaterial({color:0xffee88,transparent:true}));
  scene.add(l);tracers.push({l,t:.12});
}
function updateTracers(dt){
  for(let i=tracers.length-1;i>=0;i--){const t=tracers[i];t.t-=dt;t.l.material.opacity=Math.max(0,t.t/.12);if(t.t<=0){scene.remove(t.l);tracers.splice(i,1)}}
}
function primary(){
  if(me.dead||me.veh||free)return;
  if(me.build){placePiece();return}
  if(me.cd>0)return;
  const id=cur(),it=ITEMS[id];
  me.cd=it.cd;me.viewAnim=1;me.att++;
  const o=camera.position.clone();
  const d=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  let hit=pickTarget(o,d,it.range,it);
  if(it.ranged){
    let len=hit?hit.t:it.range;
    const wb=world.rayWorld(o,d,len);
    if(wb&&(!hit||wb.t<hit.t)){len=wb.t;hit=null}
    const a=o.clone().addScaledVector(d,.5).add(new THREE.Vector3(Math.cos(me.yaw)*.25,-.25,-Math.sin(me.yaw)*.25));
    const b=o.clone().addScaledVector(d,len);
    tracer(a,b);net.bcast({t:'fx',a:a.toArray(),b:b.toArray()});
  }
  if(hit){
    if(hit.k==='n')net.toHost({t:'req_harvest',id:hit.id,p:it.h[hit.nk]});
    else net.toHost({t:'req_hit',k:hit.k,id:hit.id,dmg:it.dmg});
    const c=$('crosshair');c.classList.add('hit');setTimeout(()=>c.classList.remove('hit'),110);
  }
}
let ghost=null,ghostKey='',ghostSpec=null,ghostOk=false;
function updateBuildGhost(){
  const bi=$('buildinfo');
  if(!me.build||me.dead){if(ghost){scene.remove(ghost);ghost=null;ghostKey=''}bi.classList.add('hidden');ghostSpec=null;return}
  bi.classList.remove('hidden');
  const cost=PIECES[me.bpiece][1];
  bi.innerHTML=`🔨 Construction — ${PKEYS.map((k,i)=>`<b>[${i+1}]</b> ${me.bpiece===k?'<u>':''}${PIECES[k][0]}${me.bpiece===k?'</u>':''}`).join(' ')} — Matériau : <b>${me.bmat==='wood'?'Bois':'Pierre'}</b> (R) — coût ${cost} ${me.bmat==='wood'?'bois':'pierre'} — clic : poser · B : quitter`;
  const o=camera.position,d=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  const h=world.rayWorld(o,d,12);
  if(!h){if(ghost){scene.remove(ghost);ghost=null;ghostKey=''}ghostSpec=null;return}
  const spec=world.snap(me.bpiece,h.point);spec.mat=me.bmat;
  const ok=!world.hasPiece(spec)&&me.inv[me.bmat==='wood'?'wood':'stone']>=cost;
  const key=[spec.type,spec.x.toFixed(1),spec.y.toFixed(1),spec.z.toFixed(1),spec.axis,ok].join('|');
  if(key!==ghostKey){
    if(ghost)scene.remove(ghost);
    ghost=world.ghost(spec,ok);scene.add(ghost);ghostKey=key;
  }
  ghostSpec=spec;ghostOk=ok;
}
function placePiece(){
  if(!ghostSpec||!ghostOk||me.cd>0)return;
  me.cd=.25;
  const res=me.bmat==='wood'?'wood':'stone';
  me.inv[res]-=PIECES[me.bpiece][1];
  world.addPiece(ghostSpec);net.bcast({t:'build',s:ghostSpec});ghostKey='';
}
function afford(cost){return Object.entries(cost).every(([k,v])=>(me.inv[k]||0)>=v)}
function craft(id){
  const r=RECIPES.find(x=>x.id===id);if(!r||me.dead)return;
  if(!afford(r.cost)){showBanner('Ressources insuffisantes',1200);return}
  if(!r.free&&!world.nearTable(me.pos.x,me.pos.z)){showBanner('Il faut être près d\'un établi',1500);return}
  if(ITEMS[id]&&me.tools.has(id))return;
  for(const[k,v]of Object.entries(r.cost))me.inv[k]-=v;
  const fx=-Math.sin(me.yaw),fz=-Math.cos(me.yaw);
  if(id==='table'){
    const x=me.pos.x+fx*2.5,z=me.pos.z+fz*2.5;
    const s={type:'table',x,y:world.groundAt(x,z,me.pos.y),z,mat:'wood'};
    world.addPiece(s);net.bcast({t:'build',s});
  }else if(id==='steel')me.inv.steel++;
  else if(id==='buggy'){
    const x=me.pos.x+fx*5,z=me.pos.z+fz*5;
    const v={id:'v'+me.id.slice(-4)+(Date.now()%1e6),x,y:world.groundAt(x,z,me.pos.y),z,ry:me.yaw,occ:[null,null]};
    createVehicle(v);net.bcast({t:'vspawn',v});
  }else{me.tools.add(id);me.slot=hot().indexOf(id)}
  showBanner('Fabriqué : '+(r.name||ITEMS[id]?.name||id),1500);
  renderInv();
}
function eat(){if(me.inv.meat>0&&me.hp<100&&!me.dead){me.inv.meat--;me.hp=Math.min(100,me.hp+30)}}

// ---- véhicules
const vState=v=>({id:v.id,x:v.x,y:v.y,z:v.z,ry:v.ry,occ:v.occ});
function createVehicle(v){
  if(S.vehicles.has(v.id))return;
  const mesh=makeBuggy();mesh.position.set(v.x,v.y,v.z);mesh.rotation.y=v.ry;scene.add(mesh);
  S.vehicles.set(v.id,{id:v.id,mesh,x:v.x,y:v.y,z:v.z,ry:v.ry,spd:0,occ:v.occ||[null,null],tx:v.x,ty:v.y,tz:v.z,try:v.ry});
}
function nearestVehicle(){
  let b=null,bd=4.5;
  for(const v of S.vehicles.values()){const d=Math.hypot(v.x-me.pos.x,v.z-me.pos.z);if(d<bd){bd=d;b=v}}
  return b;
}
function enterVehicle(v){
  const seat=!v.occ[0]?0:!v.occ[1]?1:-1;if(seat<0)return;
  v.occ[seat]=me.id;me.veh={id:v.id,seat};v.spd=0;
  net.bcast({t:'enter',id:v.id,seat,pid:me.id});
}
function exitVehicle(silent){
  const v=S.vehicles.get(me.veh.id);
  if(v){
    for(let i=0;i<2;i++)if(v.occ[i]===me.id)v.occ[i]=null;
    const c=Math.cos(v.ry),s=Math.sin(v.ry);
    me.pos.set(v.x-2.4*c,world.groundAt(v.x-2.4*c,v.z+2.4*s,v.y+1)+.05,v.z+2.4*s);
    net.bcast({t:'exit',id:v.id,pid:me.id});
  }
  me.veh=null;void silent;
}
function updateVehicles(dt){
  for(const v of S.vehicles.values()){
    const mine=v.occ[0]===me.id;
    if(!mine){
      const k=1-Math.exp(-dt*10);
      v.x+=(v.tx-v.x)*k;v.y+=(v.ty-v.y)*k;v.z+=(v.tz-v.z)*k;
      let da=v.try-v.ry;while(da>Math.PI)da-=6.283;while(da<-Math.PI)da+=6.283;v.ry+=da*k;
    }
    v.mesh.position.set(v.x,v.y,v.z);v.mesh.rotation.y=v.ry;
  }
}

// ---- trésor
function setTreasure(p){
  S.treasure=p;
  if(S.chest)scene.remove(S.chest);
  S.chest=makeChest();S.chest.position.set(p.x,world.heightAt(p.x,p.z)-.1,p.z);S.chest.rotation.y=Math.random()*6;scene.add(S.chest);
}
function updateHint(){
  let h='';
  if(me.veh)h='E : sortir du buggy · ZQSD : conduire';
  else if(nearestVehicle())h='E : monter dans le buggy';
  else if(S.treasure&&Math.hypot(S.treasure.x-me.pos.x,S.treasure.z-me.pos.z)<3.5)h='E : ouvrir le coffre !';
  else if(world.nearTable(me.pos.x,me.pos.z))h='Établi à proximité — Tab pour fabriquer';
  $('hint').textContent=me.dead?'':h;
}
function interact(){
  if(me.dead)return;
  if(me.veh){exitVehicle();return}
  const v=nearestVehicle();
  if(v){enterVehicle(v);return}
  if(S.treasure&&Math.hypot(S.treasure.x-me.pos.x,S.treasure.z-me.pos.z)<3.5)net.toHost({t:'req_treasure'});
}

// ======================= JOUEURS DISTANTS / ENTITÉS =======================
function lerpAngle(a,b,k){let d=b-a;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;return a+d*k}
function sendState(){
  net.bcast({t:'st',id:me.id,n:me.name,i:me.idx,x:+me.pos.x.toFixed(2),y:+me.pos.y.toFixed(2),z:+me.pos.z.toFixed(2),
    r:+me.yaw.toFixed(2),it:me.build?'fist':cur(),hp:Math.round(me.hp),at:me.att,v:me.veh?me.veh.id:null});
  if(me.veh&&me.veh.seat===0){
    const v=S.vehicles.get(me.veh.id);
    if(v)net.bcast({t:'veh',id:v.id,x:+v.x.toFixed(2),y:+v.y.toFixed(2),z:+v.z.toFixed(2),ry:+v.ry.toFixed(2)});
  }
}
function updateRemote(dt){
  const k=1-Math.exp(-dt*12);
  for(const[id,p]of[...S.players]){
    if(now()-p.seen>10){removePlayer(id);continue}
    const r=p.actor.root,ox=r.position.x,oz=r.position.z;
    r.position.x+=(p.tx-r.position.x)*k;r.position.y+=(p.ty-r.position.y)*k;r.position.z+=(p.tz-r.position.z)*k;
    r.rotation.y=lerpAngle(r.rotation.y,p.ry,k);
    p.speed+=(Math.hypot(r.position.x-ox,r.position.z-oz)/Math.max(dt,.001)-p.speed)*.2;
    p.actor.setItem(p.it);p.actor.update(dt,p.veh?0:p.speed,p.pulse);p.pulse=false;
    r.visible=p.hp>0;
  }
}
function updateEntities(dt){
  const k=1-Math.exp(-dt*8);
  for(const list of[S.animals,S.bots])for(const e of list.values()){
    const r=e.actor.root,ox=r.position.x,oz=r.position.z;
    r.position.x+=(e.tx-r.position.x)*k;r.position.z+=(e.tz-r.position.z)*k;
    r.position.y=Math.max(world.heightAt(r.position.x,r.position.z),-.6);
    r.rotation.y=lerpAngle(r.rotation.y,e.ry,k);
    e.speed=(e.speed||0)+(Math.hypot(r.position.x-ox,r.position.z-oz)/Math.max(dt,.001)-(e.speed||0))*.2;
    e.actor.update(dt,e.speed,false);
  }
}
function applySnap(m){
  S.scores=m.sc||{};
  const seenA=new Set(),seenB=new Set();
  for(const a of m.a){
    seenA.add(a[0]);let e=S.animals.get(a[0]);
    if(!e){e={type:TYPES[a[1]],actor:new Actor(TYPES[a[1]])};e.actor.root.position.set(a[2],0,a[3]);scene.add(e.actor.root);S.animals.set(a[0],e)}
    e.tx=a[2];e.tz=a[3];e.ry=a[4];e.hp=a[5];
  }
  for(const[id,e]of[...S.animals])if(!seenA.has(id)){scene.remove(e.actor.root);S.animals.delete(id)}
  for(const b of m.b){
    seenB.add(b[0]);let e=S.bots.get(b[0]);
    if(!e){e={actor:new Actor('human',{color:0x992222,name:'Bot'})};e.actor.setItem('rifle');e.actor.root.position.set(b[1],0,b[2]);scene.add(e.actor.root);S.bots.set(b[0],e)}
    e.tx=b[1];e.tz=b[2];e.ry=b[3];e.hp=b[4];
  }
  for(const[id,e]of[...S.bots])if(!seenB.has(id)){scene.remove(e.actor.root);S.bots.delete(id)}
}

// ======================= LOGIQUE HÔTE =======================
function humans(){
  const l=[{id:me.id,x:me.pos.x,y:me.pos.y,z:me.pos.z,dead:me.dead}];
  for(const p of S.players.values())l.push({id:p.id,x:p.tx,y:p.ty,z:p.tz,dead:p.hp<=0});
  return l;
}
function damageHuman(id,amt,src){
  if(id===me.id)takeDamage(amt,src);else net.sendTo(id,{t:'dmg',amt,from:src});
}
function hostStart(){
  const M=MODES[mode];H.scores=mode==='team'?{humans:0,bots:0}:{};
  if(M.animals)for(const[t,n]of Object.entries({bear:7,wolf:7,deer:14,boar:10}))for(let i=0;i<n;i++)spawnAnimal(t);
  if(M.treasure)newTreasure();
}
function spawnAnimal(t){
  const ok=t==='bear'?['forest','rock']:t==='wolf'?['snow','forest']:t==='deer'?['forest','snow']:['forest','swamp','desert'];
  for(let k=0;k<300;k++){
    const x=(Math.random()-.5)*300,z=(Math.random()-.5)*300;
    if(world.heightAt(x,z)<1||!ok.includes(world.biomeAt(x,z)))continue;
    const id='A:'+(H.nid++);
    H.animals.set(id,{id,type:t,x,z,ry:Math.random()*6.28,hp:AN[t].hp,wt:0,dx:0,dz:0,cd:0,agro:null});return;
  }
}
function spawnBot(){
  const p=world.spawnPoint(1),id='B:'+(H.nid++);
  H.bots.set(id,{id,x:p.x+(Math.random()-.5)*10,z:p.z+(Math.random()-.5)*10,ry:0,hp:70,cd:1,sw:1});
}
function newTreasure(){
  const s0=world.spawnPoint(0),s1=world.spawnPoint(1);
  const p=world.randLand(Math.random,(x,z)=>{const b=world.biomeAt(x,z);return b!=='rock'&&b!=='beach'&&Math.hypot(x-s0.x,z-s0.z)>70&&Math.hypot(x-s1.x,z-s1.z)>70});
  H.open=false;setTreasure(p);
}
const moveLand=(e,dx,dz,dt,sp)=>{
  const nx=e.x+dx*sp*dt,nz=e.z+dz*sp*dt;
  if(world.heightAt(nx,nz)>.5&&Math.hypot(nx,nz)<200){
    const t={x:nx,z:nz};world.collide(t,.6,world.heightAt(nx,nz));e.x=t.x;e.z=t.z;return true;
  }
  return false;
};
function simAnimal(a,dt,hs){
  const T=AN[a.type];a.cd=Math.max(0,a.cd-dt);a.wt-=dt;
  let near=null,nd=1e9;
  for(const h of hs){if(h.dead)continue;const d=Math.hypot(h.x-a.x,h.z-a.z);if(d<nd){nd=d;near=h}}
  let st='wander';
  if(T.hostile&&near&&nd<T.det*(a.agro?1.6:1))st='chase';
  if(a.type==='boar'&&a.agro&&near&&nd<40)st='chase';
  if(T.flee&&near&&nd<16)st='flee';
  if(st==='chase'){
    const dx=(near.x-a.x)/nd,dz=(near.z-a.z)/nd;a.ry=Math.atan2(-dx,-dz);
    if(nd>1.9)moveLand(a,dx,dz,dt,T.spd);
    else if(a.cd<=0){a.cd=1.3;damageHuman(near.id,T.dmg,a.id)}
  }else if(st==='flee'){
    const dx=(a.x-near.x)/nd,dz=(a.z-near.z)/nd;a.ry=Math.atan2(-dx,-dz);
    if(!moveLand(a,dx,dz,dt,T.spd)){a.dx=Math.random()-.5;a.dz=Math.random()-.5}
  }else{
    if(a.wt<=0){a.wt=3+Math.random()*4;const an=Math.random()*6.28;a.dx=Math.random()<.35?0:Math.cos(an);a.dz=a.dx===0?0:Math.sin(an)}
    if(a.dx||a.dz){a.ry=Math.atan2(-a.dx,-a.dz);if(!moveLand(a,a.dx,a.dz,dt,T.wspd))a.wt=0}
  }
}
function simBot(b,dt,hs){
  b.cd=Math.max(0,b.cd-dt);
  let t=null,td=1e9;
  for(const h of hs){if(h.dead)continue;const d=Math.hypot(h.x-b.x,h.z-b.z);if(d<td){td=d;t=h}}
  if(!t)return;
  const dx=t.x-b.x,dz=t.z-b.z,d=Math.max(td,.01);
  b.ry=Math.atan2(-dx,-dz);
  let mx,mz;
  if(d>14){mx=dx/d;mz=dz/d}
  else if(d<7){mx=-dx/d;mz=-dz/d}
  else{if(Math.random()<dt*.4)b.sw=-b.sw;mx=-dz/d*b.sw;mz=dx/d*b.sw}
  moveLand(b,mx,mz,dt,5.5);
  if(d<32&&b.cd<=0){
    b.cd=.9+Math.random()*.6;
    const gy=world.heightAt(b.x,b.z),a=new THREE.Vector3(b.x,gy+1.4,b.z),e=new THREE.Vector3(t.x,t.y+1.2,t.z);
    tracer(a,e);net.bcast({t:'fx',a:a.toArray(),b:e.toArray()});
    if(Math.random()<clamp(.7-d/60,.15,.6))damageHuman(t.id,8,b.id);
  }
}
function hostUpdate(dt){
  const hs=humans(),M=MODES[mode],tnow=now();
  for(const a of H.animals.values())simAnimal(a,dt,hs);
  if(M.bots){
    for(const b of H.bots.values())simBot(b,dt,hs);
    const want=3*Math.max(1,S.players.size+1)+0;
    if(H.bots.size<want&&tnow>H.botNext&&!H.winner){H.botNext=tnow+1.5;spawnBot()}
  }
  for(let i=H.respawn.length-1;i>=0;i--)if(tnow>H.respawn[i].at){spawnAnimal(H.respawn[i].type);H.respawn.splice(i,1)}
  if(H.winner&&tnow>H.restartAt)hostRestart();
  H.snapT+=dt;
  if(H.snapT>.1){
    H.snapT=0;
    const r=n=>+n.toFixed(2);
    const m={t:'snap',
      a:[...H.animals.values()].map(a=>[a.id,TYPES.indexOf(a.type),r(a.x),r(a.z),r(a.ry),Math.round(a.hp)]),
      b:[...H.bots.values()].map(b=>[b.id,r(b.x),r(b.z),r(b.ry),Math.round(b.hp)]),
      sc:H.scores};
    net.bcast(m);applySnap(m);
  }
}
function hostHandle(from,m){
  switch(m.t){
    case'req_harvest':{
      const n=world.nodeMap.get(m.id);if(!n||!n.alive)return;
      n.hp-=m.p||1;
      const res={tree:'wood',rock:'stone',iron:'iron'}[n.kind];
      let amt=1;
      if(n.hp<=0){amt+=3;world.removeNode(n.id);H.removed.add(n.id);net.bcast({t:'rm',id:n.id})}
      net.sendTo(from,{t:'loot',res:{[res]:amt}});
      break;
    }
    case'req_hit':{
      if(m.k==='a'){
        const a=H.animals.get(m.id);if(!a)return;
        a.hp-=m.dmg;a.agro=from;
        if(a.hp<=0){H.animals.delete(a.id);H.respawn.push({at:now()+60,type:a.type});net.sendTo(from,{t:'loot',res:{meat:2+(Math.random()*3|0)}})}
      }else if(m.k==='b'){
        const b=H.bots.get(m.id);if(!b)return;
        b.hp-=m.dmg;
        if(b.hp<=0){H.bots.delete(b.id);hostScore(from,'bot')}
      }else if(m.k==='p'){
        if(MODES[mode].pvp)net.sendTo(m.id,{t:'dmg',amt:m.dmg,from});
      }
      break;
    }
    case'req_died':hostScore(m.killer,'human',from);break;
    case'req_treasure':{
      if(!MODES[mode].treasure||H.open||H.winner)return;
      H.open=true;hostWin(`🏆 ${nameOf(from)} a trouvé le trésor !`);
      break;
    }
  }
}
function hostScore(killer,victimKind,victim){
  const M=MODES[mode];
  if(mode==='team'){
    if(victimKind==='bot')H.scores.humans++;
    else if(typeof killer==='string'&&killer.startsWith('B:'))H.scores.bots++;
    if(H.scores.humans>=M.goal)hostWin('🏆 Les joueurs gagnent !');
    else if(H.scores.bots>=M.goal)hostWin('💀 Les bots gagnent…');
  }else if(mode==='duel'&&victimKind==='human'){
    if(typeof killer==='string'&&killer&&killer!==victim&&!killer.includes(':')){
      H.scores[killer]=(H.scores[killer]||0)+1;
      if(H.scores[killer]>=M.goal)hostWin(`🏆 ${nameOf(killer)} gagne le duel !`);
    }
  }
}
function hostWin(txt){
  if(H.winner)return;H.winner=true;H.restartAt=now()+8;
  net.bcast({t:'banner',txt,ms:7000});showBanner(txt,7000);
}
function hostRestart(){
  H.winner=false;S.round++;
  H.scores=mode==='team'?{humans:0,bots:0}:{};
  H.bots.clear();
  if(MODES[mode].treasure)newTreasure();
  const m={t:'round',r:S.round,tr:S.treasure,sc:H.scores};
  net.bcast(m);onRound(m);
}

// ======================= HUD =======================
let bannerT=0;
function showBanner(txt,ms=3000){const b=$('banner');b.textContent=txt;b.style.opacity=1;clearTimeout(bannerT);bannerT=setTimeout(()=>b.style.opacity=0,ms)}
let hbSig='',scoreSig='';
function updateHud(){
  $('hp-fill').style.width=clamp(me.hp,0,100)+'%';$('hp-text').textContent=Math.ceil(Math.max(0,me.hp));
  $('res').innerHTML=Object.entries(RES_LABEL).filter(([k])=>me.inv[k]>0).map(([k,l])=>`<span>${l} <b>${me.inv[k]}</b></span>`).join('');
  const h=hot(),sig=h.join()+me.slot+me.build;
  if(sig!==hbSig){
    hbSig=sig;
    $('hotbar').innerHTML=h.map((id,i)=>`<div class="slot ${!me.build&&i===Math.min(me.slot,h.length-1)?'sel':''}"><b>${i+1}</b>${ITEMS[id].name}</div>`).join('')+`<div class="slot ${me.build?'sel':''}"><b>B</b>Construire</div>`;
  }
  const M=MODES[mode];let sc='';
  if(mode==='team')sc=`Joueurs <b>${S.scores.humans||0}</b> – <b>${S.scores.bots||0}</b> Bots (objectif ${M.goal})`;
  else if(mode==='duel'){
    const ids=[me.id,...S.players.keys()];
    sc=ids.map(id=>`${nameOf(id)} <b>${S.scores[id]||0}</b>`).join(' – ')+` (premier à ${M.goal})`;
  }else if(M.treasure&&S.treasure){
    const d=Math.hypot(S.treasure.x-me.pos.x,S.treasure.z-me.pos.z);
    sc=`🧭 Trésor à ~<b>${Math.round(d/5)*5} m</b>`;
  }
  if(sc!==scoreSig){scoreSig=sc;$('score').innerHTML=sc}
  updatePadHelp();
  $('resume').style.display=(running&&document.pointerLockElement!==cv&&!invOpen&&!pad.active)?'flex':'none';
}
function renderInv(){
  $('inv-res').innerHTML=Object.entries(RES_LABEL).map(([k,l])=>`<div class="rrow"><span>${l}</span><b>${me.inv[k]||0}</b></div>`).join('')
    +`<h3>Armes</h3>`+hot().map(id=>`<div class="rrow"><span>${ITEMS[id].name}</span><span>${ITEMS[id].dmg} dmg${ITEMS[id].ranged?' · distance':''}</span></div>`).join('');
  $('recipes').innerHTML='';
  for(const r of RECIPES){
    const owned=ITEMS[r.id]&&me.tools.has(r.id);
    const ok=afford(r.cost)&&!owned;
    const div=document.createElement('div');div.className='rec'+(ok?'':' no')+(RECIPES[invSel]===r&&pad.active?' sel':'');
    const cost=Object.entries(r.cost).map(([k,v])=>`${v} ${RES_LABEL[k].toLowerCase()}`).join(', ');
    div.innerHTML=`<span><b>${r.name||ITEMS[r.id].name}</b>${r.free?'':' 🔧établi'}<br><small>${owned?'déjà possédé':cost}</small></span><button>Fabriquer</button>`;
    div.querySelector('button').onclick=()=>craft(r.id);
    $('recipes').appendChild(div);
  }
}
function toggleInv(){
  invOpen=!invOpen;$('inv').classList.toggle('hidden',!invOpen);mouseDown=false;
  if(invOpen){renderInv();document.exitPointerLock()}else{try{const p=cv.requestPointerLock();if(p&&p.catch)p.catch(()=>{})}catch(e){}}
}

// ======================= ENTRÉES =======================
addEventListener('keydown',e=>{
  if(!running)return;
  if(e.code==='Space'||e.code==='ArrowUp'||e.code==='ArrowDown'||e.code==='Tab')e.preventDefault();
  keys[e.code]=true;if(e.repeat)return;
  if(e.code==='KeyC'&&!invOpen){toggleFree();return}
  if(e.code==='KeyH'){padHelp=!padHelp;return}
  if(free)return;
  if(e.code==='Tab'||e.code==='KeyI'){toggleInv();return}
  if(e.code==='KeyB'&&!me.dead&&!me.veh){me.build=!me.build;ghostKey=''}
  else if(me.build&&e.code==='KeyR')me.bmat=me.bmat==='wood'?'stone':'wood';
  else if(e.code.startsWith('Digit')){
    const n=+e.code.slice(5)-1;
    if(me.build){if(n>=0&&n<4)me.bpiece=PKEYS[n]}
    else if(n>=0&&n<hot().length)me.slot=n;
  }
  else if(e.code==='KeyE')interact();
  else if(e.code==='KeyF')eat();
  else if(e.code==='KeyV')toggleView();
});
addEventListener('keyup',e=>{keys[e.code]=false});
document.addEventListener('mousemove',e=>{
  if(document.pointerLockElement!==cv||(me.dead&&!free))return;
  const t=free?fc:me;
  t.yaw-=e.movementX*.0022;t.pitch=clamp(t.pitch-e.movementY*.0022,-1.5,1.5);
});
addEventListener('mousedown',e=>{
  if(!running)return;
  if(document.pointerLockElement!==cv)return;
  if(e.button===0){mouseDown=true;primary()}
});
addEventListener('mouseup',e=>{if(e.button===0)mouseDown=false});
$('resume').addEventListener('click',()=>{cv.requestPointerLock()});
document.addEventListener('pointerlockchange',()=>{if(document.pointerLockElement!==cv)mouseDown=false});

// ======================= BOUCLE =======================
let last=performance.now(),last0=last,sendT=0;
function frame(){
  const n=performance.now();const dt=Math.min(.05,(n-last)/1000);last=n;
  sky.position.copy(camera.position);
  if(running)autoQuality((n-last0)/1000);last0=n;
  if(world&&world.tick)world.tick(dt);
  updateMe(dt);updateRemote(dt);updateVehicles(dt);updateEntities(dt);
  if(net.isHost)hostUpdate(dt);
  updateBuildGhost();updateTracers(dt);
  sendT+=dt;if(sendT>.066){sendT=0;sendState()}
  updateHud();
  // la boîte d'ombre est centrée devant la caméra, alignée sur des pas de 4 m pour éviter le scintillement
  const fx=Math.round((camera.position.x-Math.sin(camera.rotation.y)*40)/4)*4,fz=Math.round((camera.position.z-Math.cos(camera.rotation.y)*40)/4)*4;
  sun.target.position.set(fx,0,fz);sun.position.set(fx,0,fz).addScaledVector(SUN_DIR,350);
  renderer.render(scene,camera);
}
