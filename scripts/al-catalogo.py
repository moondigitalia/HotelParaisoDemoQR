# Pasa al catálogo de arranque los uniformes que el robot-dueño subió por el panel (tal como el panel los dejó).
import json, os, shutil, re, unicodedata, sys
M='/home/claude/m-sport/'; B=M+'scripts/.blob/'
cat=json.load(open(B+'data/catalogo.json'))
base=open(M+'js/catalogo-base.js').read()
ids_base=set(re.findall(r"id: '([^']+)'", base))|set(re.findall(r'"id": "([^"]+)"', base))
def slug(t): return re.sub(r'[^a-z0-9]+','-',unicodedata.normalize('NFKD',t).encode('ascii','ignore').decode().lower()).strip('-')
def copia(url, dest):
    if not url or '/_blob/' not in url: return url
    src=B+url.split('/_blob/')[1]; ext=os.path.splitext(src)[1]
    shutil.copy(src, M+dest+ext); return '/'+dest+ext
nuevos=[]; vistos=set()
for u in cat:   # el más nuevo va primero: si el robot subió el mismo uniforme dos veces, se queda el último
    if u['id'] in ids_base or u.get('tipo')!='3d' or u['nombre'] in vistos: continue
    vistos.add(u['nombre'])
    s=slug(u['nombre'].replace('Mundial ',''))
    for k in list(u['fotos']): u['fotos'][k]=copia(u['fotos'][k],'assets/catalogo/%s-%s'%(s,k))
    u['mini']=copia(u.get('mini'),'assets/catalogo/%s-mini'%s); u['silueta']=copia(u.get('silueta'),'assets/catalogo/%s-silueta'%s)
    if u.get('escudo'): u['escudo']=copia(u['escudo'],'assets/escudos/%s'%slug(u['etiquetas']['equipo']))
    u['id']=s; u.pop('orden',None); u.pop('nuevo',None)
    nuevos.append(u)
order=['barcelona','real','mexico','espana','francia']
nuevos.sort(key=lambda u: (next((i for i,o in enumerate(order) if u['id'].startswith(o)),9), u['id']))
txt=''.join(',\n  '+json.dumps(u,ensure_ascii=False) for u in nuevos)
i=base.index('\n];')
base=base[:i]+txt+base[i:]
open(M+'js/catalogo-base.js','w').write(base)
print([ (u['id'],u.get('escudo'),u['fotos']) for u in nuevos])
