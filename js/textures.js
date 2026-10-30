import * as THREE from 'three';

// Textures dessinées à la volée (aucun fichier à télécharger). Elles sont en niveaux de gris :
// la couleur de chaque objet (ou de chaque arbre instancié) vient la teinter.
const cache={};
function rnd(seed){let a=seed;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function make(key,size,draw,rx=1,ry=1){
  if(cache[key])return cache[key];
  const c=document.createElement('canvas');c.width=c.height=size;
  const x=c.getContext('2d');draw(x,size,rnd(key.length*7919+size));
  const t=new THREE.CanvasTexture(c);
  t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(rx,ry);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
  return cache[key]=t;
}
const g=v=>`rgb(${v|0},${v|0},${v|0})`;

// écorce : sillons verticaux sinueux et petites crevasses
export const bark=()=>make('bark',256,(x,S,r)=>{
  x.fillStyle=g(205);x.fillRect(0,0,S,S);
  for(let i=0;i<150;i++){
    const x0=r()*S,w=1+r()*4,v=90+r()*90;x.strokeStyle=g(v);x.lineWidth=w;x.beginPath();
    for(let y=-10;y<=S+10;y+=8){const px=x0+Math.sin(y*.05+i)*3;y<0?x.moveTo(px,y):x.lineTo(px,y)}
    x.stroke();
  }
  for(let i=0;i<60;i++){x.fillStyle=g(70+r()*40);x.fillRect(r()*S,r()*S,2+r()*6,1+r()*2)}
},1,2);

// feuillage : touffes de feuilles claires et sombres
export const leaves=()=>make('leaves',256,(x,S,r)=>{
  x.fillStyle=g(190);x.fillRect(0,0,S,S);
  for(let i=0;i<1400;i++){
    const px=r()*S,py=r()*S,v=125+r()*130;x.fillStyle=g(v);
    x.save();x.translate(px,py);x.rotate(r()*6.28);x.beginPath();x.ellipse(0,0,3+r()*5,1.5+r()*2.5,0,0,6.28);x.fill();x.restore();
  }
},2,2);

// palme : nervure centrale et folioles en épi
export const frond=()=>make('frond',128,(x,S,r)=>{
  x.fillStyle=g(170);x.fillRect(0,0,S,S);
  for(let y=0;y<S;y+=5){
    const v=120+r()*100;x.strokeStyle=g(v);x.lineWidth=2.5;
    x.beginPath();x.moveTo(S/2,y);x.lineTo(0,y+14);x.moveTo(S/2,y);x.lineTo(S,y+14);x.stroke();
  }
  x.fillStyle=g(225);x.fillRect(S/2-2,0,4,S);
},1,3);

// planches : lames horizontales, veinage, jointures et clous
export const planks=()=>make('planks',256,(x,S,r)=>{
  const n=4,h=S/n;
  for(let k=0;k<n;k++){
    const base=205+r()*45;x.fillStyle=g(base);x.fillRect(0,k*h,S,h);
    for(let i=0;i<14;i++){
      x.strokeStyle=g(base-30-r()*40);x.lineWidth=1;x.beginPath();
      const y0=k*h+r()*h,a=r()*4;
      for(let px=0;px<=S;px+=8){const py=y0+Math.sin(px*.03+a)*2;px?x.lineTo(px,py):x.moveTo(px,py)}
      x.stroke();
    }
    x.fillStyle=g(60);x.fillRect(0,k*h,S,2);
    const cut=r()*S;x.fillRect(cut,k*h,2,h);
    x.fillStyle=g(80);for(const cx of[cut+8,cut-10])for(const cy of[k*h+8,k*h+h-8]){x.beginPath();x.arc(cx,cy,2,0,6.28);x.fill()}
  }
});

// pierre : taches irrégulières et fissures
export const stone=()=>make('stone',256,(x,S,r)=>{
  x.fillStyle=g(205);x.fillRect(0,0,S,S);
  for(let i=0;i<420;i++){
    x.fillStyle=g(150+r()*100);x.beginPath();
    const px=r()*S,py=r()*S,s=4+r()*16;
    x.moveTo(px,py);for(let k=0;k<5;k++)x.lineTo(px+(r()-.5)*s*2,py+(r()-.5)*s*2);x.fill();
  }
  x.strokeStyle=g(70);x.lineWidth=1.2;
  for(let i=0;i<22;i++){let px=r()*S,py=r()*S;x.beginPath();x.moveTo(px,py);for(let k=0;k<6;k++){px+=(r()-.5)*30;py+=(r()-.5)*30;x.lineTo(px,py)}x.stroke()}
});

// métal brossé
export const metal=()=>make('metal',128,(x,S,r)=>{
  x.fillStyle=g(215);x.fillRect(0,0,S,S);
  for(let i=0;i<220;i++){x.fillStyle=g(170+r()*80);x.fillRect(0,r()*S,S,1)}
});

// fourrure : petits traits orientés
export const fur=()=>make('fur',128,(x,S,r)=>{
  x.fillStyle=g(205);x.fillRect(0,0,S,S);
  for(let i=0;i<1600;i++){
    const px=r()*S,py=r()*S,a=1.2+r()*.6,l=3+r()*5;
    x.strokeStyle=g(130+r()*125);x.lineWidth=1;x.beginPath();x.moveTo(px,py);x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l);x.stroke();
  }
});

// chaume (toits)
export const thatch=()=>make('thatch',128,(x,S,r)=>{
  x.fillStyle=g(190);x.fillRect(0,0,S,S);
  for(let i=0;i<500;i++){x.strokeStyle=g(110+r()*140);x.lineWidth=1+r();const px=r()*S,py=r()*S;x.beginPath();x.moveTo(px,py);x.lineTo(px+(r()-.5)*3,py+8+r()*10);x.stroke()}
},2,2);

// boîte dont les UV suivent la taille réelle (1 motif = 2 m) : les planches ne sont pas étirées sur un grand mur
export function boxGeo(w,h,d,tile=2){
  const geo=new THREE.BoxGeometry(w,h,d),uv=geo.attributes.uv;
  const dims=[[d,h],[d,h],[w,d],[w,d],[w,h],[w,h]];
  for(let f=0;f<6;f++)for(let k=0;k<4;k++){const i=f*4+k;uv.setXY(i,uv.getX(i)*dims[f][0]/tile,uv.getY(i)*dims[f][1]/tile)}
  return geo;
}
