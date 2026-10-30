import * as THREE from 'three';
import {FBXLoader} from 'three/addons/loaders/FBXLoader.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';

import {planks,stone,metal,fur} from './textures.js';

// matériaux texturés selon la teinte : bois veiné, pierre, métal brossé ; les animaux passent par furMat
const WOODS=new Set([0x8a5a2b,0xc9a15a,0x6b4a2b,0x7a4a1c,0x8d5a24]),STONES=new Set([0x888888]),METALS=new Set([0xb0b6bd,0xdfe6ee,0x2e2e2e,0x555555,0x333333,0x1a1a1a]);
const mats=new Map();
const mat=c=>{
  let m=mats.get(c);
  if(!m)mats.set(c,m=new THREE.MeshLambertMaterial({color:c,map:WOODS.has(c)?planks():STONES.has(c)?stone():METALS.has(c)?metal():null}));
  return m;
};
const furMat=c=>{const k='f'+c;let m=mats.get(k);if(!m)mats.set(k,m=new THREE.MeshLambertMaterial({color:c,map:fur()}));return m};
function box(w,h,d,c,x=0,y=0,z=0,m=mat(c)){const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);b.position.set(x,y,z);return b}

// ---------- objets tenus en main (orientés selon +Y ; armes à distance selon -Z)
export function itemMesh(id){
  const g=new THREE.Group();
  const wood=0x8a5a2b,stone=0x888888,iron=0xb0b6bd,steel=0xdfe6ee,dark=0x2e2e2e;
  switch(id){
    case'fist':g.add(box(.14,.14,.14,0xe0b090,0,.05,0));break;
    case'pickaxe':case'iron_pickaxe':g.add(box(.05,.8,.05,wood,0,.4,0));g.add(box(.5,.07,.07,id==='pickaxe'?stone:iron,0,.78,0));break;
    case'bat':g.add(box(.06,.8,.06,0xc9a15a,0,.4,0));g.add(box(.1,.3,.1,0xc9a15a,0,.66,0));break;
    case'spear':case'iron_spear':g.add(box(.04,1.5,.04,wood,0,.75,0));g.add(box(.09,.3,.02,id==='spear'?stone:iron,0,1.62,0));break;
    case'steel_sword':g.add(box(.05,.9,.015,steel,0,.6,0));g.add(box(.3,.05,.05,dark,0,.15,0));g.add(box(.05,.2,.05,wood,0,.02,0));break;
    case'bow':{
      g.add(box(.04,.2,.04,wood,0,.3,0));
      const a=box(.04,.4,.04,wood,.05,.58,0);a.rotation.z=-.35;g.add(a);
      const b=box(.04,.4,.04,wood,.05,.02,0);b.rotation.z=.35;g.add(b);
      g.add(box(.01,.9,.01,dark,.14,.3,0));break;
    }
    case'rifle':g.add(box(.05,.05,.7,dark,0,0,-.35));g.add(box(.07,.14,.32,wood,0,-.04,.1));g.add(box(.05,.12,.05,dark,0,-.1,-.05));break;
    default:g.add(box(.1,.1,.1,0xffffff));
  }
  return g;
}

