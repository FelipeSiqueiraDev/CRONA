"""
Biblioteca do estilo LOW-POLY FACETADO (referência de estilo: Synty POLYGON; nenhum modelo copiado): caixas chanfradas,
cilindros baixos de 6-8 lados, prismas e icosferas de 1 subdivisão, cor chapada por material, flat shading de verdade (cada
face tem a própria normal), SEM textura, SEM brilho (rugosidade 1, metal 0, sem especular).

Convenção das coordenadas desta biblioteca = a do glTF/three.js (o que o cliente vê):
  x = direita, y = CIMA, z = FRENTE do móvel (a frente do móvel fica virada para +Z).
  Unidades: metros. Origem: centro da pegada, no chão (y = 0). Na hora de criar a malha no Blender, (x, y, z) vira
  (x, -z, y), que é uma rotação (sem espelhar), e o exportador do glTF devolve para (x, y, z).

Uso típico (ver moveis.py):
    m = Modelo("table_bar")
    m.caixa("AMARELO", 0, 0.70, 0, 0.70, 0.05, 0.70, bisel=0.012)       # material, x, y(base), z, largura, altura, fundo
    m.cil("MADEIRA_ESC", 0, 0.0, 0, 0.05, 0.70, seg=6)                   # material, x, y(base), z, raio, altura
"""
import math
import os

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector


# ------------------------------------------------------------------ paleta (cores chapadas; sem textura)
# A identidade do bar isométrico: mesas e cadeiras amarelas, madeira escura, couro vermelho, feltro verde, geladeiras
# amarela, vermelha e cinza, neon rosa. Um pouco mais saturadas que a pintura realista, como no low-poly.
PALETA = {
    "AMARELO": "#d9a521",
    "AMARELO_ESC": "#a8761a",
    "AMARELO_CLARO": "#ecc650",
    "MADEIRA_ESC": "#3a2214",
    "MADEIRA": "#6b4023",
    "MADEIRA_MEDIA": "#8a5a30",
    "MADEIRA_CLARA": "#b58552",
    "COURO_VERM": "#a52a1e",
    "COURO_VERM_ESC": "#6e1812",
    "COURO_ESC": "#2a1a14",
    "METAL": "#9a9ea6",
    "METAL_CLARO": "#c4c8ce",
    "METAL_ESC": "#3a3c44",
    "LATAO": "#b88c34",
    "FELTRO": "#1f8a3c",
    "FELTRO_ESC": "#16662c",
    "PRETO": "#16141a",
    "GELADEIRA_AMARELA": "#d4a428",
    "GELADEIRA_VERM": "#b02a20",
    "GELADEIRA_CINZA": "#4a5560",
    "PLASTICO_VERM": "#c23a28",
    "PLASTICO_AZUL": "#2f5cb0",
    "FOLHA": "#2f7a34",
    "FOLHA_ESC": "#1f5a28",
    "FOLHA_CLARA": "#4a9a42",
    "TERRACOTA": "#b8642e",
    "CONCRETO": "#6a6860",
    "BEGE": "#cdbf9a",
    "BRANCO": "#e6e0cf",
    "CINZA": "#8a8478",
    "ABAJUR": "#e8d8aa",
    "PAPEL": "#e4dcc2",
    "SUJEIRA": "#6a5038",
    "ESPUMA": "#f1ead2",
    "LARANJA": "#d9761a",
    "CERVEJA": "#d98a1a",
    "GARRAFA_VERDE": "#2a7a3c",
    "GARRAFA_AMBAR": "#8a4a14",
    "GARRAFA_CLARA": "#b8d8d0",
    "GARRAFA_VERM": "#9a2424",
    "LATA_VERM": "#c42a2a",
    "LATA_AZUL": "#2a58c4",
    "LATA_PRATA": "#bcc0c6",
    "CABO": "#18181c",
    "TAPETE_VERM": "#8a2018",
    "TAPETE_AZUL": "#1f3a78",
    "TAPETE_OURO": "#d4a43a",
    "TAPETE_CREME": "#d8c89a",
    "TAPETE_GASTO": "#5a2222",
    "TAPETE_GASTO2": "#8a6a3a",
    "BOLA_BRANCA": "#f0ece0",
    "BOLA_AMARELA": "#e8c020",
    "BOLA_AZUL": "#2a52b0",
    "BOLA_VERM": "#c02a22",
    "BOLA_ROXA": "#6a2a8a",
    "BOLA_PRETA": "#16141a",
    "ARCADE_AZUL": "#2a2478",
    "ARCADE_ROXO": "#6a5aff",
}
# nome: (cor, forca) , emissivo ligado como luz/brilho pelo cliente; alfa só no vidro
EMISSIVOS = {
    "EMISSIVO": ("#ffd9a0", 1.0),
    "EMISSIVO_VERDE": ("#7dff9a", 1.0),
    "EMISSIVO_AZUL": ("#5ac8ff", 1.0),
    "EMISSIVO_ROXO": ("#a58aff", 1.0),
    "NEON_ROSA": ("#ff4f9a", 1.0),
    "CHAMA": ("#ffb347", 1.0),
}
ALFAS = {"VIDRO": ("#9ec4d8", 0.28), "POCA": ("#3a5a78", 0.7)}

