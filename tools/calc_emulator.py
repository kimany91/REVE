"""Émulateur d'écran pour tester l'app REVE générée.

Exécute le VRAI script Python envoyé sur la calculatrice, en remplaçant les modules
de la calculatrice (kandinsky/ion pour NumWorks, ti_draw/ti_system pour TI) par des
versions qui dessinent dans une image. Sert aux tests et aux captures d'écran.

Usage : python3 calc_emulator.py <numworks|ti83> <script.py> <dossier_sortie>
"""
import sys, os, types
from PIL import Image, ImageDraw, ImageFont

MONO = '/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf'
SANS = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
SANSB = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'


class Stop(Exception):
    pass


class Emu:
    def __init__(self, model, actions, outdir):
        self.model = model
        self.actions = list(actions)
        self.outdir = outdir
        self.snaps = {}
        h = 222 if model == 'numworks' else 210
        self.img = Image.new('RGB', (320, h), 'white')
        self.d = ImageDraw.Draw(self.img)
        self.mono = ImageFont.truetype(MONO, 14)
        self.sans = ImageFont.truetype(SANS, 11)
        self.pending = None
        self.color = (0, 0, 0)

    # --- avance dans le scénario
    def step(self):
        while self.actions:
            a = self.actions.pop(0)
            if a[0] == 'snap':
                self.snaps[a[1]] = self.img.copy()
                continue
            return a[1]
        raise Stop()

    # --- NumWorks : kandinsky + ion
    def fill_rect(self, x, y, w, h, c):
        if w > 0 and h > 0:
            self.d.rectangle([x, y, x + w - 1, y + h - 1], fill=tuple(c))

    def draw_string(self, s, x, y, fg=(0, 0, 0), bg=(255, 255, 255)):
        for i, ch in enumerate(s):
            cx = x + 10 * i
            self.d.rectangle([cx, y, cx + 9, y + 17], fill=tuple(bg))
            self.d.text((cx + 1, y + 1), ch, font=self.mono, fill=tuple(fg))

    def keydown(self, k):
        if self.pending is None:
            return False
        if self.pending == k:
            self.pending = 'released'
            return True
        return False

    def sleep(self, t):
        if self.pending == 'released':
            self.pending = None
            return
        if self.pending is None:
            self.pending = self.step()

    # --- TI : ti_draw + ti_system
    def set_color(self, r, g, b):
        self.color = (r, g, b)

    def ti_fill_rect(self, x, y, w, h):
        self.fill_rect(x, y, w, h, self.color)

    def draw_text(self, x, y, s):
        self.d.text((x, y + 1), str(s), font=self.sans, fill=self.color)

    def clear(self):
        self.d.rectangle([0, 0, 320, 240], fill='white')

    def wait_key(self):
        return self.step()


NW_KEYS = ['LEFT', 'UP', 'DOWN', 'RIGHT', 'OK', 'BACK', 'HOME', 'ONOFF', 'SHIFT', 'ALPHA', 'XNT', 'VAR', 'TOOLBOX',
           'BACKSPACE', 'EXP', 'LN', 'LOG', 'IMAGINARY', 'COMMA', 'POWER', 'SINE', 'COSINE', 'TANGENT', 'PI', 'SQRT',
           'SQUARE', 'SEVEN', 'EIGHT', 'NINE', 'LEFTPARENTHESIS', 'RIGHTPARENTHESIS', 'FOUR', 'FIVE', 'SIX',
           'MULTIPLICATION', 'DIVISION', 'ONE', 'TWO', 'THREE', 'PLUS', 'MINUS', 'ZERO', 'DOT', 'EE', 'ANS', 'EXE']


def run(model, script, actions, outdir):
    emu = Emu(model, actions, outdir)
    for m in ['kandinsky', 'ion', 'ti_draw', 'ti_system', 'time']:
        sys.modules.pop(m, None)
    if model == 'numworks':
        kd = types.ModuleType('kandinsky')
        kd.fill_rect = emu.fill_rect
        kd.draw_string = emu.draw_string
        ion = types.ModuleType('ion')
        for i, n in enumerate(NW_KEYS):
            setattr(ion, 'KEY_' + n, i)
        ion.keydown = emu.keydown
        tm = types.ModuleType('time')
        tm.sleep = emu.sleep
        sys.modules.update({'kandinsky': kd, 'ion': ion, 'time': tm})
    else:
        td = types.ModuleType('ti_draw')
        td.set_color = emu.set_color
        td.fill_rect = emu.ti_fill_rect
        td.draw_text = emu.draw_text
        td.clear = emu.clear
        ts = types.ModuleType('ti_system')
        ts.wait_key = emu.wait_key
        sys.modules.update({'ti_draw': td, 'ti_system': ts})
    code = open(script, encoding='utf-8').read()
    try:
        exec(compile(code, script, 'exec'), {'__name__': '__main__'})
    except Stop:
        pass
    return emu.snaps


