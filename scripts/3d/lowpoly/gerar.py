"""
Gera os móveis do Bar em LOW-POLY FACETADO e exporta GLB em client/public/prototipo3d/lowpoly/<defId>.glb.

  "F:/Programas/Blender 5.2/blender.exe" -b --factory-startup -P scripts/3d/lowpoly/gerar.py -- [--so a,b,c]
"""
import os
import sys

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)
import lib  # noqa: E402
from moveis import MODELOS  # noqa: E402

RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
SAIDA = os.path.join(RAIZ, "client", "public", "prototipo3d", "lowpoly")
args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SO = set(args[args.index("--so") + 1].split(",")) if "--so" in args else None

print("RELATORIO (largura x fundo x altura, base y; triangulos):")
for nome, fazer in MODELOS.items():
    if SO and nome not in SO:
        continue
    lib.limpar_cena()
    m = lib.Modelo(nome)
    fazer(m)
    ob = m.objeto()
    ob.data.calc_loop_triangles()
    tris = len(ob.data.loop_triangles)
    lib.exportar(ob, os.path.join(SAIDA, nome + ".glb"))
    md = lib.medidas(ob)
    print(f"  {nome}: {md[0]} x {md[1]} x {md[2]} (base {md[3]}) tri={tris}")
