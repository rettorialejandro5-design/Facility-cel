/* Facility CEL: sincroniza localStorage con Supabase (login + RLS). Sin config válida, la app funciona como antes. */
(function(){
  var CFG={url:"__SUPABASE_URL__",anon:"__SUPABASE_ANON_KEY__"};
  if(/__SUPABASE/.test(CFG.url+CFG.anon)){console.warn("[CEL] Supabase sin configurar: datos solo locales.");return;}
  var LS=window.localStorage,P=Storage.prototype,rawSet=P.setItem,rawRemove=P.removeItem,rawGet=P.getItem;
  var SKIP=function(k){return String(k).indexOf("sb_")===0;};
  function sess(){try{return JSON.parse(rawGet.call(LS,"sb_session")||"null");}catch(e){return null;}}
  function saveSess(s){s.expires_at=s.expires_at||Math.floor(Date.now()/1000)+s.expires_in;rawSet.call(LS,"sb_session",JSON.stringify(s));}
  function xhr(method,path,body,token,sync,extra){
    var x=new XMLHttpRequest();x.open(method,CFG.url+path,!sync);
    x.setRequestHeader("apikey",CFG.anon);x.setRequestHeader("Content-Type","application/json");
    if(token)x.setRequestHeader("Authorization","Bearer "+token);
    for(var h in (extra||{}))x.setRequestHeader(h,extra[h]);
    return x;
  }
  function uid(t){try{return JSON.parse(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/"))).sub;}catch(e){return null;}}
  // --- sesión: refrescar si vence ---
  var s=sess();
  if(s&&s.expires_at-60<Date.now()/1000&&s.refresh_token){
    try{var r=xhr("POST","/auth/v1/token?grant_type=refresh_token",null,null,true);r.send(JSON.stringify({refresh_token:s.refresh_token}));
      if(r.status===200){s=JSON.parse(r.responseText);saveSess(s);}else s=null;}catch(e){s=null;}
  }
  if(!s||!s.access_token){showLogin();return;}
  var token=s.access_token,user=uid(token);
  // --- hidratar desde Supabase (sincrónico, antes de que corra la app) ---
  var remote=null;
  try{var g=xhr("GET","/rest/v1/kv_store?select=key,value",null,token,true);g.send();
    if(g.status===200)remote=JSON.parse(g.responseText);else if(g.status===401){rawRemove.call(LS,"sb_session");showLogin();return;}}catch(e){}
  var bootstrap=[];
  if(remote){
    var have={};remote.forEach(function(r){have[r.key]=1;if(r.value===null)rawRemove.call(LS,r.key);else rawSet.call(LS,r.key,r.value);});
    for(var i=0;i<LS.length;i++){var k=LS.key(i);if(!SKIP(k)&&!have[k])bootstrap.push(k);} // migra lo que ya había en este navegador
  }
  // --- escritura diferida con reintento ---
  var pending={},timer=null,badge;
  function ui(t,bad){if(!badge){badge=document.createElement("div");badge.style.cssText="position:fixed;left:10px;bottom:10px;z-index:100001;font:12px Arial;padding:5px 9px;border-radius:12px;color:#fff;opacity:.9";
    (document.body||document.documentElement).appendChild(badge);document.addEventListener("DOMContentLoaded",function(){document.body.appendChild(badge);});}
    badge.textContent=t;badge.style.background=bad?"#dc5b63":"#1aa47a";}
  function flush(){
    timer=null;var keys=Object.keys(pending);if(!keys.length)return;
    var rows=keys.map(function(k){return{user_id:user,key:k,value:pending[k],updated_at:new Date().toISOString()};});
    var snap=pending;pending={};
    var x=xhr("POST","/rest/v1/kv_store?on_conflict=user_id,key",null,token,false,{Prefer:"resolution=merge-duplicates,return=minimal"});
    x.onload=function(){if(x.status>=200&&x.status<300)ui("☁ Guardado en la nube");else fail(snap,x.status);};
    x.onerror=function(){fail(snap);};x.send(JSON.stringify(rows));ui("☁ Guardando…");
  }
  function fail(snap,st){for(var k in snap)if(!(k in pending))pending[k]=snap[k];ui("⚠ Sin guardar en la nube"+(st?" ("+st+")":"")+" – reintentando",true);
    if(st===401){rawRemove.call(LS,"sb_session");location.reload();return;}timer=timer||setTimeout(flush,8000);}
  function queue(k,v){pending[k]=v;if(timer)clearTimeout(timer);timer=setTimeout(flush,700);}
  P.setItem=function(k,v){rawSet.call(this,k,v);if(this===LS&&!SKIP(k))queue(String(k),String(v));};
  P.removeItem=function(k){rawRemove.call(this,k);if(this===LS&&!SKIP(k))queue(String(k),null);};
  bootstrap.forEach(function(k){queue(k,rawGet.call(LS,k));});
  window.addEventListener("beforeunload",function(e){if(Object.keys(pending).length){e.preventDefault();e.returnValue="";}});
  window.celLogout=function(){rawRemove.call(LS,"sb_session");location.reload();};
  document.addEventListener("DOMContentLoaded",function(){ui("☁ Conectado");});
  // --- login ---
  function showLogin(){
    document.addEventListener("DOMContentLoaded",function(){
      var d=document.createElement("div");d.style.cssText="position:fixed;inset:0;z-index:100000;background:#082b43;display:flex;align-items:center;justify-content:center;font-family:Arial";
      d.innerHTML='<div style="background:#fff;padding:26px;border-radius:12px;width:320px"><h2 style="margin:0 0 14px;color:#082b43">Facility CEL</h2>'+
        '<input id="celE" type="email" placeholder="Email" style="width:100%;padding:10px;margin:4px 0;box-sizing:border-box">'+
        '<input id="celP" type="password" placeholder="Contraseña" style="width:100%;padding:10px;margin:4px 0;box-sizing:border-box">'+
        '<button id="celB" style="width:100%;padding:11px;margin-top:8px;background:#1976D2;color:#fff;border:0;border-radius:8px;cursor:pointer">Ingresar</button><p id="celM" style="color:#dc5b63;font-size:13px"></p></div>';
      document.body.appendChild(d);
      function go(){var x=xhr("POST","/auth/v1/token?grant_type=password",null,null,false);
        x.onload=function(){if(x.status===200){saveSess(JSON.parse(x.responseText));location.reload();}else document.getElementById("celM").textContent="Email o contraseña incorrectos.";};
        x.onerror=function(){document.getElementById("celM").textContent="Sin conexión.";};
        x.send(JSON.stringify({email:document.getElementById("celE").value.trim(),password:document.getElementById("celP").value}));}
      document.getElementById("celB").onclick=go;document.getElementById("celP").onkeydown=function(e){if(e.key==="Enter")go();};
    });
  }
})();
