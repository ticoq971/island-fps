import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

export function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const sstep=t=>t*t*(3-2*t);
function hash(ix,iz,s){let h=(Math.imul(ix,374761393)+Math.imul(iz,668265263)+Math.imul(s,1442695041))|0;h=Math.imul(h^(h>>>13),1274126177);h^=h>>>16;return(h>>>0)/4294967296}
function noise2(x,z,s){const ix=Math.floor(x),iz=Math.floor(z);const fx=sstep(x-ix),fz=sstep(z-iz);const a=hash(ix,iz,s),b=hash(ix+1,iz,s),c=hash(ix,iz+1,s),d=hash(ix+1,iz+1,s);return a+(b-a)*fx+(c-a)*fz+(a-b-c+d)*fx*fz}
function fbm(x,z,s){let v=0,a=.5,f=1;for(let i=0;i<4;i++){v+=a*noise2(x*f,z*f,s+i*17);a*=.5;f*=2}return v}

// bruit « en crêtes » : arêtes vives pour les montagnes
function ridge(x,z,s){let v=0,a=.5,f=1;for(let i=0;i<4;i++){const n=1-Math.abs(noise2(x*f,z*f,s+i*23)*2-1);v+=a*n*n;a*=.5;f*=2}return v}
export function heightAt(x,z,s){
  const d=Math.hypot(x,z)/190;
  const warp=(fbm(x*.01+50,z*.01+50,s)-.5)*.35;
  let m=1-sstep(clamp((d+warp-.45)/.4,0,1));
  // falaises : par endroits la côte monte d'un coup au lieu d'une plage en pente douce
  const ck=sstep(clamp((fbm(x*.016+31,z*.016-17,s+13)-.52)/.1,0,1));
  m=m*(1-ck)+clamp((m-.12)*5,0,1)*ck;
  const hills=fbm(x*.018,z*.018,s+3);
  const mount=Math.max(0,fbm(x*.012+200,z*.012,s+9)-.42)*2.6;
  let h=-4+m*(7+hills*8+mount*mount*60+mount*ridge(x*.022,z*.022,s+11)*30);
  // lagons : par endroits le fond remonte à ~1 m, avec des bancs de sable qui affleurent
  if(h<-.6){
    const lg=sstep(clamp((fbm(x*.012-40,z*.012+70,s+17)-.48)/.12,0,1))*(1-sstep(clamp((d+warp-.95)/.15,0,1)));
    if(lg>0)h=h*(1-lg)+(-1.15+(fbm(x*.07,z*.07,s+19)-.5)*1.8)*lg;
  }
  return h;
}
export function biomeAt(x,z,s){
  const h=heightAt(x,z,s);
  if(h<.9)return h<-.3?'water':'beach';
  if(h>15)return'rock';
  const t=z/150+(fbm(x*.012+9,z*.012+9,s+5)-.5)*.6;
  if(t<-.35)return'snow';
  if(t>.5)return'desert';
  const m=fbm(x*.03+77,z*.03+3,s+8);
  if(h<4&&m>.55)return'swamp';
  return'forest';
}

// couronne de palmier : 10 palmes effilées qui montent puis retombent
function palmCrown(){
  const parts=[];
  for(let i=0;i<8;i++){
    const P=[],I=[],S=5;
    for(let k=0;k<=S;k++){
      const t=k/S,x=t*3.8,y=.9*t-2*t*t,w=.34*(1-.75*t)+.02;
      P.push(x,y,-w,x,y+.08,0,x,y,w); // palme légèrement pliée en V
      if(k){const a=(k-1)*3,b=k*3;I.push(a,b,a+1,a+1,b,b+1,a+1,b+1,a+2,a+2,b+1,b+2)}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);
    g.rotateZ(.15+((i*7)%3)*.08);g.rotateY(i*Math.PI/4+((i*37)%5)*.06);
    parts.push(g);
  }
  const m=mergeGeometries(parts);m.computeVertexNormals();return m;
}
// feuillage en « chou-fleur » : plusieurs boules fusionnées
function blobCrown(r){
  const B=[[0,0,0,1],[.55,-.15,.2,.75],[-.5,-.1,-.35,.78],[.1,.42,-.25,.66]];
  return mergeGeometries(B.map(([x,y,z,s])=>new THREE.IcosahedronGeometry(r*s,r>3?1:0).translate(x*r,y*r,z*r)));
}
// sapin en trois étages
function pineCrown(){
  return mergeGeometries([[1.7,3,-.6],[1.3,2.6,.9],[.85,2,2.2]].map(([r,h,y])=>new THREE.ConeGeometry(r,h,8).translate(0,y,0)));
}
const STY={
  palm:{trunk:[.13,.24,5.4,7],tc:0x8a7350,tY:2.7,crown:palmCrown,cc:0x4fa23e,cY:5.3,ds:true},
  giant:{trunk:[1.1,1.9,9,8],tc:0x5a4630,tY:4.5,crown:()=>blobCrown(5.5),cc:0x2b7a30,cY:16,sy:.6},
  oak:{trunk:[.22,.34,3,6],tc:0x6b4a2b,tY:1.5,crown:()=>blobCrown(1.7),cc:0x2f7d32,cY:4.3},
  pine:{trunk:[.18,.3,3,6],tc:0x5b4026,tY:1.5,crown:pineCrown,cc:0x1f5a2d,cY:4},
  spine:{trunk:[.18,.3,3,6],tc:0x5b4026,tY:1.5,crown:pineCrown,cc:0xdde8ee,cY:4},
  dead:{trunk:[.12,.28,4.5,5],tc:0x4a4338,tY:2.2,crown:()=>new THREE.IcosahedronGeometry(.7,0),cc:0x4d5a2e,cY:4},
  cactus:{trunk:[.28,.3,2.6,7],tc:0x3d8a4a,tY:1.3,crown:()=>new THREE.SphereGeometry(.34,6,5),cc:0x3d8a4a,cY:2.6},
  rock:{trunk:null,crown:()=>new THREE.IcosahedronGeometry(1,0),cc:0x8a8a8a,cY:.5,sy:.75},
  iron:{trunk:null,crown:()=>new THREE.IcosahedronGeometry(1,0),cc:0xa8683c,cY:.5,sy:.75},
};
const HP={tree:60,rock:90,iron:110};
// fonctions GLSL communes à la mer et aux rivières : bruit et couleur du ciel reflété (même dégradé que le ciel du jeu)
const WATER_GLSL=`
float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
vec3 skyCol(vec3 d){
  float h=clamp(d.y,0.,1.);vec3 c=mix(vec3(1.,.8,.6),vec3(.5,.7,.92),smoothstep(0.,.22,h));c=mix(c,vec3(.12,.3,.66),smoothstep(.18,.85,h));
  c+=vec3(1.,.66,.3)*pow(max(dot(d,sunDir),0.),5.)*.55;return pow(c,vec3(2.2));
}`;
const SUN_DIR=new THREE.Vector3(170,70,-120).normalize();
const STEP=.7;
const PC={wood:0x9c6b3c,stone:0x8e8e8e};

