# ---------- a montagem (as posições medidas na referência, a sala de 5 x 5 casas) ----------
L_ = SALA
# parede da esquerda (x = 0), do canto de trás para a frente: o sofá com o quadro em cima, a porta, a plaquinha e a estante baixa
quadro_esq(0.62, 1.08, 1.16, 1.6)
sofa(0.06, 0.18, 1.42)
porta(1.6, 2.32)
placa('x', 2.75, 3.1, 1.36, 1.5)
estante_baixa(2.5, 3.56)
# parede de trás (y = 0): a estante de livros, a plaquinha, a lareira, o relógio e a escrivaninha com o teclado
estante_parede_tras(0.22, 1.02)
placa('y', 1.08, 1.42, 1.52, 1.66)
lareira(2.12)
relogio_parede(3.28, 1.2)
piano(2.98, 3.62)
# no chão: a mesinha, o barril, a mesa com 6 cadeiras (2 + 2 nos lados compridos, 1 em cada ponta) e o vaso
mesinha(0.98, 1.95)
barril_cesto(0.62, 3.42)
mx0, mx1, my0, my1 = 1.62, 2.98, 2.2, 3.0
mesa(mx0, my0, mx1 - mx0, my1 - my0)
for cx in (1.82, 2.42):
    cadeira(cx, my0 - 0.36, '-y')
    cadeira(cx, my1 - 0.08, '+y')
cadeira(mx0 - 0.36, (my0 + my1) / 2 - 0.22, '-x')
cadeira(mx1 - 0.08, (my0 + my1) / 2 - 0.22, '+x')
vaso(2.32, 2.6, 0.78)
FOGO = (2.12, 0.9)