_mats = {}


def srgb(h):
    h = h.lstrip("#")
    c = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return [(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4) for x in c]


def mat(nome):
    """Material sem textura: Principled com cor chapada, rugosidade 1, metal 0, sem especular."""
    if nome in _mats:
        return _mats[nome]
    m = bpy.data.materials.new(nome)
    m.use_nodes = True
    n = m.node_tree.nodes["Principled BSDF"]
    if nome in EMISSIVOS:
        cor, forca = EMISSIVOS[nome]
        base = cor
    elif nome in ALFAS:
        base, alfa = ALFAS[nome]
        n.inputs["Alpha"].default_value = alfa
        for atr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
            try:
                setattr(m, atr, val)
            except Exception:
                pass
    else:
        base = PALETA[nome]
    n.inputs["Base Color"].default_value = srgb(base) + [1]
    n.inputs["Roughness"].default_value = 1.0
    n.inputs["Metallic"].default_value = 0.0
    for k in ("Specular IOR Level", "Specular"):
        if k in n.inputs:
            n.inputs[k].default_value = 0.0
    if nome in EMISSIVOS:
        n.inputs["Emission Color"].default_value = srgb(EMISSIVOS[nome][0]) + [1]
        n.inputs["Emission Strength"].default_value = EMISSIVOS[nome][1]
    _mats[nome] = m
    return m