function pieceBoxes(p){
  const o=[],T=.3;
  if(p.type==='floor')o.push({x:p.x,y:p.y-1.5,z:p.z,w:4,h:3,d:4});
  else if(p.type==='roof')o.push({x:p.x,y:p.y+.15,z:p.z,w:4.2,h:.3,d:4.2});
  else if(p.type==='table')o.push({x:p.x,y:p.y+.45,z:p.z,w:1.4,h:.9,d:.8});
  else{
    const ax=p.axis==='x';
    const mk=(off,len,y0,hh)=>o.push({x:p.x+(ax?off:0),y:p.y+y0+hh/2,z:p.z+(ax?0:off),w:ax?len:T,h:hh,d:ax?T:len});
    if(p.type==='wall')mk(0,4,0,3);else{mk(-1.35,1.3,0,3);mk(1.35,1.3,0,3);mk(0,1.4,2.2,.8)}
  }
  return o;
}
const pk=s=>[s.type,s.x.toFixed(1),s.y.toFixed(1),s.z.toFixed(1),s.axis||''].join('|');

export function createWorld(scene,seed){
  seed|=0;
  const W={seed,nodes:[],nodeMap:new Map(),boxes:[],pieces:[],caves:[],struct:new THREE.Group()};
  scene.add(W.struct);
  const rng=mulberry32(seed^0x9e3779b9);

  // ---- grottes (choisies sur la hauteur de base) puis terrain aplani autour
  const cand=[];
  for(let a=0;a<2500;a++){const x=(rng()-.5)*300,z=(rng()-.5)*300;const h=heightAt(x,z,seed);if(h>3)cand.push({x,z,h})}
  cand.sort((p,q)=>q.h-p.h);
  const caveList=[];
  for(const p of cand){
    if(caveList.length>=5)break;
    if(caveList.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>55)){
      let s=0,n=0;for(let i=-6;i<=6;i+=3)for(let j=-6;j<=6;j+=3){s+=heightAt(p.x+i,p.z+j,seed);n++}
      caveList.push({x:p.x,z:p.z,y0:s/n});
    }
  }
  W.caves=caveList;
  const hBase=(x,z)=>{
    let h=heightAt(x,z,seed);
    for(const c of caveList){
      const dx=x-c.x,dz=z-c.z;
      if(dx*dx+dz*dz<256){const d=Math.sqrt(dx*dx+dz*dz);const w=1-sstep(clamp((d-8)/8,0,1));h=h*(1-w)+c.y0*w}
    }
    return h;
  };
  // ---- rivières : tracées depuis les sommets en suivant la pente, puis creusées dans le terrain (lit + berges)
  const rivers=[],rgrid=new Map(),rk=(a,b)=>a*1000+b;
  {
    const tops=[];
    for(const p of cand)if(p.h>9&&!caveList.some(q=>Math.hypot(q.x-p.x,q.z-p.z)<30)&&tops.every(q=>Math.hypot(q.x-p.x,q.z-p.z)>70)){tops.push(p);if(tops.length>=3)break}
    for(const p0 of tops){
      const pts=[];let x=p0.x,z=p0.z,dx=0,dz=0,lv=1e9;
      for(let s=0;s<320;s++){
        const e=1.5,gx=(hBase(x+e,z)-hBase(x-e,z))/(2*e),gz=(hBase(x,z+e)-hBase(x,z-e))/(2*e),gl=Math.hypot(gx,gz);
        // sur le plat, la rivière file vers le large (loin du centre de l'île) au lieu de tourner en rond
        const rl=Math.hypot(x,z)||1,wg=clamp(gl/.06,0,1);
        const ndx=-gx/(gl||1)*wg+x/rl*(1-wg),ndz=-gz/(gl||1)*wg+z/rl*(1-wg);
        dx=dx*.7+ndx*.3;dz=dz*.7+ndz*.3;const dl=Math.hypot(dx,dz)||1;dx/=dl;dz/=dl;
        x+=dx*2.2;z+=dz*2.2;
        const h=hBase(x,z);lv=Math.min(lv,h-.35); // niveau de l'eau : ne remonte jamais vers l'aval
        pts.push({x,z,slope:gl,lv});
        if(h<.2||Math.hypot(x,z)>200)break;
        if(pts.length>20){const o=pts[pts.length-20];if(Math.hypot(o.x-x,o.z-z)<8)break} // bloquée : on arrête
      }
      if(pts.length<14)continue;
      pts.forEach((q,i)=>{q.w=1+i/pts.length*2.2;q.bed=q.lv-.75;const k=rk(Math.floor(q.x/8),Math.floor(q.z/8));let l=rgrid.get(k);if(!l)rgrid.set(k,l=[]);l.push(q)});
      rivers.push(pts);
    }
  }
  // point de rivière le plus proche (dans un rayon de ~16 m), ou null
  const riverNear=(x,z)=>{
    if(!rgrid.size)return null;
    const cx=Math.floor(x/8),cz=Math.floor(z/8);let best=null,bd=1e9;
    for(let a=-2;a<=2;a++)for(let b=-2;b<=2;b++){const l=rgrid.get(rk(cx+a,cz+b));if(l)for(const q of l){const d=(q.x-x)**2+(q.z-z)**2;if(d<bd){bd=d;best=q}}}
    return best?{q:best,d:Math.sqrt(bd)}:null;
  };
  const hAt=(x,z)=>{
    const h=hBase(x,z),r=riverNear(x,z);
    if(!r)return h;
    return Math.min(h,r.q.bed+Math.max(0,r.d-r.q.w*.7)*.9); // lit plat puis berges en pente
  };
  W.heightAt=hAt;W.rivers=rivers;
  W.biomeAt=(x,z)=>biomeAt(x,z,seed);

  // ---- terrain
  const N=260,SZ=400;
  const geo=new THREE.PlaneGeometry(SZ,SZ,N,N);geo.rotateX(-Math.PI/2);
  const pos=geo.attributes.position;const colA=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++)pos.setY(i,hAt(pos.getX(i),pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm=geo.attributes.normal;
  // palette : sable clair, fond turquoise puis bleu profond, jungle dense, falaises brunes, neige en altitude
  const P={sand:0xf2e2b4,wet:0xd6c38e,teal:0x1fa3a8,reef:0x3f8f78,deep:0x0a3a73,jungle:0x2c7a2a,jungleHi:0x58a23c,dry:0x7d9138,cliff:0x77695a,cliffDark:0x55504a,
    snow:0xf6f9fc,desert:0xd8b05c,swamp:0x4a6a35,cave:0x555555,white:0xffffff};
  const c=new THREE.Color(),t2=new THREE.Color();
  const mix=(a,b,t)=>c.set(a).lerp(t2.set(b),clamp(t,0,1));
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i),z=pos.getZ(i),h=pos.getY(i),ny=nrm.getY(i);
    const n=fbm(x*.15,z*.15,seed+40);
    if(h<0){
      const d=-h;
      if(d<.9)c.set(P.sand);else if(d<2.3)mix(P.sand,P.teal,(d-.9)/1.4);else mix(P.teal,P.deep,(d-2.3)/1.7);
      if(d>.4&&d<2.6&&fbm(x*.09,z*.09,seed+60)>.62)c.lerp(t2.set(P.reef),.7);
      if(d<.45)c.lerp(t2.set(P.white),(1-d/.45)*.55*(.6+n));
    }else{
      const b=biomeAt(x,z,seed);
      if(b==='beach')mix(P.wet,P.sand,h/.7);
      else if(b==='forest'){mix(P.jungle,P.jungleHi,fbm(x*.04,z*.04,seed+70)*1.6-.2);if(h>9)c.lerp(t2.set(P.dry),clamp((h-9)/8,0,.6))}
      else if(b==='swamp')c.set(P.swamp);
      else if(b==='desert')mix(P.dry,P.jungleHi,fbm(x*.05,z*.05,seed+71)); // savane dorée plutôt que désert
      else if(b==='snow')mix(P.jungle,P.dry,.25); // forêt de conifères ; la neige ne tient qu'en altitude
      else mix(P.jungle,P.cliff,clamp((h-15)/18,0,1)*.75); // montagne : jungle qui laisse place à la roche en montant
      const steep=clamp((.82-ny)/.25,0,1);
      if(steep>0)c.lerp(t2.set(n>.5?P.cliff:P.cliffDark),steep);
      const sn=clamp((h-(30+n*4))/4,0,1); // neige seulement sur les plus hauts sommets
      if(sn>0)c.lerp(t2.set(P.snow),sn*(ny>.55?1:.6));
      const rv=riverNear(x,z); // lit de galets et berges humides
      if(rv&&rv.d<rv.q.w+3)c.lerp(t2.set(rv.d<rv.q.w?0x6c6650:0x4f5a34),clamp(1-(rv.d-rv.q.w)/3,0,1)*.85);
    }
    for(const cv of caveList)if(Math.hypot(x-cv.x,z-cv.z)<8)c.set(P.cave);
    c.multiplyScalar(.92+n*.16);
    colA[i*3]=c.r;colA[i*3+1]=c.g;colA[i*3+2]=c.b;
  }
  geo.setAttribute('color',new THREE.BufferAttribute(colA,3));
  // texture de détail du sol : grain fin qui casse l'aspect lisse des couleurs
  const gc=document.createElement('canvas');gc.width=gc.height=128;
  {
    const x=gc.getContext('2d'),img=x.createImageData(128,128),gr=mulberry32(seed^0x2b1d);
    for(let i=0;i<128*128;i++){const v=200+gr()*55|0;img.data[i*4]=img.data[i*4+1]=img.data[i*4+2]=v;img.data[i*4+3]=255}
    x.putImageData(img,0,0);
  }
  const grain=new THREE.CanvasTexture(gc);grain.wrapS=grain.wrapT=THREE.RepeatWrapping;grain.repeat.set(140,140);grain.colorSpace=THREE.SRGBColorSpace;
  const ground=new THREE.Mesh(geo,new THREE.MeshLambertMaterial({vertexColors:true,map:grain}));
  ground.receiveShadow=true;ground.castShadow=true;scene.add(ground);
  // mer : shader avec la profondeur réelle (sable clair -> turquoise -> bleu profond), vagues, écume au rivage, reflets du soleil
  const DS=512,dd=new Uint8Array(DS*DS*4);
  for(let j=0;j<DS;j++)for(let i=0;i<DS;i++){
    const h=hAt(-200+(i+.5)*400/DS,-200+(j+.5)*400/DS),k=(j*DS+i)*4;
    dd[k]=clamp(-h/4,0,1)*255;dd[k+3]=255;
  }
  const depthTex=new THREE.DataTexture(dd,DS,DS,THREE.RGBAFormat);
  depthTex.magFilter=depthTex.minFilter=THREE.LinearFilter;depthTex.needsUpdate=true;
  const seaMat=new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{depthTex:{value:null},time:{value:0},sunDir:{value:new THREE.Vector3(170,70,-120).normalize()},sunCol:{value:new THREE.Color(1,.72,.42)}}]),
    transparent:true,depthWrite:false,fog:true,
    vertexShader:`varying vec3 vW;
#include <fog_pars_vertex>
void main(){vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader:`uniform sampler2D depthTex;uniform float time;uniform vec3 sunDir;uniform vec3 sunCol;varying vec3 vW;
#include <fog_pars_fragment>
${WATER_GLSL}
float waves(vec2 p){
  return n2(p*.18+vec2(time*.12,time*.07))*.45+n2(p*.45-vec2(time*.2,-time*.15))*.3
        +n2(p*1.1+vec2(-time*.45,time*.33))*.17+n2(p*2.6+vec2(time*.8,time*.6))*.08;
}
void main(){
  float dist=length(cameraPosition-vW);
  float d=texture2D(depthTex,(vW.xz+200.)/400.).r;
  vec2 p=vW.xz;float e=.2,h0=waves(p);
  float k=mix(2.4,.45,smoothstep(25.,320.,dist)); // vagues plus douces au loin : pas de scintillement
  vec3 n=normalize(vec3((h0-waves(p+vec2(e,0.)))*k,1.,(h0-waves(p+vec2(0.,e)))*k));
  vec3 V=normalize(cameraPosition-vW);
  float fres=.02+.98*pow(1.-max(dot(n,V),0.),5.);
  // couleur de l'eau selon la profondeur, lumière qui traverse les crêtes
  vec3 body=mix(vec3(.35,.85,.72),vec3(0.,.55,.6),smoothstep(0.,.3,d));
  body=mix(body,vec3(.002,.05,.17),smoothstep(.3,.9,d));
  body+=vec3(0.,.25,.2)*smoothstep(.55,.8,h0)*(1.-smoothstep(.3,.9,d))*.6;
  // caustiques : réseau lumineux mouvant sur les hauts-fonds
  vec2 cp=p*.6;float c1=1.-abs(n2(cp+time*.3)*2.-1.),c2=1.-abs(n2(cp*1.7-time*.25+5.)*2.-1.);
  float caus=pow(c1*c2,6.)*1.6*(1.-smoothstep(.05,.35,d));
  body+=vec3(.9,1.,.9)*caus;
  // reflet du ciel (dégradé du coucher de soleil) et éclat du soleil
  vec3 R=reflect(-V,n);R.y=abs(R.y);
  vec3 col=mix(body,skyCol(R),fres);
  float rs=max(dot(R,sunDir),0.);
  col+=sunCol*(pow(rs,300.)*8.+pow(rs,25.)*.3);
  // ressac : lignes d'écume qui avancent vers la plage
  float shore=1.-smoothstep(0.,.16,d);
  float bands=smoothstep(.55,1.,sin(d*55.-time*1.8+n2(p*.3)*6.)*.5+.5)*shore;
  float foam=clamp(smoothstep(.05,0.,d)*(.6+.4*n2(p*1.6+time*.5))+bands*(.35+.65*n2(p*1.2-time*.3))*.8,0.,1.);
  col=mix(col,vec3(1.),foam);
  float a=max(max(max(mix(.35,.95,smoothstep(0.,.45,d)),fres),foam),caus*.5);
  gl_FragColor=vec4(col,a);
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`
  });
  seaMat.uniforms.depthTex.value=depthTex;
  const sea=new THREE.Mesh(new THREE.PlaneGeometry(2400,2400).rotateX(-Math.PI/2),seaMat);
  sea.position.y=-.05;sea.renderOrder=1;scene.add(sea);
  // fond marin profond au-delà du terrain, pour que la mer reste bleue jusqu'à l'horizon
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(2600,2600).rotateX(-Math.PI/2),new THREE.MeshLambertMaterial({color:0x0a3a73}));
  floor.position.y=-4.3;scene.add(floor);
  // brume : sprites doux (cascades, vallées)
  const mc=document.createElement('canvas');mc.width=mc.height=64;
  {const x=mc.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,31);g.addColorStop(0,'rgba(255,250,240,.9)');g.addColorStop(1,'rgba(255,250,240,0)');x.fillStyle=g;x.fillRect(0,0,64,64)}
  const mistTex=new THREE.CanvasTexture(mc);
  const mist=(x,y,z,s,o)=>{const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:mistTex,transparent:true,opacity:o,depthWrite:false}));sp.position.set(x,y,z);sp.scale.set(s,s*.6,1);scene.add(sp)};
  // rivières : surface d'eau posée dans le lit creusé, courant animé, eaux vives et cascades dans les pentes
  const riverMat=new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{time:{value:0},sunDir:{value:SUN_DIR},sunCol:{value:new THREE.Color(1,.72,.42)}}]),
    transparent:true,depthWrite:false,fog:true,side:THREE.DoubleSide,
    vertexShader:`attribute float aSlope;varying vec2 vUv;varying float vSlope;varying vec3 vW;
#include <fog_pars_vertex>
void main(){vUv=uv;vSlope=aSlope;vec4 w=modelMatrix*vec4(position,1.);vW=w.xyz;vec4 mvPosition=viewMatrix*w;gl_Position=projectionMatrix*mvPosition;
#include <fog_vertex>
}`,
    fragmentShader:`uniform float time;uniform vec3 sunDir;uniform vec3 sunCol;varying vec2 vUv;varying float vSlope;varying vec3 vW;
#include <fog_pars_fragment>
${WATER_GLSL}
void main(){
  float sl=clamp(vSlope,0.,1.),speed=1.+sl*5.;
  vec2 q=vec2(vUv.x*2.5,vUv.y);
  float a1=n2(vec2(q.x*2.,q.y*.9-time*speed*.9)),a2=n2(vec2(q.x*5.+7.,q.y*2.2-time*speed*1.3)),a3=n2(vec2(q.x*11.+3.,q.y*5.-time*speed*1.8));
  float hh=a1*.55+a2*.3+a3*.15;
  vec3 n=normalize(vec3((a2-.5)*.5,1.,(a1-.5)*.5+(a3-.5)*.3));
  vec3 V=normalize(cameraPosition-vW);
  float fres=.02+.98*pow(1.-max(dot(n,V),0.),5.);
  float edge=min(vUv.x,1.-vUv.x);
  vec3 body=mix(vec3(.12,.42,.36),vec3(.02,.2,.2),smoothstep(.05,.45,edge));
  vec3 R=reflect(-V,n);R.y=abs(R.y);
  vec3 col=mix(body,skyCol(R),fres*.8);
  col+=sunCol*pow(max(dot(R,sunDir),0.),200.)*5.;
  float white=clamp(smoothstep(.1,.4,sl)*(.55+.45*a2)+smoothstep(.62,.8,hh)*(.25+sl)+smoothstep(.12,0.,edge)*.35*(.5+a3),0.,1.);
  col=mix(col,vec3(.95,.98,1.),white);
  gl_FragColor=vec4(col,smoothstep(0.,.08,edge)*mix(.82,.97,white));
#include <tonemapping_fragment>
#include <colorspace_fragment>
#include <fog_fragment>
}`
  });
  const clearR=[];
  for(const pts of rivers){
    const P2=[],U2=[],S2=[],I2=[];let len=0;
    pts.forEach((p,i)=>{
      const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)];
      let tx=b.x-a.x,tz=b.z-a.z;const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
      const w=p.w+1.5; // la surface dépasse un peu sous les berges, pour ne pas laisser de bord visible
      if(i>0)len+=Math.hypot(p.x-pts[i-1].x,p.z-pts[i-1].z);
      for(const sd of[-1,1]){
        const vx=p.x-tz*w*sd,vz=p.z+tx*w*sd;
        P2.push(vx,Math.min(p.lv,hAt(vx,vz)+.05),vz);U2.push(sd<0?0:1,len/6);S2.push(clamp((p.slope-.08)*1.6,0,1));
      }
      if(i>0){const k=i*2;I2.push(k-2,k-1,k,k-1,k+1,k)}
      clearR.push({x:p.x,z:p.z,r:p.w+2.5});
      if(p.slope>.3&&i%3===0)mist(p.x,p.lv+2,p.z,9,.35);
    });
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(P2,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(U2,2));g.setAttribute('aSlope',new THREE.Float32BufferAttribute(S2,1));
    g.setIndex(I2);
    const m=new THREE.Mesh(g,riverMat);m.frustumCulled=false;m.renderOrder=2;scene.add(m);
    const e=pts[pts.length-1];mist(e.x,1.4,e.z,14,.3);
  }
  // brume basse au-dessus de la canopée
  for(let a=0,n=0;a<400&&n<34;a++){
    const x=(rng()-.5)*340,z=(rng()-.5)*340,h=hAt(x,z);
    if(h>1&&h<10){mist(x,h+10+rng()*6,z,28+rng()*20,.13);n++}
  }

  // ---- boîtes de collision / structures
  function addBox(x,y,z,w,h,d,color,walk){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshLambertMaterial({color}));
    m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;W.struct.add(m);
    W.boxes.push({minx:x-w/2,maxx:x+w/2,miny:y-h/2,maxy:y+h/2,minz:z-d/2,maxz:z+d/2,walk});
  }

  // ---- éléments à placer (arbres, rochers, minerai)
  const items=[];
  const addItem=(kind,style,x,y,z,s,r)=>items.push({kind,style,x,y,z,s,r,rot:rng()*6.28});
  const nearCave=(x,z)=>caveList.some(q=>Math.hypot(q.x-x,q.z-z)<14);
  const inClear=(x,z)=>{for(const p of clearR){const dx=p.x-x,dz=p.z-z;if(dx*dx+dz*dz<p.r*p.r)return true}return false};

  // ---- constructions décoratives : cabanes, tours de guet, pontons, rochers en mer, arche
  const addColl=(x,y,z,w,h,d)=>W.boxes.push({minx:x-w/2,maxx:x+w/2,miny:y-h/2,maxy:y+h/2,minz:z-d/2,maxz:z+d/2,walk:true});
  const WOOD=0x8b6a45,WOOD2=0x6e4f30,THATCH=0xa6894a;
  const placed=[];
  const flat=(x,z,r)=>{let lo=1e9,hi=-1e9;for(const[i,j]of[[-r,-r],[r,-r],[-r,r],[r,r],[0,0]]){const h=hAt(x+i,z+j);lo=Math.min(lo,h);hi=Math.max(hi,h)}return{lo,hi}};
  const coastNear=(x,z)=>{for(let a=0;a<8;a++){const an=a*Math.PI/4;if(hAt(x+Math.cos(an)*22,z+Math.sin(an)*22)<.2)return true}return false};
  const free=(x,z,d)=>placed.every(p=>Math.hypot(p.x-x,p.z-z)>d)&&!caveList.some(q=>Math.hypot(q.x-x,q.z-z)<24)&&!inClear(x,z);
  const roofMat=new THREE.MeshLambertMaterial({color:THATCH});
  function hut(cx,cz){
    const y=flat(cx,cz,2.6).hi+.15;
    addBox(cx,y-1.5,cz,4.6,3,4.6,WOOD2,true);
    addBox(cx,y+1.3,cz-2.1,4.4,2.6,.25,WOOD,true);
    addBox(cx-2.1,y+1.3,cz,.25,2.6,4.2,WOOD,true);addBox(cx+2.1,y+1.3,cz,.25,2.6,4.2,WOOD,true);
    addBox(cx-1.45,y+1.3,cz+2.1,1.5,2.6,.25,WOOD,true);addBox(cx+1.45,y+1.3,cz+2.1,1.5,2.6,.25,WOOD,true);addBox(cx,y+2.3,cz+2.1,1.4,.6,.25,WOOD,true);
    const r=new THREE.Mesh(new THREE.ConeGeometry(3.7,1.9,4),roofMat);r.rotation.y=Math.PI/4;r.position.set(cx,y+3.55,cz);W.struct.add(r);
    placed.push({x:cx,z:cz});clearR.push({x:cx,z:cz,r:5});
  }
  function tower(cx,cz){
    const y=flat(cx,cz,2).hi+.1;
    for(const sx of[-1.7,1.7])for(const sz of[-1.7,1.7])addBox(cx+sx,y+3,cz+sz,.4,8,.4,WOOD2,true);
    addBox(cx,y+7.15,cz,4.6,.3,4.6,WOOD,true);
    addBox(cx-2.15,y+7.75,cz,.15,.9,4.6,WOOD,true);addBox(cx,y+7.75,cz-2.15,4.6,.9,.15,WOOD,true);addBox(cx,y+7.75,cz+2.15,4.6,.9,.15,WOOD,true);
    for(const sx of[-2,2])for(const sz of[-2,2])addBox(cx+sx,y+8.65,cz+sz,.2,2.7,.2,WOOD2,true);
    const r=new THREE.Mesh(new THREE.ConeGeometry(3.7,1.8,4),roofMat);r.rotation.y=Math.PI/4;r.position.set(cx,y+10.35,cz);W.struct.add(r);
    for(let i=0;i<12;i++){ // escalier : marches de .6 m, franchissables à pied
      const top=y+.6*(i+1),bot=y-1.5,x=cx+2.6+(11-i)*.8;
      addBox(x,(top+bot)/2,cz,.8,top-bot,1.6,WOOD,true);
    }
    placed.push({x:cx,z:cz});
    for(let i=0;i<5;i++)clearR.push({x:cx+i*2.5,z:cz,r:3.5});
  }
  function pier(){
    for(let a=0;a<600;a++){
      const x=(rng()-.5)*380,z=(rng()-.5)*380,h=hAt(x,z);
      if(h<.3||h>1.6||biomeAt(x,z,seed)!=='beach'||!free(x,z,30))continue;
      const[dx,dz]=[[1,0],[-1,0],[0,1],[0,-1]][Math.floor(rng()*4)];
      let ts=-1;for(let t=0;t<30;t+=1.5)if(hAt(x+dx*t,z+dz*t)<.1){ts=t;break}
      if(ts<0||ts>14||hAt(x+dx*(ts+16),z+dz*(ts+16))>-.4)continue;
      const s0=ts-1.5,cx=x+dx*(s0+8),cz=z+dz*(s0+8),ax=dx!==0;
      addBox(cx,.4,cz,ax?16:2.2,.2,ax?2.2:16,WOOD,true);
      for(let t=1;t<=15;t+=4)for(const sd of[-1,1]){const px=x+dx*(s0+t)-dz*sd,pz=z+dz*(s0+t)+dx*sd;addBox(px,-1.5,pz,.3,4,.3,WOOD2,true)}
      placed.push({x,z});clearR.push({x,z,r:6});return;
    }
  }
  const rockMat=new THREE.MeshLambertMaterial({color:0xb3a690,emissive:0x2a241c,flatShading:true}),mossMat=new THREE.MeshLambertMaterial({color:0x3d7a32,flatShading:true});
  function rockCyl(rt,rb,hgt,x,y,z){
    const g=new THREE.CylinderGeometry(rt,rb,hgt,7,2),p=g.attributes.position;
    for(let i=0;i<p.count;i++){p.setX(i,p.getX(i)+(rng()-.5)*rb*.35);p.setZ(i,p.getZ(i)+(rng()-.5)*rb*.35)}
    g.computeVertexNormals();const m=new THREE.Mesh(g,rockMat);m.position.set(x,y,z);W.struct.add(m);return m;
  }
  function stack(x,z,hgt,rad){
    rockCyl(rad*.7,rad*1.1,hgt,x,hgt/2-3,z);
    const cap=new THREE.Mesh(new THREE.SphereGeometry(rad*.8,7,5),mossMat);cap.scale.y=.4;cap.position.set(x,hgt-3.05,z);W.struct.add(cap);
    addColl(x,hgt/2-3,z,rad*1.5,hgt,rad*1.5);
  }
  function arch(x,z){
    for(const sx of[-2.8,2.8]){rockCyl(1.1,1.5,6.5,x+sx,.25,z);addColl(x+sx,.25,z,2.2,6.5,2.2)}
    const t=new THREE.Mesh(new THREE.TorusGeometry(2.8,.9,6,14,Math.PI),rockMat);t.position.set(x,3.5,z);W.struct.add(t);
    addColl(x,6.2,z,6.4,2,2);
  }
  for(let a=0,n=0;a<500&&n<5;a++){
    const x=(rng()-.5)*340,z=(rng()-.5)*340,h=hAt(x,z),f=flat(x,z,3);
    if(h<1.6||h>4||biomeAt(x,z,seed)!=='forest'||f.hi-f.lo>.7||!coastNear(x,z)||!free(x,z,38))continue;
    hut(x,z);n++;
  }
  for(let a=0,n=0;a<600&&n<2;a++){
    const x=(rng()-.5)*340,z=(rng()-.5)*340,h=hAt(x,z),f=flat(x,z,2.4);
    if(h<2||h>9||f.hi-f.lo>.6||biomeAt(x,z,seed)==='rock'||!free(x,z,60))continue;
    tower(x,z);n++;
  }
  pier();pier();
  {
    const st=[];
    for(let a=0;a<900&&st.length<16;a++){
      const x=(rng()-.5)*420,z=(rng()-.5)*420,h=hAt(x,z);
      if(h>-1.6||h<-3.7||Math.hypot(x,z)>200||st.some(p=>Math.hypot(p.x-x,p.z-z)<16))continue;
      st.push({x,z});stack(x,z,6+rng()*10,1.6+rng()*1.8);
    }
    for(let a=0;a<900;a++){
      const x=(rng()-.5)*380,z=(rng()-.5)*380,h=hAt(x,z);
      if(h>-.5||h<-1.4||!coastNear(x,z)||!free(x,z,40)||st.some(p=>Math.hypot(p.x-x,p.z-z)<12))continue;
      arch(x,z);placed.push({x,z});break;
    }
  }

  const occ=new Set();let treeN=0;
  const PT={forest:.75,snow:.7,swamp:.3,desert:.12,rock:.3,beach:.25,water:0};
  for(let a=0;a<34000&&treeN<3600;a++){
    const x=(rng()-.5)*380,z=(rng()-.5)*380;const h=hAt(x,z);
    if(h<.35)continue;
    const b=biomeAt(x,z,seed);
    if(rng()>PT[b])continue;
    if(nearCave(x,z)||inClear(x,z))continue;
    const k=Math.round(x/2.4)+','+Math.round(z/2.4);
    if(occ.has(k))continue;occ.add(k);
    // île tropicale : palmiers sur la côte, jungle de feuillus partout ailleurs, quelques conifères seulement près des sommets
    const r=rng();
    const style=b==='desert'||b==='beach'?'palm':b==='swamp'?'dead':h<4?(r<.6?'palm':'oak'):h>14?(r<.3?'pine':'oak'):(r<.15?'palm':'oak');
    addItem('tree',style,x,h,z,.8+rng()*.6,style==='palm'?.4:.55);treeN++;
  }
  for(let a=0,n=0;a<2500&&n<14;a++){ // arbres géants de la jungle
    const x=(rng()-.5)*300,z=(rng()-.5)*300,h=hAt(x,z);
    if(h<2||h>8||biomeAt(x,z,seed)!=='forest'||nearCave(x,z)||inClear(x,z))continue;
    addItem('tree','giant',x,h,z,1,2.2);clearR.push({x,z,r:5});n++;
  }
  const bushPos=[];
  for(let a=0;a<9000&&bushPos.length<1800;a++){
    const x=(rng()-.5)*380,z=(rng()-.5)*380,h=hAt(x,z);
    if(h<1||h>14||biomeAt(x,z,seed)!=='forest'||nearCave(x,z)||inClear(x,z))continue;
    bushPos.push({x,z,h,s:.6+rng()*.9});
  }
  let rockN=0,ironN=0;
  for(let a=0;a<8000&&(rockN<260||ironN<40);a++){
    const x=(rng()-.5)*380,z=(rng()-.5)*380;const h=hAt(x,z);
    if(h<.9||nearCave(x,z)||inClear(x,z))continue;
    const b=biomeAt(x,z,seed);
    if(b==='rock'&&ironN<40&&rng()<.05){const s=.7+rng()*.7;addItem('iron','iron',x,h,z,s,s*.9);ironN++;continue}
    if(rockN<260&&rng()<(b==='rock'?.12:.012)){const s=.7+rng()*1.1;addItem('rock','rock',x,h,z,s,s*.95);rockN++}
  }

  // ---- grottes : murs, toit, lumière, minerai
  for(const cv of caveList){
    const cx=cv.x,cz=cv.z,y0=cv.y0;
    const dirs=[[0,1],[1,0],[0,-1],[-1,0]];let k=0,best=1e9;
    dirs.forEach((d,i)=>{const hh=heightAt(cx+d[0]*9,cz+d[1]*9,seed);if(hh<best){best=hh;k=i}});
    const T=(lx,lz)=>k===0?[lx,lz]:k===1?[lz,-lx]:k===2?[-lx,-lz]:[-lz,lx];
    const add=(lx,lz,w,d,yb,hh)=>{const[dx,dz]=T(lx,lz);const odd=k%2===1;addBox(cx+dx,yb+hh/2,cz+dz,odd?d:w,hh,odd?w:d,0x7f7262,true)};
    add(0,-5,10,1,y0-2,6.5);add(-5,0,1,10,y0-2,6.5);add(5,0,1,10,y0-2,6.5);
    add(-3.25,5,3.5,1,y0-2,6.5);add(3.25,5,3.5,1,y0-2,6.5);
    add(0,0,11,11,y0+4.5,1);
    // habillage rocheux : gros blocs autour et par-dessus pour que la grotte ressemble à un rocher, pas à une boîte
    rockCyl(6.2,7.4,3,cx,y0+5.6,cz);
    for(const[lx,lz,r,h]of[[-5.6,-5.6,2.4,6],[5.6,-5.6,2.6,7],[-6.2,1.5,2.2,5.5],[6.2,1.5,2.3,6],[0,-6.6,2.8,7.5],[-5,5.4,1.6,5],[5,5.4,1.7,5.2]]){
      const[dx,dz]=T(lx,lz);rockCyl(r*.7,r,h,cx+dx,y0-2+h/2,cz+dz);
    }
    const L=new THREE.PointLight(0xffd7a0,50,18,2);L.position.set(cx,y0+2.5,cz);scene.add(L);
    for(const[lx,lz]of[[-3,-3],[3,-3.5],[-3.5,.5]]){const[dx,dz]=T(lx,lz);addItem('iron','iron',cx+dx,hAt(cx+dx,cz+dz),cz+dz,.9,.85)}
  }

  // ---- instanciation
  const grid=new Map();const gk=(a,b)=>(a+64)*128+(b+64);
  const gridAdd=n=>{const key=gk(Math.floor(n.x/8),Math.floor(n.z/8));let l=grid.get(key);if(!l)grid.set(key,l=[]);l.push(n)};
  const groups={};for(const it of items)(groups[it.style]||(groups[it.style]=[])).push(it);
  const Z=new THREE.Matrix4().makeScale(0,0,0);
  const q=new THREE.Quaternion(),m4=new THREE.Matrix4(),v=new THREE.Vector3(),sc=new THREE.Vector3(),col=new THREE.Color(),UP=new THREE.Vector3(0,1,0);
  let id=0;
  // découpage en carrés de 50 m : seules les zones visibles (et proches pour les ombres) sont dessinées
  for(const[style,list]of Object.entries(groups)){
    const D=STY[style];
    const tg=D.trunk?new THREE.CylinderGeometry(...D.trunk).translate(0,D.tY,0):null,tm=new THREE.MeshLambertMaterial();
    const cg=D.crown().translate(0,D.cY,0),cm=new THREE.MeshLambertMaterial({side:D.ds?THREE.DoubleSide:THREE.FrontSide});
    const chunks=new Map();
    for(const it of list){const k=Math.floor(it.x/50)+','+Math.floor(it.z/50);let c=chunks.get(k);if(!c)chunks.set(k,c=[]);c.push(it)}
    for(const sub of chunks.values()){
      const meshes=[];
      if(tg)meshes.push({m:new THREE.InstancedMesh(tg,tm,sub.length),c:D.tc,y:1});
      meshes.push({m:new THREE.InstancedMesh(cg,cm,sub.length),c:D.cc,y:D.sy||1});
      sub.forEach((it,i)=>{
        const node={id:id++,kind:it.kind,x:it.x,y:it.y,z:it.z,r:it.r,hp:HP[it.kind],alive:true,parts:[]};
        q.setFromAxisAngle(UP,it.rot);
        for(const M of meshes){
          v.set(it.x,it.y,it.z);sc.set(it.s,it.s*M.y,it.s);m4.compose(v,q,sc);
          M.m.setMatrixAt(i,m4);col.set(M.c).multiplyScalar(.85+rng()*.3);M.m.setColorAt(i,col);
          node.parts.push({m:M.m,i});
        }
        W.nodes.push(node);W.nodeMap.set(node.id,node);gridAdd(node);
      });
      for(const M of meshes){
        M.m.instanceMatrix.needsUpdate=true;if(M.m.instanceColor)M.m.instanceColor.needsUpdate=true;
        M.m.computeBoundingSphere();M.m.castShadow=M.m.receiveShadow=true;scene.add(M.m);
      }
    }
  }
  {
    const bm=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.6,0),new THREE.MeshLambertMaterial(),bushPos.length);
    bushPos.forEach((b,i)=>{
      v.set(b.x,b.h+.25,b.z);sc.set(b.s,b.s*.7,b.s);q.setFromAxisAngle(UP,rng()*6.28);m4.compose(v,q,sc);bm.setMatrixAt(i,m4);
      col.set(rng()<.5?0x2e7d32:0x58a03a).multiplyScalar(.8+rng()*.4);bm.setColorAt(i,col);
    });
    bm.instanceMatrix.needsUpdate=true;if(bm.instanceColor)bm.instanceColor.needsUpdate=true;bm.frustumCulled=false;bm.castShadow=bm.receiveShadow=true;scene.add(bm);
  }
  W.struct.traverse(o=>{if(o.isMesh)o.castShadow=o.receiveShadow=true});
  W.tick=dt=>{seaMat.uniforms.time.value+=dt;riverMat.uniforms.time.value+=dt};
  W.removeNode=nid=>{const n=W.nodeMap.get(nid);if(!n||!n.alive)return null;n.alive=false;for(const p of n.parts){p.m.setMatrixAt(p.i,Z);p.m.instanceMatrix.needsUpdate=true}return n};
  W.nearNodes=(x,z,rad,fn)=>{
    const x0=Math.floor((x-rad)/8),x1=Math.floor((x+rad)/8),z0=Math.floor((z-rad)/8),z1=Math.floor((z+rad)/8);
    for(let a=x0;a<=x1;a++)for(let b=z0;b<=z1;b++){const l=grid.get(gk(a,b));if(l)for(const n of l)fn(n)}
  };

  // ---- collisions et sol
  W.collide=(p,r,feet)=>{
    W.nearNodes(p.x,p.z,r+2,n=>{
      if(!n.alive)return;
      const dx=p.x-n.x,dz=p.z-n.z,m=r+n.r,d2=dx*dx+dz*dz;
      if(d2<m*m){const d=Math.sqrt(d2)||1e-3;p.x=n.x+dx/d*m;p.z=n.z+dz/d*m}
    });
    for(const b of W.boxes){
      if(p.x<b.minx-r||p.x>b.maxx+r||p.z<b.minz-r||p.z>b.maxz+r)continue;
      if(feet>=b.maxy-STEP||feet+1.8<=b.miny)continue;
      const cx=clamp(p.x,b.minx,b.maxx),cz=clamp(p.z,b.minz,b.maxz);
      const dx=p.x-cx,dz=p.z-cz,d2=dx*dx+dz*dz;
      if(d2>=r*r)continue;
      if(d2>0){const d=Math.sqrt(d2);p.x=cx+dx/d*r;p.z=cz+dz/d*r}
      else{
        const l=p.x-b.minx,rr=b.maxx-p.x,t=p.z-b.minz,bt=b.maxz-p.z,m=Math.min(l,rr,t,bt);
        if(m===l)p.x=b.minx-r;else if(m===rr)p.x=b.maxx+r;else if(m===t)p.z=b.minz-r;else p.z=b.maxz+r;
      }
    }
    const rad=Math.hypot(p.x,p.z);if(rad>205){p.x*=205/rad;p.z*=205/rad}
  };
  W.groundAt=(x,z,feet)=>{
    let g=hAt(x,z);
    for(const b of W.boxes){if(x<b.minx||x>b.maxx||z<b.minz||z>b.maxz)continue;if(b.maxy-feet<=STEP&&b.maxy>g)g=b.maxy}
    return Math.max(g,-1.2);
  };

  // ---- rayons
  const ray=new THREE.Raycaster();
  W.terrainRay=(o,d,max)=>{
    let prev=0;
    for(let t=.5;t<=max;t+=.5){
      if(o.y+d.y*t<hAt(o.x+d.x*t,o.z+d.z*t)){
        let a=prev,b=t;
        for(let i=0;i<6;i++){const m=(a+b)/2;if(o.y+d.y*m<hAt(o.x+d.x*m,o.z+d.z*m))b=m;else a=m}
        return b;
      }
      prev=t;
    }
    return Infinity;
  };
  W.rayWorld=(o,d,max)=>{
    let t=W.terrainRay(o,d,max);
    ray.set(o,d);ray.far=max;
    const h=ray.intersectObjects(W.struct.children,false)[0];
    if(h&&h.distance<t)t=h.distance;
    return isFinite(t)?{t,point:new THREE.Vector3().copy(o).addScaledVector(d,t)}:null;
  };

  // ---- construction
  const floors=new Map(),pkeys=new Set();
  W.hasPiece=s=>pkeys.has(pk(s));
  W.addPiece=s=>{
    if(pkeys.has(pk(s)))return false;
    pkeys.add(pk(s));W.pieces.push(s);
    for(const b of pieceBoxes(s))addBox(b.x,b.y,b.z,b.w,b.h,b.d,s.type==='table'?0x7a4f2a:PC[s.mat||'wood'],true);
    if(s.type==='floor')floors.set(s.x+','+s.z,s.y);
    return true;
  };
  W.ghost=(s,ok)=>{
    const g=new THREE.Group();
    const mat=new THREE.MeshBasicMaterial({color:ok?0x44ff66:0xff4444,transparent:true,opacity:.45,depthWrite:false});
    for(const b of pieceBoxes(s)){const m=new THREE.Mesh(new THREE.BoxGeometry(b.w,b.h,b.d),mat);m.position.set(b.x,b.y,b.z);g.add(m)}
    return g;
  };
  W.snap=(type,hit)=>{
    const cx=Math.round(hit.x/4)*4,cz=Math.round(hit.z/4)*4;
    const floorAt=(x,z)=>floors.get(x+','+z);
    const tmax=(x,z,hw)=>{let m=-99;for(const[i,j]of[[-hw,-hw],[hw,-hw],[-hw,hw],[hw,hw],[0,0]])m=Math.max(m,hAt(x+i,z+j));return m};
    const neigh=(x,z)=>{for(const[i,j]of[[4,0],[-4,0],[0,4],[0,-4]]){const f=floorAt(x+i,z+j);if(f!==undefined)return f}return undefined};
    if(type==='floor')return{type,x:cx,y:neigh(cx,cz)??(tmax(cx,cz,2)+.1),z:cz};
    if(type==='roof'){
      const f=floorAt(cx,cz)??neigh(cx,cz)??(tmax(cx,cz,2)+.1);
      const lvl=clamp(Math.floor((hit.y-f)/3),0,2);
      return{type,x:cx,y:f+3*(lvl+1),z:cz};
    }
    if(type==='table')return{type,x:hit.x,y:hit.y,z:hit.z};
    const dx=hit.x-cx,dz=hit.z-cz;let ex,ez,ax,nx,nz;
    if(Math.abs(dx)>Math.abs(dz)){const s=Math.sign(dx)||1;ex=cx+s*2;ez=cz;ax='z';nx=cx+s*4;nz=cz}
    else{const s=Math.sign(dz)||1;ex=cx;ez=cz+s*2;ax='x';nx=cx;nz=cz+s*4}
    let base=floorAt(cx,cz)??floorAt(nx,nz);
    if(base===undefined){base=-99;for(const o of[-2,0,2])base=Math.max(base,ax==='x'?hAt(ex+o,ez):hAt(ex,ez+o))}
    const lvl=clamp(Math.floor((hit.y-base)/3),0,2);
    return{type,x:ex,y:base+lvl*3,z:ez,axis:ax};
  };
  W.nearTable=(x,z,r=6)=>W.pieces.some(p=>p.type==='table'&&Math.hypot(p.x-x,p.z-z)<r);

  // ---- points de spawn
  W.spawnPoint=i=>{
    const a=i*Math.PI+.5;
    for(let r=195;r>20;r-=3){
      const x=Math.cos(a)*r,z=Math.sin(a)*r;
      if(hAt(x,z)>1.4&&biomeAt(x,z,seed)!=='rock'){const rr=Math.max(r-8,0);return{x:Math.cos(a)*rr,z:Math.sin(a)*rr}}
    }
    return{x:0,z:0};
  };
  W.randLand=(rnd,pred)=>{
    for(let k=0;k<300;k++){const x=(rnd()-.5)*300,z=(rnd()-.5)*300,h=hAt(x,z);if(h>1.2&&(!pred||pred(x,z,h)))return{x,z}}
    return{x:0,z:0};
  };
  return W;
}
