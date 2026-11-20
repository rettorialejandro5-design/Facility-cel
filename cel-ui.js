/* Facility CEL v2: interfaz de usuario real (encabezado, perfil, sede, solo lectura, perfiles y auditoría).
   Corre al final del <body>, después de la app. Depende de window.CEL, que arma cel-sync.js. */
(function(){
  "use strict";
  var CEL=window.CEL;if(!CEL||!CEL.ready)return;
  var ROL={propietario:"Propietario",admin:"Admin de sede",operador:"Operador",lector:"Lector"};
  function esc(s){return String(s==null?"":s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
  function $(s,r){return (r||document).querySelector(s);}

  var st=document.createElement("style");
  st.textContent=
    ".celhead{display:flex;align-items:center;gap:8px;min-width:0}.celhead .user{cursor:pointer}"+
    ".celout{border:1px solid #c9d6e0;background:#fff;color:#33495a;border-radius:20px;padding:8px 12px;font-size:12px;cursor:pointer;white-space:nowrap}"+
    ".celro-pill{background:#fff4e0;color:#8a5a00;border-radius:20px;padding:6px 10px;font-size:11px;font-weight:700;white-space:nowrap}"+
    ".celmenu{position:fixed;z-index:100003;background:#fff;border:1px solid #d5e0e8;border-radius:12px;box-shadow:0 10px 30px #0003;padding:10px;min-width:240px;font:13px Segoe UI,Arial}"+
    ".celmenu .who{color:#60788b;font-size:12px;padding:4px 6px 10px;border-bottom:1px solid #eef2f5;margin-bottom:6px;line-height:1.5}"+
    ".celmenu button{display:block;width:100%;text-align:left;background:none;border:0;padding:9px 6px;border-radius:8px;cursor:pointer;font-size:13px;color:#203445}"+
    ".celmenu button:hover{background:#f1f6f9}.celmenu select{width:100%;padding:7px;margin:4px 0 8px;border-radius:8px;border:1px solid #c9d6e0}"+
    ".celmodal{position:fixed;inset:0;z-index:100004;background:#0008;display:flex;align-items:center;justify-content:center;padding:16px}"+
    ".celmodal .box{background:#fff;border-radius:14px;padding:22px;width:100%;max-width:360px;font:14px Segoe UI,Arial}"+
    ".celmodal input{width:100%;box-sizing:border-box;padding:10px;margin:4px 0;border:1px solid #c9d6e0;border-radius:8px}"+
    ".celmodal .row{display:flex;gap:8px;justify-content:flex-end;margin-top:12px}.celmodal .row button{padding:9px 14px;border-radius:8px;border:1px solid #c9d6e0;background:#fff;cursor:pointer}"+
    ".celmodal .row .p{background:#1976D2;color:#fff;border-color:#1976D2}.celmodal .msg{min-height:18px;font-size:13px;margin-top:8px}"+
    "body.cel-ro .cel-ro-off{opacity:.45!important;cursor:not-allowed!important}"+
    ".celaud td{font-size:12px;vertical-align:top}.celaud .meta{color:#60788b}";
  document.head.appendChild(st);

  // ---------- encabezado: usuario, empresa, sede y rol ----------
  var user=$(".top .user");
  if(user){
    user.textContent="● "+CEL.email+" · "+CEL.sede.empresa+" / "+CEL.sede.nombre+" · "+ROL[CEL.rol];
    user.title=user.textContent;
    var wrap=document.createElement("div");wrap.className="celhead";user.parentNode.insertBefore(wrap,user);wrap.appendChild(user);
    if(!CEL.canEdit){var ro=document.createElement("span");ro.className="celro-pill";ro.textContent="Solo lectura";wrap.insertBefore(ro,user);}
    var out=document.createElement("button");out.className="celout";out.type="button";out.textContent="Cerrar sesión";
    out.onclick=function(){if(confirm("¿Cerrar sesión?"))CEL.logout();};wrap.appendChild(out);
    user.addEventListener("click",function(e){e.stopPropagation();toggleMenu(user);});
  }
  var menu=null;
  function toggleMenu(anchor){
    if(menu){menu.remove();menu=null;return;}
    menu=document.createElement("div");menu.className="celmenu";
    var h='<div class="who"><b>'+esc(CEL.email)+'</b><br>'+esc(ROL[CEL.rol])+(CEL.owner?" de la plataforma":"")+'<br>'+esc(CEL.sede.empresa)+" / "+esc(CEL.sede.nombre)+'</div>';
    if(CEL.sedes.length>1){
      h+='<label style="font-size:12px;color:#60788b;padding:0 6px">Sede</label><select id="celSede">'+CEL.sedes.map(function(x){
        return '<option value="'+esc(x.id)+'"'+(x.id===CEL.sede.id?" selected":"")+">"+esc(x.empresa+" / "+x.nombre)+"</option>";}).join("")+"</select>";
    }
    h+='<button type="button" id="celPw">Cambiar contraseña</button><button type="button" id="celLo">Cerrar sesión</button>';
    menu.innerHTML=h;document.body.appendChild(menu);
    var r=anchor.getBoundingClientRect();menu.style.top=(r.bottom+6)+"px";menu.style.right=Math.max(8,innerWidth-r.right)+"px";
    var sel=$("#celSede",menu);if(sel)sel.onchange=function(){CEL.setSede(sel.value);};
    $("#celPw",menu).onclick=function(){closeMenu();changePassword();};
    $("#celLo",menu).onclick=function(){closeMenu();if(confirm("¿Cerrar sesión?"))CEL.logout();};
    menu.addEventListener("click",function(e){e.stopPropagation();});
  }
  function closeMenu(){if(menu){menu.remove();menu=null;}}
  document.addEventListener("click",closeMenu);

  function changePassword(){
    var d=document.createElement("div");d.className="celmodal";
    d.innerHTML='<div class="box"><b style="font-size:16px">Cambiar contraseña</b><div style="color:#60788b;font-size:12px;margin:6px 0 10px">Mínimo 6 caracteres. Te recomendamos una frase larga que no uses en otros sitios.</div>'+
      '<input id="celC1" type="password" autocomplete="new-password" placeholder="Contraseña nueva"><input id="celC2" type="password" autocomplete="new-password" placeholder="Repetir contraseña">'+
      '<div class="msg" id="celCM"></div><div class="row"><button type="button" id="celCX">Cancelar</button><button type="button" class="p" id="celCG">Guardar</button></div></div>';
    document.body.appendChild(d);$("#celC1",d).focus();
    $("#celCX",d).onclick=function(){d.remove();};
    $("#celCG",d).onclick=function(){
      var a=$("#celC1",d).value,b=$("#celC2",d).value,m=$("#celCM",d);m.style.color="#c0392b";
      if(a.length<6){m.textContent="La contraseña debe tener al menos 6 caracteres.";return;}
      if(a!==b){m.textContent="Las contraseñas no coinciden.";return;}
      this.disabled=true;var btn=this;
      CEL.changePassword(a).then(function(r){
        if(r.ok){m.style.color="#1a7f5a";m.textContent="Contraseña actualizada.";setTimeout(function(){d.remove();},1200);}
        else{btn.disabled=false;m.textContent=r.msg;}
      },function(){btn.disabled=false;m.textContent="Sin conexión. Reintentá.";});
    };
  }

  // ---------- rol lector: interfaz en solo lectura (la base además rechaza escrituras) ----------
  if(!CEL.canEdit){
    document.body.classList.add("cel-ro");
    var W='#preventivePdfUpload,#readPreventivePdf,#preventiveExtractText,#savePreventivePdf,#batchConfirm,#batchApprove,'+
      '#jobPhoto,#jobNotes,#jobCode,#jobDescription,#jobDate,#jobSector,#jobPinCount,#createCorrective,'+
      '#futurePhoto,#futureTitle,#futurePriority,#futureDescription,#futureSector,#createFuture,#celUploadPdf,#celReadPdf,'+
      '#closeExtMonth,#customRoutineForm input,#customRoutineForm select,#customRoutineForm button,#confirmCustomPin,#removeCustomPin,'+
      '[onclick^="toggleVerify"],[onchange^="saveVisitDate"],.frequency-edit,.schedule-toggle,[data-confirm-pin],[data-generate-pin],[data-open-pin],'+
      '[data-delete-custom-routine],.delete-corrective-task,.delete-corrective-pin,.confirm-placement,.choose-placement,.cel-edit';
    var DRAG='.pin,.custom-map-pin';
    function lock(root){
      (root.querySelectorAll?root:document).querySelectorAll(W).forEach(function(el){
        if(el.classList.contains("cel-ro-off"))return;el.classList.add("cel-ro-off");el.title="Solo lectura";
        if("disabled" in el)el.disabled=true;
      });
    }
    lock(document);
    new MutationObserver(function(ms){ms.forEach(function(m){m.addedNodes.forEach(function(n){if(n.nodeType===1){if(n.matches&&n.matches(W))lock(n.parentNode||document);lock(n);}});});})
      .observe(document.body,{childList:true,subtree:true});
    ["click","change","input","submit","pointerdown","mousedown","touchstart","dragstart","drop"].forEach(function(ev){
      document.addEventListener(ev,function(e){
        var t=e.target&&e.target.closest?e.target:null;if(!t)return;
        var hit=t.closest(W)||((ev==="pointerdown"||ev==="mousedown"||ev==="touchstart"||ev==="dragstart")&&t.closest(DRAG));
        if(hit){e.preventDefault();e.stopImmediatePropagation();if(ev==="click"||ev==="submit")CEL.ui("Solo lectura: tu rol no permite cargar ni modificar datos",true);}
      },true);
    });
  }

  // ---------- Administración de perfiles: usuarios reales (public.listar_miembros) ----------
  var perf=$("#page-perfiles");
  if(perf){
    perf.innerHTML='<div class="heading"><div><h1>Administración de perfiles</h1><div class="sub">Usuarios, roles y sedes</div></div>'+
      (CEL.owner?'<button class="btn primary" id="celAlta" type="button">＋ Nuevo usuario</button>':'')+'</div>'+
      '<div class="notice" style="margin-bottom:14px">Las altas de usuarios las hace el propietario de la plataforma. Cada persona ve únicamente las sedes asignadas y puede hacer solo lo que permite su rol.</div>'+
      '<div class="stats compact-stats"><div class="stat"><strong id="celStU">—</strong><small>Usuarios activos</small></div><div class="stat"><strong>'+CEL.sedes.length+'</strong><small>'+(CEL.sedes.length===1?"Sede visible":"Sedes visibles")+'</small></div><div class="stat"><strong>'+esc(ROL[CEL.rol])+'</strong><small>Tu rol</small></div><div class="stat"><strong>Individual</strong><small>Acceso por usuario</small></div></div>'+
      '<div class="panel"><div class="panelhead"><b>Usuarios y perfiles</b><span class="pill blue">'+(CEL.owner||CEL.rol==="admin"?"Administración":"Tu perfil")+'</span></div><div class="panelbody"><div class="table-scroll"><table class="table"><thead><tr><th>USUARIO</th><th>ROL</th><th>EMPRESA / SEDE</th><th>ESTADO</th></tr></thead><tbody id="celMiembros"><tr><td colspan="4">Cargando…</td></tr></tbody></table></div></div></div>'+
      '<div class="cards3" style="margin-top:14px">'+
        '<div class="mini"><div style="font-size:22px">🛡️</div><b>Roles y permisos</b><div class="meta">Propietario: todas las sedes. Admin de sede: edita su sede y ve su auditoría. Operador: edita su sede. Lector: solo consulta.</div></div>'+
        '<div class="mini"><div style="font-size:22px">🏢</div><b>Alcance por sede</b><div class="meta">Los datos se guardan por sede. Cada usuario ve solo las sedes que tiene asignadas.</div></div>'+
        '<div class="mini"><div style="font-size:22px">🔐</div><b>Seguridad de acceso</b><div class="meta">Usuario y contraseña individuales, conexión cifrada (HTTPS), permisos aplicados en la base de datos y registro de actividad. Sin verificación en dos pasos por ahora.</div></div>'+
      '</div>';
    var alta=$("#celAlta",perf);
    if(alta)alta.onclick=function(){alert("Para dar de alta a alguien:\n1) Supabase > Authentication > Users > Add user (con Auto confirm).\n2) SQL Editor: select public.asignar_usuario('email','Empresa','Sede','operador');\nLa persona fija su contraseña con “¿Olvidaste tu contraseña?”.");};
    CEL.api("POST","/rest/v1/rpc/listar_miembros",{}).then(function(r){return r.ok?r.json():Promise.reject(r.status);}).then(function(rows){
      var tb=$("#celMiembros");
      tb.innerHTML=rows.length?rows.map(function(x){
        return "<tr><td><b>"+esc(x.email)+"</b>"+(x.email===CEL.email?'<div class="meta">Vos</div>':"")+"</td><td>"+esc(ROL[x.rol]||x.rol)+"</td><td>"+
          (x.empresa?esc(x.empresa)+" / "+esc(x.sede):"Todas las sedes")+'</td><td><span class="pill '+(x.activo?"closed-label":"amber")+'">'+(x.activo?"Activo":"Inactivo")+"</span></td></tr>";
      }).join(""):'<tr><td colspan="4">No hay usuarios para mostrar.</td></tr>';
      var emails={};rows.forEach(function(x){if(x.activo)emails[x.email]=1;});$("#celStU").textContent=Object.keys(emails).length;
    }).catch(function(e){$("#celMiembros").innerHTML='<tr><td colspan="4">No se pudo cargar la lista ('+esc(e)+').</td></tr>';});
  }

  // ---------- Auditoría (propietario y admins de sede) ----------
  var KEYS={celExtVerified:"Matafuegos: verificaciones",celExtClosed:"Matafuegos: cierre de mes",celVisitDates:"Vencimientos: próximas visitas",
    celPreventiveApproved:"Preventivos: aprobaciones",celPreventiveReports:"Preventivos: informes",celCorrectivePinsV1:"Correctivos y pines",
    facilityCEL_schedule_states_v14_three_states:"Cronograma: estados",facilityCEL_schedule_frequencies_v1:"Cronograma: frecuencias",
    facilityCEL_custom_routines_v1:"Rutinas agregadas",facilityCEL_custom_pin_positions_v1:"Plano: ubicación de pines",
    celScheduleNotesV1:"Cronograma: observaciones",celExtEditsV1:"Matafuegos: fechas y observaciones",celVencEditsV1:"Vencimientos: datos",celVencControlV1:"Vencimientos: controles mensuales"};
  var ACC={INSERT:"Alta",UPDATE:"Modificación",DELETE:"Borrado",USUARIO_INSERT:"Alta de usuario en sede",USUARIO_UPDATE:"Cambio de rol o estado",USUARIO_DELETE:"Baja de usuario en sede"};
  if(CEL.canAudit&&typeof pages!=="undefined"){
    var nav=$(".nav");
    if(nav){
      var b=document.createElement("button");b.dataset.page="auditoria";b.innerHTML='<span>⎙</span><b class="txt">Auditoría</b>';nav.appendChild(b);
      var content=$(".content"),sec=document.createElement("div");sec.id="page-auditoria";sec.className="hidden celaud";
      sec.innerHTML='<div class="heading"><div><h1>Auditoría</h1><div class="sub">Registro de cambios: fecha, usuario, acción y objeto</div></div><button class="btn" id="celAudR" type="button">Actualizar</button></div>'+
        '<div class="panel"><div class="panelbody"><div class="table-scroll"><table class="table"><thead><tr><th>FECHA</th><th>USUARIO</th><th>ACCIÓN</th><th>OBJETO</th>'+(CEL.sedes.length>1?"<th>SEDE</th>":"")+'</tr></thead><tbody id="celAudRows"><tr><td colspan="5">Cargando…</td></tr></tbody></table></div><div class="meta" style="margin-top:8px">Se muestran los últimos 300 registros.</div></div></div>';
      var foot=content&&content.lastElementChild;content.insertBefore(sec,foot&&foot.id?null:foot);
      pages.push("auditoria");
      b.onclick=function(){show("auditoria");var c=$("#crumb");if(c)c.textContent="Auditoría";loadAudit();};
      $("#celAudR").onclick=loadAudit;
    }
  }
  function loadAudit(){
    var names={};CEL.sedes.forEach(function(x){names[x.id]=x.empresa+" / "+x.nombre;});
    CEL.api("GET","/rest/v1/audit_log?select=ts,email,accion,objeto,sede_id&order=id.desc&limit=300").then(function(r){return r.ok?r.json():Promise.reject(r.status);}).then(function(rows){
      $("#celAudRows").innerHTML=rows.length?rows.map(function(x){
        var obj=/^USUARIO_/.test(x.accion)?"Usuario "+String(x.objeto||"").slice(0,8):(KEYS[x.objeto]||x.objeto||"");
        return "<tr><td>"+esc(new Date(x.ts).toLocaleString("es-AR",{hour12:false,day:"2-digit",month:"2-digit",year:"numeric",hour:"2-digit",minute:"2-digit",second:"2-digit"}))+"</td><td>"+esc(x.email||"(sistema)")+"</td><td>"+esc(ACC[x.accion]||x.accion)+"</td><td>"+esc(obj)+"</td>"+
          (CEL.sedes.length>1?"<td>"+esc(names[x.sede_id]||"")+"</td>":"")+"</tr>";
      }).join(""):'<tr><td colspan="5">Todavía no hay registros.</td></tr>';
    }).catch(function(e){$("#celAudRows").innerHTML='<tr><td colspan="5">No se pudo cargar la auditoría ('+esc(e)+').</td></tr>';});
  }
})();