// ---------- modèles procéduraux
function makeHuman(color){
  const g=new THREE.Group(),body=new THREE.Group();g.add(body);
  body.add(box(.5,.7,.25,color,0,1.1,0));
  body.add(box(.28,.28,.28,0xe0b090,0,1.6,0));
  const limb=(w,h,x,y,c)=>{const p=new THREE.Group();p.position.set(x,y,0);p.add(box(w,h,w,c,0,-h/2,0));body.add(p);return p};
  return{g,armL:limb(.14,.65,-.34,1.42,color),armR:limb(.14,.65,.34,1.42,color),legL:limb(.18,.75,-.13,.75,0x334466),legR:limb(.18,.75,.13,.75,0x334466)};
}
const AS={bear:{c:0x5a3a22,w:.9,h:.9,l:1.7,leg:.6},wolf:{c:0x777777,w:.4,h:.5,l:1.1,leg:.45},deer:{c:0xb08050,w:.35,h:.55,l:1,leg:.8},boar:{c:0x6b4a3a,w:.5,h:.5,l:1,leg:.35}};
// animaux : fourrure texturée, museau, oreilles, yeux, queue, plus bois du cerf et défenses du sanglier
function makeAnimal(kind){
  const s=AS[kind],g=new THREE.Group(),F=furMat(s.c),Fd=furMat(new THREE.Color(s.c).multiplyScalar(.75).getHex());
  const fb=(w,h,d,x,y,z,m=F)=>{const b=box(w,h,d,0,x,y,z,m);g.add(b);return b};
  fb(s.w,s.h,s.l,0,s.leg+s.h/2,0);
  fb(s.w*1.05,s.h*.55,s.l*.35,0,s.leg+s.h*.75,-s.l*.25); // garrot plus épais
  const hy=s.leg+s.h*.8,hz=-s.l/2-s.l*.12;
  fb(s.w*.7,s.h*.7,s.l*.3,0,hy,hz);
  const snoutL=kind==='wolf'?s.l*.22:kind==='boar'?s.l*.16:s.l*.14;
  fb(s.w*.38,s.h*.32,snoutL,0,hy-s.h*.12,hz-s.l*.15-snoutL/2,Fd);
  g.add(box(s.w*.2,s.h*.12,.03,kind==='boar'?0xc77f7f:0x1a1a1a,0,hy-s.h*.08,hz-s.l*.15-snoutL)); // truffe / groin
  for(const sx of[-1,1]){
    g.add(box(.06,.06,.03,0x111111,sx*s.w*.22,hy+s.h*.12,hz-s.l*.15-.01)); // yeux
    const ear=fb(s.w*.16,kind==='wolf'?s.h*.4:s.h*.25,.05,sx*s.w*.25,hy+s.h*.42,hz+.02,Fd);
    if(kind==='wolf')ear.rotation.z=sx*.15;
    if(kind==='boar')g.add(box(.04,.14,.04,0xf2eedc,sx*s.w*.16,hy-s.h*.15,hz-s.l*.15-snoutL*.8)); // défenses
  }
  if(kind==='deer')for(const sx of[-1,1]){
    g.add(box(.05,.45,.05,0x5a4020,sx*.1,s.leg+s.h+.32,hz+.05));
    g.add(box(.04,.22,.04,0x5a4020,sx*.2,s.leg+s.h+.5,hz+.05).rotateZ(sx*-.6));
    g.add(box(.04,.18,.04,0x5a4020,sx*.06,s.leg+s.h+.62,hz-.05).rotateX(.5));
  }
  const tl=kind==='wolf'?.45:kind==='deer'?.12:kind==='boar'?.2:.14;
  const tail=fb(kind==='wolf'?.12:.1,kind==='wolf'?.12:.1,tl,0,s.leg+s.h*.7,s.l/2+tl/2,kind==='deer'?mat(0xf2efe6):F);
  tail.rotation.x=kind==='wolf'?.5:-.3;
  const legs=[];
  for(const[x,z]of[[-1,-1],[1,-1],[-1,1],[1,1]]){
    const p=new THREE.Group();p.position.set(x*s.w*.38,s.leg,z*s.l*.38);
    p.add(box(.14,s.leg,.14,0,0,-s.leg/2,0,Fd));
    p.add(box(.16,.08,.18,0x2a2420,0,-s.leg+.04,-.02)); // sabot / patte
    g.add(p);legs.push(p);
  }
  return{g,legs};
}

// ---------- kits optionnels (Mixamo / GLB) ; si les fichiers n'existent pas -> modèles procéduraux
const HK={v:null};const AK={};
let loaded=false;
export async function loadKits(){
  if(loaded)return;loaded=true;
  try{
    const l=new FBXLoader(),base='assets/mixamo/';
    // idle.fbx contient le personnage (Crypto, avec peau) : il sert aussi de modèle
    const idle=await l.loadAsync(base+'idle.fbx');
    const scene=idle;
    const clips={idle:idle.animations[0]};
    for(const n of['walk','run','attack','shoot','stab','chop']){try{const f=await l.loadAsync(base+n+'.fbx');if(f.animations[0])clips[n]=f.animations[0]}catch(e){}}
    scene.traverse(o=>{if(o.isMesh)o.frustumCulled=false});
    HK.v={scene,clips,scale:.01,rot:Math.PI};
  }catch(e){}
  for(const k of['bear','wolf','deer','boar']){
    try{
      const gl=await new GLTFLoader().loadAsync(`assets/animals/${k}.glb`);
      const clips={};
      for(const a of gl.animations){const n=a.name.toLowerCase();for(const key of['idle','walk','run','attack','death'])if(n.includes(key)&&!clips[key])clips[key]=a}
      AK[k]={scene:gl.scene,clips,scale:1,rot:0};
    }catch(e){}
  }
}

// animation d'attaque selon l'objet tenu : fusil -> tir, lance -> coup d'estoc, pioche -> coup de pioche
function attackClip(id){
  if(id==='rifle')return'shoot';
  if(id==='spear'||id==='iron_spear')return'stab';
  if(id==='pickaxe'||id==='iron_pickaxe')return'chop';
  return'attack';
}

