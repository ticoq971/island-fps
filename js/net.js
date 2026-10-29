// Réseau pair-à-pair (WebRTC via PeerJS). Aucun serveur de jeu : l'hôte fait office d'autorité.
const ALPHA='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export class Net{
  constructor(){
    this.peer=null;this.conns=new Map();this.hostConn=null;this.isHost=false;this.id=null;this.code=null;
    this.onmsg=()=>{};this.onpeer=()=>{};this.onleave=()=>{};this.onclose=()=>{};
  }
  _open(id){
    return new Promise((res,rej)=>{
      const p=id?new Peer(id):new Peer();
      p.on('open',()=>{this.peer=p;this.id=p.id;res()});
      p.on('error',e=>{rej(e);console.warn('peer error',e)});
    });
  }
  solo(){this.isHost=true;this.id='solo';this.code=null}
  async host(){
    for(let i=0;i<6;i++){
      const code=Array.from({length:5},()=>ALPHA[Math.random()*ALPHA.length|0]).join('');
      try{await this._open('isle-'+code)}catch(e){if(e.type==='unavailable-id')continue;throw e}
      this.isHost=true;this.code=code;
      this.peer.on('connection',conn=>{
        conn.on('open',()=>{this.conns.set(conn.peer,conn);this.onpeer(conn.peer)});
        conn.on('data',m=>this._recv(conn.peer,m));
        conn.on('close',()=>{this.conns.delete(conn.peer);this.onleave(conn.peer)});
      });
      return code;
    }
    throw new Error('Impossible de créer le code');
  }
  async join(code){
    await this._open(null);
    return new Promise((res,rej)=>{
      const conn=this.peer.connect('isle-'+code.trim().toUpperCase(),{reliable:true});
      const to=setTimeout(()=>rej(new Error('Délai dépassé : code invalide ou hôte injoignable')),12000);
      conn.on('open',()=>{clearTimeout(to);this.hostConn=conn;res()});
      conn.on('data',m=>this._recv(conn.peer,m));
      conn.on('close',()=>this.onclose());
      conn.on('error',e=>{clearTimeout(to);rej(e)});
    });
  }
  _recv(from,m){
    if(this.isHost&&m.relay){for(const[id,c]of this.conns)if(id!==from&&c.open)c.send(m)}
    this.onmsg(from,m);
  }
  // diffusion à tous les autres (l'appelant applique l'effet localement lui-même)
  bcast(m){
    if(this.isHost){for(const c of this.conns.values())if(c.open)c.send(m)}
    else if(this.hostConn&&this.hostConn.open)this.hostConn.send({...m,relay:1});
  }
  // message vers l'hôte (si on est l'hôte, traité localement)
  toHost(m){
    if(this.isHost)this.onmsg(this.id,m);
    else if(this.hostConn&&this.hostConn.open)this.hostConn.send(m);
  }
  // message ciblé (depuis l'hôte)
  sendTo(id,m){
    if(id===this.id){this.onmsg(this.id,m);return}
    const c=this.conns.get(id);if(c&&c.open)c.send(m);
  }
}
