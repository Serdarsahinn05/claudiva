"""Claudiva logosu (Çekirdek): bütün SVG'leri bu klasöre üretir.

    python docs/brand/build-logo.py

Fikir: dışta ekibin çerçevesi (sivri tepeli altıgen), içte 30° dönük dolu
altıgen, yani lider. Dönüş farkı iki katmanı ayırır.

Geometri (256 birimlik tuval, merkez 128,128). Konturlar dolu şekle
çevrilmiştir; dosyalarda stroke yok, her programda aynı görünür.
- Dış halka: köşe uzaklığı r_out, kalınlık w_out. Dış köşeler w_out/2
  yarıçapla yuvarlak, iç köşeler keskin (konturun `round` birleşimiyle aynı).
- Çekirdek: köşe uzaklığı r_in, köşeleri rad_in ile yuvarlak.
- Küçük çizim (16-32 px, favicon): halka kalın, çekirdek büyük; aradaki boşluk
  küçük boyutta kapanmasın diye.

Uygulama simgesi PNG'si (1024) bu SVG'den üretilir, Tauri simgeleri de ondan:
`cd desktop && npx tauri icon ../docs/brand/claudiva-app-icon-1024.png`
(oluşan android/ ve ios/ klasörleri kullanılmıyor, silinir).
"""
import math
import pathlib

D = pathlib.Path(__file__).parent
C = 128.0

TEAL, WHITE, TILE = "#3EE0C0", "#E8F3EF", "#0D1B17"  # koyu zemin (ana sürüm)
GREEN, INK = "#0A7852", "#121A1C"                     # açık zemin


def verts(r, rot):
    return [(C + r * math.cos(math.radians(rot + 60 * i)), C + r * math.sin(math.radians(rot + 60 * i)))
            for i in range(6)]


def rounded_hex(r, rot, rad):
    """Köşe merkezleri r uzaklıkta bir altıgenin `rad` kadar dışa ötelenmiş,
    köşeleri `rad` yarıçaplı yaylarla yuvarlatılmış hâli."""
    v = verts(r, rot)
    n = len(v)

    def outward_normal(a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        L = math.hypot(dx, dy)
        nx, ny = dy / L, -dx / L
        mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
        return (nx, ny) if (mx - C) * nx + (my - C) * ny > 0 else (-nx, -ny)

    pts = []
    for i in range(n):
        p_prev, p, p_next = v[i - 1], v[i], v[(i + 1) % n]
        n1, n2 = outward_normal(p_prev, p), outward_normal(p, p_next)
        pts.append(((p[0] + n1[0] * rad, p[1] + n1[1] * rad), (p[0] + n2[0] * rad, p[1] + n2[1] * rad)))
    d = f"M{pts[0][1][0]:.2f} {pts[0][1][1]:.2f}"
    for i in range(1, n + 1):
        a, b = pts[i % n]
        d += f" L{a[0]:.2f} {a[1]:.2f} A{rad} {rad} 0 0 1 {b[0]:.2f} {b[1]:.2f}"
    return d + " Z"


def sharp_hex(r, rot):
    return "M" + " L".join(f"{x:.2f} {y:.2f}" for x, y in reversed(verts(r, rot))) + " Z"


def mark(r_out, w_out, r_in, rad_in, team, lead):
    r_hole = r_out - (w_out / 2) / math.cos(math.radians(30))
    ring = rounded_hex(r_out, -90, w_out / 2) + " " + sharp_hex(r_hole, -90)
    core = rounded_hex(r_in, -60, rad_in)
    return (f'<path d="{ring}" fill="{team}" fill-rule="evenodd"/>\n'
            f'<path d="{core}" fill="{lead}"/>')


def svg(body, name, bg=None):
    rect = f'<rect width="256" height="256" rx="56" fill="{bg}"/>\n' if bg else ""
    s = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">\n'
         f'<title>Claudiva</title>\n{rect}{body}\n</svg>\n')
    (D / name).write_text(s, encoding="utf-8")


def scaled(body, k):
    t = 128 * (1 - k)
    return f'<g transform="translate({t:.2f} {t:.2f}) scale({k})">\n{body}\n</g>'


STD = dict(r_out=98, w_out=24, r_in=44, rad_in=6)     # 48 px ve üstü
SMALL = dict(r_out=96, w_out=34, r_in=46, rad_in=6)   # 16-32 px

if __name__ == "__main__":
    svg(mark(**STD, team=TEAL, lead=WHITE), "claudiva-mark-dark.svg")
    svg(mark(**STD, team=GREEN, lead=INK), "claudiva-mark-light.svg")
    svg(mark(**STD, team="#000", lead="#000"), "claudiva-mark-black.svg")
    svg(mark(**STD, team="#fff", lead="#fff"), "claudiva-mark-white.svg")
    svg(mark(**SMALL, team=TEAL, lead=WHITE), "claudiva-mark-small-dark.svg")
    svg(scaled(mark(**STD, team=TEAL, lead=WHITE), 0.70), "claudiva-app-icon.svg", bg=TILE)
    svg(scaled(mark(**SMALL, team=TEAL, lead=WHITE), 0.78), "claudiva-favicon.svg", bg=TILE)
    print("ok")
