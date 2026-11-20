"""Inserta cel-sync.js y cel-ui.js en index.html y aplica los textos de la v2.

Uso:  python build_index.py
- Toma la URL y la clave anon de Supabase que ya están en index.html (nunca la service_role).
- Cada reemplazo de texto debe aparecer exactamente una vez; si no, se detiene sin escribir nada.
- Es idempotente: se puede volver a correr después de editar cel-sync.js o cel-ui.js.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
INDEX = ROOT / "index.html"

html = INDEX.read_text(encoding="utf-8")

cfg = re.search(r'var CFG=\{url:"(https://[a-z0-9]+\.supabase\.co)",anon:"([A-Za-z0-9._-]+)"\}', html)
if not cfg:
    sys.exit("No encontré la configuración de Supabase en index.html")
url, anon = cfg.groups()
if "service_role" in anon or "service_role" in html:
    sys.exit("index.html contiene 'service_role': me detengo.")

sync_js = (ROOT / "cel-sync.js").read_text(encoding="utf-8")
sync_js = sync_js.replace("__SUPABASE_URL__", url).replace("__SUPABASE_ANON_KEY__", anon)
ui_js = (ROOT / "cel-ui.js").read_text(encoding="utf-8")


def sub_block(text, pattern, repl, label):
    found = re.findall(pattern, text, flags=re.S)
    if len(found) != 1:
        sys.exit(f"[{label}] se esperaba 1 coincidencia y hubo {len(found)}")
    return re.sub(pattern, lambda _m: repl, text, count=1, flags=re.S)


# 1) capa de sincronización (head)
html = sub_block(html, r'<script id="cel-sync">.*?</script>', '<script id="cel-sync">' + sync_js + "</script>", "cel-sync")

# 2) script de demostración -> interfaz real (final del body)
if '<script id="cel-ui">' in html:
    html = sub_block(html, r'<script id="cel-ui">.*?</script>', '<script id="cel-ui">' + ui_js + "</script>", "cel-ui")
else:
    html = sub_block(html, r'<script id="facilitycel-demo-session">.*?</script>', '<script id="cel-ui">' + ui_js + "</script>", "demo-session")

# 3) textos que con la v2 dejan de ser ciertos (y documentos PDF locales separados por usuario y sede)
TEXTS = [
    ("<title>Facility CEL | Aplicación demostrativa</title>", "<title>Facility CEL</title>"),
    ('<div class="sidefoot">Prototipo de interfaz · Versión inicial</div>', '<div class="sidefoot">Facility CEL · v38</div>'),
    ('<div class="user">● Perfil administrador　⌄</div>', '<div class="user">●</div>'),
    ("El prototipo guarda los documentos en este navegador. La versión multiusuario requerirá almacenamiento central.",
     "Los informes PDF se guardan solo en este navegador, separados por usuario y sede. Todavía no se suben a la nube."),
    ("Prototipo de interfaz: la selección de archivos se muestra localmente. La lectura automática de Excel/PDF, validación de remitos y guardado permanente se conectarán en la etapa de integración.",
     "La fotografía (optimizada), los datos y los pines se guardan en la nube para la sede activa. También podés agregar o cambiar la foto después, haciendo clic en el pin del plano."),
    ("La fotografía y los datos se muestran en esta demostración local. El almacenamiento, historial y seguimiento se habilitarán al conectar la base de datos.",
     "La fotografía (optimizada) y los datos se guardan en la nube para la sede activa. Cada cambio queda registrado en la auditoría con usuario, fecha y hora."),
    ("El botón registra la verificación mensual en esta demostración del navegador. En la versión conectada quedará guardado con usuario, fecha y hora.",
     "El botón registra la verificación mensual y la guarda en la nube para la sede activa. Cada cambio queda registrado en la auditoría con usuario, fecha y hora."),
    ("El cronograma refleja los estados registrados en el prototipo local.", "El cronograma refleja los estados registrados para la sede activa."),
    ("FACILITY CEL · PROTOTIPO LOCAL CON OCR EN NAVEGADOR · NO ES AÚN MULTIUSUARIO", "FACILITY CEL · DATOS POR SEDE EN LA NUBE · OCR EN NAVEGADOR"),
    # v39: se quitó el aviso de "Ver plan anual" (ahora alterna vista anual / 5 meses).
    ("El cierre queda registrado en este navegador.", "El cierre queda guardado para la sede activa."),
    ("Las rutinas nuevas se guardan en este navegador y se incorporan al cronograma.", "Las rutinas nuevas se guardan para la sede activa y se incorporan al cronograma."),
    ("CEL_DB_NAME='FacilityCEL_DB_v2'", "CEL_DB_NAME='FacilityCEL_DB_v2'+((window.CEL&&CEL.dbSuffix)||'')"),
]
for old, new in TEXTS:
    if html.count(new) == 1:
        continue  # ya aplicado en una corrida anterior
    n = html.count(old)
    if n != 1:
        sys.exit(f"Texto no encontrado exactamente una vez ({n}): {old[:70]}")
    html = html.replace(old, new)

if "service_role" in html:
    sys.exit("El resultado contiene 'service_role': me detengo.")
INDEX.write_text(html, encoding="utf-8", newline="\n")
print("index.html actualizado:", len(html.encode("utf-8")), "bytes")