# ---------------------------------------------------------------- dessin des calculatrices
def rr(d, box, r, fill, outline=None, width=1):
    d.rounded_rectangle(box, r, fill=fill, outline=outline, width=width)


def font(sz, bold=False):
    return ImageFont.truetype(SANSB if bold else SANS, sz)


def numworks_device(screen, highlight=None, caption=''):
    S = 2
    W, H = 470 * S, 860 * S
    im = Image.new('RGB', (W, H + 70 * S), (24, 27, 51))
    d = ImageDraw.Draw(im)
    rr(d, [15 * S, 15 * S, W - 15 * S, H - 10 * S], 60 * S, (250, 250, 252), (205, 205, 214), 3 * S)
    # écran
    sx, sy = 75 * S, 60 * S
    rr(d, [sx - 12 * S, sy - 12 * S, sx + 320 * S + 12 * S, sy + 240 * S + 12 * S], 10 * S, (40, 40, 48))
    status = Image.new('RGB', (320, 18), (255, 183, 52))
    sd = ImageDraw.Draw(status)
    sd.text((136, 3), 'PYTHON', font=font(10, True), fill='white')
    sd.rectangle([292, 5, 312, 12], outline='white'); sd.rectangle([294, 7, 306, 10], fill='white')
    full = Image.new('RGB', (320, 240), 'white')
    full.paste(status, (0, 0)); full.paste(screen, (0, 18))
    im.paste(full.resize((320 * S, 240 * S), Image.NEAREST), (sx, sy))
    # flèches + OK
    cx, cy = 145 * S, 400 * S
    d.ellipse([cx - 62 * S, cy - 62 * S, cx + 62 * S, cy + 62 * S], fill=(232, 232, 238), outline=(205, 205, 214), width=2 * S)
    for (dx, dy, t, k) in [(0, -40, '▲', 'up'), (0, 40, '▼', 'down'), (-40, 0, '◀', 'left'), (40, 0, '▶', 'right')]:
        col = (255, 183, 52) if highlight == k else (120, 120, 130)
        d.text((cx + dx * S, cy + dy * S), t, font=font(16 * S), fill=col, anchor='mm')
    d.ellipse([cx - 22 * S, cy - 22 * S, cx + 22 * S, cy + 22 * S], fill=(255, 183, 52) if highlight == 'ok' else (215, 215, 222))
    d.text((cx, cy), 'OK', font=font(11 * S, True), fill=(90, 90, 100), anchor='mm')
    # maison / retour
    for (x, y, t) in [(300, 368, '⌂'), (300, 432, '↩')]:
        rr(d, [x * S, (y - 18) * S, (x + 90) * S, (y + 18) * S], 16 * S, (232, 232, 238))
        d.text(((x + 45) * S, y * S), t, font=font(14 * S), fill=(110, 110, 120), anchor='mm')
    rows = [
        [('shift', ''), ('alpha', ''), ('x,n,t', 'xnt'), ('var', 'var'), ('Boîte à\noutils', 'toolbox'), ('⌫', 'del')],
        [('eˣ', ''), ('ln', ''), ('log', ''), ('i', ''), (',', ''), ('xʸ', '')],
        [('sin', ''), ('cos', ''), ('tan', ''), ('π', ''), ('√', ''), ('x²', '')],
        [('7', '7'), ('8', '8'), ('9', '9'), ('(', ''), (')', '')],
        [('4', '4'), ('5', '5'), ('6', '6'), ('×', '*'), ('÷', '/')],
        [('1', '1'), ('2', '2'), ('3', '3'), ('+', '+'), ('−', '-')],
        [('0', '0'), ('.', '.'), ('×10ˣ', ''), ('Ans', ''), ('EXE', 'exe')],
    ]
    y = 490
    for ri, row in enumerate(rows):
        n = len(row)
        kw = 64 if n == 6 else 78
        gap = (420 - n * kw) / (n - 1)
        x = 25
        kh = 34 if ri < 3 else 42
        for (lab, k) in row:
            hl = highlight is not None and k == highlight
            fill = (255, 183, 52) if hl else ((255, 255, 255) if ri >= 3 else (236, 236, 241))
            if lab == 'EXE' and not hl:
                fill = (255, 214, 140)
            rr(d, [x * S, y * S, (x + kw) * S, (y + kh) * S], 9 * S, fill, (200, 200, 210), 1 * S)
            fs = 11 if '\n' in lab else (15 if ri >= 3 else 13)
            d.multiline_text(((x + kw / 2) * S, (y + kh / 2) * S), lab, font=font(fs * S, ri >= 3 or hl), fill=(60, 60, 70), anchor='mm', align='center')
            if hl:
                rr(d, [(x - 4) * S, (y - 4) * S, (x + kw + 4) * S, (y + kh + 4) * S], 12 * S, None, (255, 140, 0), 3 * S)
            x += kw + gap
        y += kh + (12 if ri < 3 else 14)
    if caption:
        d.text((W // 2, H + 30 * S), caption, font=font(19 * S, True), fill='white', anchor='mm')
    return im.resize((W // 2, (H + 70 * S) // 2), Image.LANCZOS)


def ti_device(screen, highlight=None, caption=''):
    S = 2
    W, H = 470 * S, 900 * S
    im = Image.new('RGB', (W, H + 70 * S), (24, 27, 51))
    d = ImageDraw.Draw(im)
    rr(d, [15 * S, 15 * S, W - 15 * S, H - 10 * S], 50 * S, (44, 55, 80), (20, 26, 40), 3 * S)
    d.text((W // 2, 42 * S), 'TI-83 Premium CE  ·  Édition Python', font=font(13 * S, True), fill=(210, 216, 230), anchor='mm')
    sx, sy = 75 * S, 66 * S
    rr(d, [sx - 12 * S, sy - 12 * S, sx + 320 * S + 12 * S, sy + 240 * S + 12 * S], 8 * S, (16, 18, 26))
    full = Image.new('RGB', (320, 240), 'white')
    st = ImageDraw.Draw(full)
    st.rectangle([0, 0, 320, 29], fill=(30, 30, 30))
    st.text((8, 8), 'PYTHON   REVE', font=font(11, True), fill=(255, 255, 255))
    st.rectangle([288, 9, 310, 19], outline='white'); st.rectangle([290, 11, 304, 17], fill=(90, 220, 120))
    full.paste(screen, (0, 30))
    im.paste(full.resize((320 * S, 240 * S), Image.NEAREST), (sx, sy))
    rows = [
        [('f1 Y=', ''), ('f2', ''), ('f3', ''), ('f4', ''), ('f5', '')],
        [('2nde', ''), ('mode', ''), ('suppr', 'del'), ('', ''), ('', '')],
        [('alpha', ''), ('X,T,θ,n', ''), ('stats', ''), ('', ''), ('', '')],
        [('math', 'reve'), ('apps', ''), ('prgm', ''), ('var', ''), ('annul', 'clear')],
        [('x⁻¹', ''), ('sin', ''), ('cos', ''), ('tan', ''), ('^', '')],
        [('x²', ''), (',', ''), ('(', ''), (')', ''), ('÷', '/')],
        [('log', ''), ('7', '7'), ('8', '8'), ('9', '9'), ('×', '*')],
        [('ln', ''), ('4', '4'), ('5', '5'), ('6', '6'), ('−', '-')],
        [('sto→', ''), ('1', '1'), ('2', '2'), ('3', '3'), ('+', '+')],
        [('on', ''), ('0', '0'), ('.', '.'), ('(−)', ''), ('entrer', 'exe')],
    ]
    y = 340
    for ri, row in enumerate(rows):
        x = 30
        kw, gap, kh = 70, 15, 30
        for ci, (lab, k) in enumerate(row):
            if ri in (1, 2) and ci >= 3:
                x += kw + gap
                continue
            hl = highlight is not None and k == highlight
            if ri == 0:
                fill = (214, 220, 232)
            elif lab.isdigit() or lab == '.' or lab == '(−)':
                fill = (232, 235, 240)
            elif lab == 'entrer':
                fill = (90, 110, 150)
            elif lab in ('2nde',):
                fill = (70, 140, 220)
            elif lab == 'alpha':
                fill = (90, 180, 110)
            else:
                fill = (24, 30, 44)
            if hl:
                fill = (255, 183, 52)
            rr(d, [x * S, y * S, (x + kw) * S, (y + kh) * S], 8 * S, fill)
            dark = fill[0] > 150 and not hl
            d.text(((x + kw / 2) * S, (y + kh / 2) * S), lab, font=font(12 * S, True), fill=(30, 30, 40) if (dark or hl) else (235, 238, 245), anchor='mm')
            if hl:
                rr(d, [(x - 4) * S, (y - 4) * S, (x + kw + 4) * S, (y + kh + 4) * S], 10 * S, None, (255, 140, 0), 3 * S)
            x += kw + gap
        y += kh + 14
    # croix directionnelle
    cx, cy = 368, 422
    d.ellipse([(cx - 50) * S, (cy - 50) * S, (cx + 50) * S, (cy + 50) * S], fill=(24, 30, 44))
    for (dx, dy, t, k) in [(0, -32, '▲', 'up'), (0, 32, '▼', 'down'), (-32, 0, '◀', 'left'), (32, 0, '▶', 'right')]:
        d.text(((cx + dx) * S, (cy + dy) * S), t, font=font(15 * S), fill=(255, 183, 52) if highlight == k else (200, 205, 220), anchor='mm')
    if caption:
        d.text((W // 2, H + 30 * S), caption, font=font(19 * S, True), fill='white', anchor='mm')
    return im.resize((W // 2, (H + 70 * S) // 2), Image.LANCZOS)


def side_by_side(images, title):
    pad = 30
    w = sum(i.width for i in images) + pad * (len(images) + 1)
    h = max(i.height for i in images) + 90
    out = Image.new('RGB', (w, h), (24, 27, 51))
    d = ImageDraw.Draw(out)
    d.text((w // 2, 45), title, font=font(26, True), fill='white', anchor='mm')
    x = pad
    for i in images:
        out.paste(i, (x, 80))
        x += i.width + pad
    return out


if __name__ == '__main__':
    model, script, outdir = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(outdir, exist_ok=True)
    if model == 'numworks':
        K = {n.lower(): i for i, n in enumerate(NW_KEYS)}
        keys = lambda *ks: [('key', K[k]) for k in ks]
        acts = keys('one', 'two', 'multiplication', 'three', 'exe', 'sqrt', 'two', 'rightparenthesis', 'exe',
                    'nine', 'dot', 'eight', 'one', 'multiplication', 'two') + [('snap', 'calc')] + \
            keys('toolbox') + [('snap', 'rev1')] + keys('right') + [('snap', 'rev2')] + keys('right', 'right', 'right') + [('snap', 'rev3')] + \
            keys('ok') + [('snap', 'menu')] + keys('down', 'down', 'ok', 'toolbox', 'exe') + [('snap', 'back')]
        snaps = run('numworks', script, acts, outdir)
        a = numworks_device(snaps['calc'], None, '① Écran de calcul normal')
        b = numworks_device(snaps['rev1'], 'toolbox', '② Touche REVE → fiches')
        c = numworks_device(snaps['rev3'], 'right', '③ ◀ ▶ change de chapitre')
        e = numworks_device(snaps['menu'], 'ok', '④ OK : liste des chapitres')
        side_by_side([a, b, c, e], 'REVE sur NumWorks : calcul ⇄ révision avec la même touche').save(os.path.join(outdir, 'numworks-rendu.png'))
        for k, im in snaps.items():
            im.resize((640, 444), Image.NEAREST).save(os.path.join(outdir, 'numworks-ecran-%s.png' % k))
        # vérifie que rappuyer sur la touche REVE ramène bien au calcul
        assert snaps['back'].getpixel((10, 5)) == (255, 183, 52), 'retour au calcul raté'
    else:
        G = {'1': 92, '2': 93, '3': 94, '4': 82, '5': 83, '6': 84, '7': 72, '8': 73, '9': 74, '0': 102, '.': 103, '+': 95, '-': 85, '*': 75, '/': 65,
             'exe': 105, 'clear': 45, 'up': 25, 'down': 34, 'left': 24, 'right': 26, 'math': 41}
        keys = lambda *ks: [('key', G[k]) for k in ks]
        acts = keys('1', '2', '*', '3', 'exe', '9', '.', '8', '1', '*', '2', 'exe', '1', '/', '4') + [('snap', 'calc')] + \
            keys('math') + [('snap', 'rev1')] + keys('right', 'right') + [('snap', 'rev2')] + keys('down', 'down') + [('snap', 'rev3')] + keys('math') + [('snap', 'back')]
        snaps = run('ti83', script, acts, outdir)
        a = ti_device(snaps['calc'], None, '① Écran de calcul normal')
        b = ti_device(snaps['rev1'], 'reve', '② [math] → fiches')
        c = ti_device(snaps['rev3'], 'down', '③ ▲ ▼ ◀ ▶ pour naviguer')
        d = ti_device(snaps['back'], 'reve', '④ [math] à nouveau → calcul')
        side_by_side([a, b, c, d], 'REVE sur TI-83 Premium CE : calcul ⇄ révision avec la même touche').save(os.path.join(outdir, 'ti83-rendu.png'))
        for k, im in snaps.items():
            im.resize((640, 420), Image.NEAREST).save(os.path.join(outdir, 'ti83-ecran-%s.png' % k))
        # touches de l'autre famille de codes (OS récents) : doivent aussi marcher
        acts2 = [('key', 143), ('key', 128), ('key', 144), ('key', 5), ('key', 50), ('snap', 'r'), ('key', 50), ('snap', 'c')]
        s2 = run('ti83', script, acts2, outdir)
        assert s2['r'].getpixel((10, 5)) == (46, 92, 201) and s2['c'].getpixel((10, 5)) == (40, 40, 40), 'codes systeme KO'
    print('ok', sorted(snaps))