# ------------------------------------------------------------------ o modelo
class Modelo:
    """Acumula as peças de um móvel, um bmesh por material, e vira UM objeto (com um slot por material)."""

    def __init__(self, nome):
        self.nome = nome
        self.bms = {}

    def _bm(self, mt):
        if mt not in self.bms:
            self.bms[mt] = bmesh.new()
        return self.bms[mt]

    def _peca(self, mt, verts, faces, centro, rot=(0, 0, 0), bisel=0.0):
        """verts em coordenadas locais (em torno da origem); rot em graus (x, y, z); centro em coordenadas do móvel."""
        bm = self._bm(mt)
        antes = set(bm.verts)
        vs = [bm.verts.new(v) for v in verts]
        fs = []
        for f in faces:
            try:
                fs.append(bm.faces.new([vs[i] for i in f]))
            except ValueError:
                pass
        if bisel > 0:
            arestas = list({e for f in fs for e in f.edges})
            bmesh.ops.bevel(bm, geom=arestas, offset=bisel, offset_type="OFFSET", segments=1, affect="EDGES", clamp_overlap=True)
        R = Euler([math.radians(a) for a in rot], "XYZ").to_matrix()
        T = Vector(centro)
        # transforma só os vértices desta peça: os marcados com `tag`
        for v in bm.verts:
            if v in antes:
                continue
            v.co = R @ v.co + T

    def _fim_peca(self):
        pass

    # ---- primitivas
    def caixa(self, mt, x, y, z, w, h, d, top=None, top_off=(0, 0), bisel=0.0, rot=(0, 0, 0), alinhar="base"):
        """Caixa chanfrada: centro (x, z), base em y, largura w (x), altura h, fundo d (z).
        `top=(tw, td)` afunila o topo (tronco); `top_off=(dx, dz)` desloca o topo. alinhar='centro' põe y no meio."""
        y0 = -h / 2
        tw, td = (w, d) if top is None else top
        ax, az = top_off
        v = [
            (-w / 2, y0, -d / 2), (w / 2, y0, -d / 2), (w / 2, y0, d / 2), (-w / 2, y0, d / 2),
            (-tw / 2 + ax, y0 + h, -td / 2 + az), (tw / 2 + ax, y0 + h, -td / 2 + az),
            (tw / 2 + ax, y0 + h, td / 2 + az), (-tw / 2 + ax, y0 + h, td / 2 + az),
        ]
        f = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
        cy = y if alinhar == "centro" else y + h / 2
        self._marcar(mt, v, f, (x, cy, z), rot, bisel)

    def cil(self, mt, x, y, z, r, h, seg=8, rtop=None, rot=(0, 0, 0), alinhar="base", giro=0.0, achatar=(1.0, 1.0)):
        """Cilindro/tronco/cone de `seg` lados (6-8 é o estilo); rtop=0 faz um cone. `achatar=(sx, sz)` faz oval."""
        rtop = r if rtop is None else rtop
        y0 = -h / 2
        n = seg
        vb = [(math.cos(giro + 2 * math.pi * i / n) * r * achatar[0], y0, math.sin(giro + 2 * math.pi * i / n) * r * achatar[1]) for i in range(n)]
        v = list(vb)
        f = []
        if rtop > 1e-6:
            vt = [(math.cos(giro + 2 * math.pi * i / n) * rtop * achatar[0], y0 + h, math.sin(giro + 2 * math.pi * i / n) * rtop * achatar[1]) for i in range(n)]
            v += vt
            f.append(tuple(range(n - 1, -1, -1)))
            f.append(tuple(range(n, 2 * n)))
            for i in range(n):
                j = (i + 1) % n
                f.append((i, j, n + j, n + i))
        else:
            v.append((0, y0 + h, 0))
            f.append(tuple(range(n - 1, -1, -1)))
            for i in range(n):
                f.append((i, (i + 1) % n, n))
        cy = y if alinhar == "centro" else y + h / 2
        self._marcar(mt, v, f, (x, cy, z), rot, 0.0)

    def prisma(self, mt, pts, y, h, rot=(0, 0, 0), bisel=0.0, top_scale=1.0):
        """Prisma: polígono convexo `pts` [(x, z)...] (sentido anti-horário visto de cima) extrudado de y a y+h."""
        n = len(pts)
        cx = sum(p[0] for p in pts) / n
        cz = sum(p[1] for p in pts) / n
        v = [(p[0] - cx, -h / 2, p[1] - cz) for p in pts] + [((p[0] - cx) * top_scale, h / 2, (p[1] - cz) * top_scale) for p in pts]
        f = [tuple(range(n - 1, -1, -1)), tuple(range(n, 2 * n))]
        for i in range(n):
            j = (i + 1) % n
            f.append((i, j, n + j, n + i))
        self._marcar(mt, v, f, (cx, y + h / 2, cz), rot, bisel)

    def ico(self, mt, x, y, z, r, esc=(1, 1, 1), sub=1, rot=(0, 0, 0)):
        """Icosfera (sub=1: 80 faces; sub=0 não existe: uso 1) com escala por eixo; (x, y, z) é o CENTRO."""
        tmp = bmesh.new()
        bmesh.ops.create_icosphere(tmp, subdivisions=sub, radius=r)
        v = [(vv.co.x * esc[0], vv.co.y * esc[1], vv.co.z * esc[2]) for vv in tmp.verts]
        idx = {vv: i for i, vv in enumerate(tmp.verts)}
        f = [tuple(idx[vv] for vv in ff.verts) for ff in tmp.faces]
        tmp.free()
        self._marcar(mt, v, f, (x, y, z), rot, 0.0)

    def poligono(self, mt, verts, faces, centro=(0, 0, 0), rot=(0, 0, 0)):
        """Peça livre: verts locais + faces (índices)."""
        self._marcar(mt, verts, faces, centro, rot, 0.0)

    def _marcar(self, mt, verts, faces, centro, rot, bisel):
        self._peca(mt, verts, faces, centro, rot, bisel)

    # ---- fim
    def objeto(self):
        """Vira UM objeto: (x, y, z) -> (x, -z, y), flat shading, um slot por material."""
        me = bpy.data.meshes.new(self.nome)
        todos = bmesh.new()
        slots = []
        for mt, bm in self.bms.items():
            bm.verts.ensure_lookup_table()
            idx = len(slots)
            slots.append(mt)
            for ff in bm.faces:
                ff.material_index = idx
            for v in bm.verts:
                x, y, z = v.co
                v.co = Vector((x, -z, y))
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
            tmp = bpy.data.meshes.new("tmp")
            bm.to_mesh(tmp)
            bm.free()
            todos.from_mesh(tmp)
            bpy.data.meshes.remove(tmp)
        todos.to_mesh(me)
        todos.free()
        for mt in slots:
            me.materials.append(mat(mt))
        for p in me.polygons:
            p.use_smooth = False  # FLAT SHADING real: cada face com a sua normal
        ob = bpy.data.objects.new(self.nome, me)
        bpy.context.scene.collection.objects.link(ob)
        return ob


# ------------------------------------------------------------------ exportar
def limpar_cena():
    for o in list(bpy.data.objects):
        bpy.data.objects.remove(o, do_unlink=True)
    for me in list(bpy.data.meshes):
        bpy.data.meshes.remove(me)


def exportar(ob, caminho):
    os.makedirs(os.path.dirname(caminho), exist_ok=True)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True)
    bpy.context.view_layer.objects.active = ob
    bpy.ops.export_scene.gltf(
        filepath=caminho,
        export_format="GLB",
        use_selection=True,
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_cameras=False,
        export_lights=False,
        export_normals=True,
        export_texcoords=False,
        export_vertex_color="NONE",
        export_image_format="NONE",
    )


def medidas(ob):
    """(largura x, altura y, fundo z, base y) já no sistema do glTF."""
    c = [Vector(v) for v in ob.bound_box]
    xs = [v.x for v in c]
    ys = [v.y for v in c]
    zs = [v.z for v in c]
    return (round(max(xs) - min(xs), 3), round(max(zs) - min(zs), 3), round(max(ys) - min(ys), 3), round(min(zs), 3))
