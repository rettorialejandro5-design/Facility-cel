/* Facility CEL v2: sesión, sedes y roles con Supabase. Los datos se guardan por sede en public.datos (RLS).
   Corre en <head>, antes que la app: valida la sesión, carga los datos de la sede activa en localStorage
   y sincroniza en la nube cada cambio que la app guarde. En el navegador solo va la clave pública "anon". */
(function(){
  "use strict";
  var CFG={url:"__SUPABASE_URL__",anon:"__SUPABASE_ANON_KEY__"};
  var SITE="https://facilitycel.com.ar";
  var MIN_PASS=6; // mínimo configurado hoy en Supabase > Authentication > Email
  var CEL=window.CEL={ready:false,blocked:true,dbSuffix:"_sin_sesion"};
  if(/__SUPABASE/.test(CFG.url+CFG.anon)){console.warn("[CEL] Supabase sin configurar.");return;}

  var LS=window.localStorage,P=Storage.prototype,rawSet=P.setItem,rawRemove=P.removeItem,rawGet=P.getItem;
  function isApp(k){return /^(cel|facilityCEL)/.test(String(k));}
  function appKeys(){var a=[];for(var i=0;i<LS.length;i++){var k=LS.key(i);if(isApp(k))a.push(k);}return a;}
  function clearApp(){appKeys().forEach(function(k){rawRemove.call(LS,k);});}
  function getSess(){try{return JSON.parse(rawGet.call(LS,"sb_session")||"null");}catch(e){return null;}}
  function saveSess(s){if(!s.expires_at)s.expires_at=Math.floor(Date.now()/1000)+(Number(s.expires_in)||3600);rawSet.call(LS,"sb_session",JSON.stringify(s));}
  function dropAll(){rawRemove.call(LS,"sb_session");rawRemove.call(LS,"sb_sede");rawRemove.call(LS,"sb_uid");clearApp();}
  function claims(t){try{return JSON.parse(decodeURIComponent(escape(atob(t.split(".")[1].replace(/-/g,"+").replace(/_/g,"/")))));}catch(e){return {};}}
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}

  // XHR sincrónico: solo para el arranque, antes de que corra la app.
  function syncReq(method,path,body,token){
    var x=new XMLHttpRequest();x.open(method,CFG.url+path,false);
    x.setRequestHeader("apikey",CFG.anon);x.setRequestHeader("Content-Type","application/json");
    if(token)x.setRequestHeader("Authorization","Bearer "+token);
    x.send(body==null?null:JSON.stringify(body));return x;
  }
  function api(method,path,body,extra,token){
    var h={"apikey":CFG.anon,"Content-Type":"application/json"};
    var t=token==="-"?null:(token||(getSess()||{}).access_token);if(t)h.Authorization="Bearer "+t;
    for(var k in (extra||{}))h[k]=extra[k];
    return fetch(CFG.url+path,{method:method,headers:h,body:body==null?undefined:JSON.stringify(body),keepalive:method!=="GET"&&JSON.stringify(body||"").length<60000});
  }
  var refreshing=null;
  function refreshAsync(){
    if(refreshing)return refreshing;
    var s=getSess();if(!s||!s.refresh_token)return Promise.resolve(false);
    refreshing=api("POST","/auth/v1/token?grant_type=refresh_token",{refresh_token:s.refresh_token},null,"-")
      .then(function(r){return r.ok?r.json().then(function(n){saveSess(n);CEL.token=n.access_token;return true;}):false;})
      .catch(function(){return false;}).then(function(v){refreshing=null;return v;});
    return refreshing;
  }

  // ---------- pantallas (login, recuperación, contraseña nueva, avisos) ----------
  var CSS=".celov{position:fixed;inset:0;z-index:100002;background:#082b43;display:flex;align-items:center;justify-content:center;font-family:Segoe UI,Arial,sans-serif;padding:16px;overflow:auto}"+
    ".celbox{background:#fff;padding:26px;border-radius:14px;width:100%;max-width:360px;box-shadow:0 10px 40px #0005}"+
    ".celbox h2{margin:0 0 4px;color:#082b43}.celbox .sub{color:#60788b;font-size:13px;margin-bottom:14px}"+
    ".celbox input{width:100%;padding:10px;margin:4px 0;box-sizing:border-box;border:1px solid #c9d6e0;border-radius:8px;font-size:14px}"+
    ".celbox button.p{width:100%;padding:11px;margin-top:8px;background:#1976D2;color:#fff;border:0;border-radius:8px;cursor:pointer;font-size:14px}"+
    ".celbox button.p:disabled{opacity:.6;cursor:default}.celbox .lnk{background:none;border:0;color:#1976D2;cursor:pointer;padding:6px 0;font-size:13px}"+
    ".celbox .msg{font-size:13px;min-height:18px;margin:8px 0 0}.celbox .err{color:#c0392b}.celbox .ok{color:#1a7f5a}"+
    ".celbox ul{margin:16px 0 0;padding:12px 12px 12px 30px;background:#f3f7fa;border-radius:10px;color:#3d5566;font-size:12px;line-height:1.6}";
  function onBody(fn){if(document.body)fn();else document.addEventListener("DOMContentLoaded",fn);}
  function overlay(inner){
    onBody(function(){
      if(!document.getElementById("celcss")){var st=document.createElement("style");st.id="celcss";st.textContent=CSS;document.head.appendChild(st);}
      var old=document.getElementById("celov");if(old)old.remove();
      var d=document.createElement("div");d.id="celov";d.className="celov";d.innerHTML='<div class="celbox">'+inner+"</div>";
      document.body.appendChild(d);var f=d.querySelector("input");if(f)f.focus();
    });
  }
  var TRUST='<ul><li>Acceso con usuario y contraseña individuales.</li><li>Conexión cifrada (HTTPS).</li><li>Permisos por rol y por sede, aplicados en la base de datos.</li><li>Registro de actividad de cada cambio.</li></ul>';

  function showLogin(msg){
    overlay('<h2>Facility CEL</h2><div class="sub">Ingresá con tu usuario</div>'+
      '<input id="celE" type="email" autocomplete="username" placeholder="Email">'+
      '<input id="celP" type="password" autocomplete="current-password" placeholder="Contraseña">'+
      '<button class="p" id="celB">Ingresar</button>'+
      '<button class="lnk" id="celF" type="button">¿Olvidaste tu contraseña?</button>'+
      '<p class="msg err" id="celM">'+esc(msg||"")+'</p>'+TRUST);
    onBody(function(){
      var b=document.getElementById("celB");
      function go(){
        var e=document.getElementById("celE").value.trim(),p=document.getElementById("celP").value,m=document.getElementById("celM");
        if(!e||!p){m.textContent="Completá email y contraseña.";return;}
        b.disabled=true;m.textContent="";
        api("POST","/auth/v1/token?grant_type=password",{email:e,password:p},null,"-").then(function(r){
          if(!r.ok){b.disabled=false;m.textContent="Email o contraseña incorrectos.";return;}
          return r.json().then(function(s){startSession(s);});
        }).catch(function(){b.disabled=false;m.textContent="Sin conexión. Reintentá.";});
      }
      b.onclick=go;document.getElementById("celP").onkeydown=function(ev){if(ev.key==="Enter")go();};
      document.getElementById("celF").onclick=function(){showForgot(document.getElementById("celE").value.trim());};
    });
  }
  function showForgot(prefill){
    overlay('<h2>Recuperar contraseña</h2><div class="sub">Te enviamos un enlace para elegir una contraseña nueva.</div>'+
      '<input id="celFE" type="email" autocomplete="username" placeholder="Email" value="'+esc(prefill||"")+'">'+
      '<button class="p" id="celFB">Enviar enlace</button><button class="lnk" id="celFV" type="button">Volver a ingresar</button>'+
      '<p class="msg" id="celFM"></p>');
    onBody(function(){
      var b=document.getElementById("celFB"),m=document.getElementById("celFM");
      document.getElementById("celFV").onclick=function(){showLogin();};
      b.onclick=function(){
        var e=document.getElementById("celFE").value.trim();
        if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)){m.className="msg err";m.textContent="Escribí un email válido.";return;}
        b.disabled=true;m.className="msg";m.textContent="Enviando…";
        api("POST","/auth/v1/recover?redirect_to="+encodeURIComponent(SITE),{email:e},null,"-")
          .then(function(){},function(){})
          .then(function(){m.className="msg ok";m.textContent="Si el correo existe, te enviamos un enlace. Revisá también la carpeta de spam.";});
      };
    });
  }
  function showNewPassword(tmp,kind){
    overlay('<h2>'+(kind==="invite"?"Elegí tu contraseña":"Contraseña nueva")+'</h2>'+
      '<div class="sub">Mínimo '+MIN_PASS+' caracteres. Te recomendamos una frase larga y que no uses en otros sitios.</div>'+
      '<input id="celN1" type="password" autocomplete="new-password" placeholder="Contraseña nueva">'+
      '<input id="celN2" type="password" autocomplete="new-password" placeholder="Repetir contraseña">'+
      '<button class="p" id="celNB">Guardar contraseña</button><p class="msg err" id="celNM"></p>');
    onBody(function(){
      var b=document.getElementById("celNB"),m=document.getElementById("celNM");
      b.onclick=function(){
        var a=document.getElementById("celN1").value,c=document.getElementById("celN2").value;
        if(a.length<MIN_PASS){m.textContent="La contraseña debe tener al menos "+MIN_PASS+" caracteres.";return;}
        if(a!==c){m.textContent="Las contraseñas no coinciden.";return;}
        b.disabled=true;m.textContent="";
        api("PUT","/auth/v1/user",{password:a},null,tmp.access_token).then(function(r){
          if(r.ok){startSession(tmp);return;}
          return r.json().catch(function(){return {};}).then(function(j){b.disabled=false;m.textContent=passError(j);});
        }).catch(function(){b.disabled=false;m.textContent="Sin conexión. Reintentá.";});
      };
    });
  }
  function passError(j){
    var c=(j&&(j.error_code||j.code))||"",t=(j&&(j.msg||j.message||j.error_description))||"";
    if(c==="same_password")return "La contraseña nueva tiene que ser distinta de la actual.";
    if(c==="weak_password")return "La contraseña es demasiado débil. Probá con una más larga.";
    if(/reauthenticat/i.test(c+t))return "Por seguridad, cerrá sesión y usá “¿Olvidaste tu contraseña?”.";
    return "No se pudo guardar la contraseña"+(t?": "+t:".");
  }
  function showBlocked(title,text,retry){
    overlay('<h2>'+esc(title)+'</h2><div class="sub">'+esc(text)+'</div>'+
      (retry?'<button class="p" id="celR">Reintentar</button>':'')+'<button class="lnk" id="celX" type="button">Cerrar sesión</button>');
    onBody(function(){
      var r=document.getElementById("celR");if(r)r.onclick=function(){location.reload();};
      document.getElementById("celX").onclick=function(){logout();};
    });
  }
  function startSession(s){
    saveSess(s);var u=claims(s.access_token).sub;
    if(rawGet.call(LS,"sb_uid")!==u){clearApp();rawRemove.call(LS,"sb_sede");rawSet.call(LS,"sb_uid",u);}
    location.replace(location.pathname+location.search);
  }
  function logout(){
    var t=(getSess()||{}).access_token;
    if(t)api("POST","/auth/v1/logout",null,null,t).catch(function(){});
    dropAll();setTimeout(function(){location.replace(location.pathname+location.search);},150);
  }
  CEL.logout=logout;

  // ---------- 1) enlace de recuperación o invitación (#access_token=...&type=recovery|invite) ----------
  var hp=new URLSearchParams((location.hash||"").replace(/^#/,""));
  if(hp.get("error_code")||hp.get("error")){
    history.replaceState(null,"",location.pathname+location.search);
    showLogin("El enlace no es válido o ya venció. Pedí uno nuevo con “¿Olvidaste tu contraseña?”.");return;
  }
  if(hp.get("access_token")&&/^(recovery|invite)$/.test(hp.get("type")||"")){
    var tmp={access_token:hp.get("access_token"),refresh_token:hp.get("refresh_token"),expires_in:Number(hp.get("expires_in"))||3600,token_type:"bearer"};
    var kind=hp.get("type");history.replaceState(null,"",location.pathname+location.search);
    showNewPassword(tmp,kind);return;
  }

  // ---------- 2) sesión ----------
  var s=getSess();
  if(s&&s.refresh_token&&s.expires_at-60<Date.now()/1000){
    try{var rr=syncReq("POST","/auth/v1/token?grant_type=refresh_token",{refresh_token:s.refresh_token});
      if(rr.status===200){s=JSON.parse(rr.responseText);saveSess(s);}else s=null;}catch(e){s=null;}
  }
  if(!s||!s.access_token){clearApp();showLogin();return;}
  var tok=s.access_token,cl=claims(tok),uid=cl.sub;
  if(rawGet.call(LS,"sb_uid")!==uid){clearApp();rawRemove.call(LS,"sb_sede");rawSet.call(LS,"sb_uid",uid);}

  // ---------- 3) rol, sedes y datos de la sede activa ----------
  function getJSON(path){var x=syncReq("GET",path,null,tok);if(x.status===200)return JSON.parse(x.responseText);throw x.status;}
  var owner,mem,sedes,datos,sel,rol;
  try{
    owner=getJSON("/rest/v1/plataforma_admins?select=user_id").length>0;
    mem=getJSON("/rest/v1/miembros?select=sede_id,rol&activo=eq.true&user_id=eq."+uid);
    sedes=getJSON("/rest/v1/sedes?select=id,nombre,empresas(nombre)&order=nombre");
  }catch(e){
    clearApp();
    if(e===401){dropAll();showLogin("Tu sesión venció. Ingresá de nuevo.");}
    else showBlocked("No se pudo conectar con la nube","Reintentá en unos minutos. Código: "+e+".",true);
    return;
  }
  if(!sedes.length){clearApp();showBlocked("Sin sede asignada","Tu usuario todavía no tiene una sede asignada. Pedile al propietario de la plataforma que te asigne una.");return;}
  sel=rawGet.call(LS,"sb_sede");
  if(!sedes.some(function(x){return x.id===sel;}))sel=sedes[0].id;
  rawSet.call(LS,"sb_sede",sel);
  var m=mem.filter(function(x){return x.sede_id===sel;})[0];
  rol=owner?"propietario":(m?m.rol:"lector");
  try{datos=getJSON("/rest/v1/datos?select=key,value&sede_id=eq."+sel);}
  catch(e){clearApp();showBlocked("No se pudieron cargar los datos","Reintentá en unos minutos. Código: "+e+".",true);return;}
  clearApp();
  datos.forEach(function(r){if(r.value!=null&&isApp(r.key))rawSet.call(LS,r.key,r.value);});

  var sedeObj=sedes.filter(function(x){return x.id===sel;})[0];
  CEL.ready=true;CEL.blocked=false;CEL.token=tok;CEL.uid=uid;CEL.email=cl.email||"";
  CEL.owner=owner;CEL.rol=rol;CEL.canEdit=owner||rol==="admin"||rol==="operador";CEL.canAudit=owner||rol==="admin";
  CEL.sede={id:sel,nombre:sedeObj.nombre,empresa:(sedeObj.empresas||{}).nombre||""};
  CEL.sedes=sedes.map(function(x){return {id:x.id,nombre:x.nombre,empresa:(x.empresas||{}).nombre||""};});
  CEL.dbSuffix="_"+uid.slice(0,8)+"_"+sel.slice(0,8); // documentos PDF locales separados por usuario y sede
  CEL.api=function(method,path,body,extra){
    return api(method,path,body,extra).then(function(r){
      if(r.status!==401)return r;
      return refreshAsync().then(function(ok){return ok?api(method,path,body,extra):r;});
    });
  };
  // ---------- archivos (Supabase Storage, espacio privado "documentos") ----------
  function objPath(p){return String(p).split("/").map(encodeURIComponent).join("/");}
  CEL.uploadFile=function(bucket,path,file){
    function go(){var h={"apikey":CFG.anon,"Content-Type":file.type||"application/pdf","x-upsert":"false"};var t=(getSess()||{}).access_token;if(t)h.Authorization="Bearer "+t;
      return fetch(CFG.url+"/storage/v1/object/"+bucket+"/"+objPath(path),{method:"POST",headers:h,body:file});}
    return go().then(function(r){if(r.status!==401&&r.status!==400)return r;return refreshAsync().then(function(ok){return ok?go():r;});});
  };
  CEL.fileUrl=function(bucket,path,seconds){
    return CEL.api("POST","/storage/v1/object/sign/"+bucket+"/"+objPath(path),{expiresIn:seconds||600}).then(function(r){
      if(!r.ok)throw new Error("HTTP "+r.status);return r.json();}).then(function(j){return CFG.url+"/storage/v1"+(j.signedURL||j.signedUrl);});
  };
  // Borrado por lista: responde 200 con los objetos realmente borrados (vacío si las reglas lo impiden).
  CEL.deleteFile=function(bucket,path){return CEL.api("DELETE","/storage/v1/object/"+bucket,{prefixes:[path]}).then(function(r){
    if(!r.ok)return r;return r.json().then(function(j){return {ok:Array.isArray(j)&&j.length>0,status:Array.isArray(j)&&j.length?200:403};});});};
  CEL.setSede=function(id){if(Object.keys(pending).length&&!confirm("Hay cambios guardándose. ¿Cambiar de sede igual?"))return;rawSet.call(LS,"sb_sede",id);location.reload();};
  CEL.changePassword=function(pw){
    return CEL.api("PUT","/auth/v1/user",{password:pw}).then(function(r){
      if(r.ok)return {ok:true};return r.json().catch(function(){return {};}).then(function(j){return {ok:false,msg:passError(j)};});
    });
  };

  // ---------- 4) escritura diferida a public.datos (solo admin / operador / propietario) ----------
  var pending={},timer=null,badge,started=false;
  setTimeout(function(){started=true;},2500);
  function ui(t,bad){
    onBody(function(){
      if(!badge){badge=document.createElement("div");badge.id="celbadge";
        badge.style.cssText="position:fixed;left:10px;bottom:10px;z-index:100001;font:12px Segoe UI,Arial;padding:5px 10px;border-radius:12px;color:#fff;opacity:.92;max-width:70vw";
        document.body.appendChild(badge);}
      badge.textContent=t;badge.style.background=bad?"#c0392b":"#1aa47a";
    });
  }
  CEL.ui=ui;
  function flush(){
    timer=null;var keys=Object.keys(pending);if(!keys.length)return;
    var snap=pending;pending={};
    var ups=[],dels=[];
    keys.forEach(function(k){if(snap[k]===null)dels.push(k);else ups.push({sede_id:sel,key:k,value:snap[k],updated_at:new Date().toISOString()});});
    ui("☁ Guardando…");
    var jobs=[];
    if(ups.length)jobs.push(CEL.api("POST","/rest/v1/datos?on_conflict=sede_id,key",ups,{Prefer:"resolution=merge-duplicates,return=minimal"}));
    dels.forEach(function(k){jobs.push(CEL.api("DELETE","/rest/v1/datos?sede_id=eq."+sel+"&key=eq."+encodeURIComponent(k),null,{Prefer:"return=minimal"}));});
    Promise.all(jobs).then(function(rs){
      var bad=rs.filter(function(r){return !r.ok;})[0];
      if(!bad){ui("☁ Guardado en la nube");return;}
      fail(snap,bad.status);
    },function(){fail(snap);});
  }
  function fail(snap,st){
    for(var k in snap)if(!(k in pending))pending[k]=snap[k];
    if(st===401){ui("⚠ Sesión vencida: cerrá sesión y volvé a ingresar para guardar",true);return;}
    if(st===403){ui("⚠ Sin permiso para guardar en esta sede",true);pending={};return;}
    ui("⚠ Sin guardar en la nube"+(st?" ("+st+")":"")+" – reintentando",true);
    timer=timer||setTimeout(flush,8000);
  }
  function queue(k,v){pending[k]=v;if(timer)clearTimeout(timer);timer=setTimeout(flush,700);}
  function roWarn(){if(started)ui("Solo lectura: este cambio no se guarda",true);}
  P.setItem=function(k,v){rawSet.call(this,k,v);if(this===LS&&isApp(k)){if(!CEL.canEdit){roWarn();return;}queue(String(k),String(v));}};
  P.removeItem=function(k){rawRemove.call(this,k);if(this===LS&&isApp(k)){if(!CEL.canEdit){roWarn();return;}queue(String(k),null);}};
  window.addEventListener("beforeunload",function(e){if(Object.keys(pending).length){e.preventDefault();e.returnValue="";}});
  ui(CEL.canEdit?"☁ Conectado":"☁ Conectado · solo lectura");
})();