export function nameTag(text){
  const c=document.createElement('canvas');c.width=256;c.height=64;
  const x=c.getContext('2d');x.font='bold 34px sans-serif';x.textAlign='center';x.lineWidth=6;x.strokeStyle='#000';x.strokeText(text,128,44);x.fillStyle='#fff';x.fillText(text,128,44);
  const s=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c),transparent:true,depthTest:false}));
  s.scale.set(2,.5,1);s.renderOrder=10;return s;
}

export class Actor{
  constructor(kind,o={}){
    this.kind=kind;this.root=new THREE.Group();this.att=0;this.state='';this.itemId=null;this.held=null;this.ph=0;
    const kit=kind==='human'?HK.v:AK[kind];
    if(kit){
      this.kit=kit;
      const m=SkeletonUtils.clone(kit.scene);m.scale.setScalar(kit.scale);m.rotation.y=kit.rot;this.root.add(m);
      this.mixer=new THREE.AnimationMixer(m);this.acts={};
      for(const k in kit.clips)this.acts[k]=this.mixer.clipAction(kit.clips[k]);
      this.hand=m.getObjectByName('mixamorigRightHand')||null;
    }else{
      this.p=kind==='human'?makeHuman(o.color||0x3a6ea5):makeAnimal(kind);
      this.root.add(this.p.g);
    }
    this.root.traverse(c=>{if(c.isMesh)c.castShadow=true});
    if(o.name){const s=nameTag(o.name);s.position.y=kind==='human'?2.1:2.2;this.root.add(s)}
  }
  setItem(id){
    if(id===this.itemId)return;this.itemId=id;
    if(this.held){this.held.parent&&this.held.parent.remove(this.held);this.held=null}
    if(!id||this.kind!=='human')return;
    const m=itemMesh(id),r=id==='bow'||id==='rifle';
    if(this.p){m.position.set(0,-.62,0);m.rotation.x=r?0:-Math.PI/2;this.p.armR.add(m);this.held=m}
    else if(this.hand){m.scale.setScalar(1/this.kit.scale);m.rotation.x=r?0:-Math.PI/2;this.hand.add(m);this.held=m}
  }
  update(dt,speed,attackPulse){
    const atk=attackClip(this.itemId);
    if(attackPulse)this.att=this.acts&&this.acts[atk]?this.acts[atk].getClip().duration*.8:.35;
    this.att=Math.max(0,this.att-dt);
    const st=this.att>0?atk:speed>5.5?'run':speed>.6?'walk':'idle';
    if(this.mixer){
      if(st!==this.state){
        this.state=st;
        const fb={shoot:'attack',stab:'attack',chop:'attack',run:'walk'}[st]||'idle';
        const a=this.acts[st]||this.acts[fb]||Object.values(this.acts)[0];
        if(a&&a!==this.cur){a.reset().fadeIn(.2).play();if(this.cur)this.cur.fadeOut(.2);this.cur=a}
      }
      this.mixer.update(dt);
    }else if(this.p){
      this.ph+=dt*Math.min(speed,9)*1.6;
      const k=Math.min(1,speed/4),s=Math.sin(this.ph)*k*.9;
      if(this.kind==='human'){
        const P=this.p;P.legL.rotation.x=s;P.legR.rotation.x=-s;P.armL.rotation.x=-s;
        P.armR.rotation.x=-1.1-(this.att>0?Math.sin((this.att/.35)*Math.PI)*1.2:0);
      }else{
        const L=this.p.legs;L[0].rotation.x=s;L[3].rotation.x=s;L[1].rotation.x=-s;L[2].rotation.x=-s;
      }
    }
  }
}

export function makeBuggy(){
  const g=new THREE.Group();
  g.add(box(1.8,.45,3.2,0xd9772b,0,.65,0));
  g.add(box(1.5,.5,1.2,0x333333,0,1.1,.5));
  g.add(box(.1,.9,.1,0x555555,-.8,1.2,-.5));g.add(box(.1,.9,.1,0x555555,.8,1.2,-.5));
  for(const[x,z]of[[-1,-1.1],[1,-1.1],[-1,1.1],[1,1.1]]){
    const w=new THREE.Mesh(new THREE.CylinderGeometry(.45,.45,.35,12),mat(0x1a1a1a));w.rotation.z=Math.PI/2;w.position.set(x*1.0,.45,z);g.add(w);
  }
  return g;
}
export function makeChest(){
  const g=new THREE.Group();
  g.add(box(.9,.5,.6,0x7a4a1c,0,.25,0));g.add(box(.92,.2,.62,0x8d5a24,0,.6,0));
  g.add(box(.1,.72,.64,0xe5b93a,-.25,.36,0));g.add(box(.1,.72,.64,0xe5b93a,.25,.36,0));
  g.add(box(.12,.16,.04,0xffe27a,0,.45,.32));
  return g;
}
