"""Mini-émulateur TI-Basic (TI-83 Premium CE) pour tester REVE.8xp sans calculatrice.

Lit le VRAI fichier .8xp (octets), le découpe en jetons avec la table officielle,
l'exécute (sous-ensemble du TI-Basic utilisé par REVE) et dessine l'écran.
Il signale les erreurs que ferait la vraie calculatrice : jeton inconnu, texte
hors de l'écran, sub( de longueur 0, fuite mémoire (Goto dans un bloc), etc.

Usage : python3 ti_basic_emulator.py REVE.8xp dossier_sortie
"""
import json, math, os, sys
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
TOK = json.load(open(os.path.join(HERE, '../src/main/calc/ti/tokens.json'), encoding='utf-8'))
PREFIX = {0x5C, 0x5D, 0x5E, 0x60, 0x61, 0x62, 0x63, 0x7E, 0xAA, 0xBB, 0xEF}
REV = {}
for name, hx in TOK.items():
    cur = REV.get(hx)
    # nom préféré : celui avec des caractères non ASCII (→, ⁻, ≥…), sinon le plus court
    score = (any(ord(c) > 127 for c in name), -len(name))
    if cur is None or score > cur[0]:
        REV[hx] = (score, name)
REV = {k: v[1] for k, v in REV.items()}
REV.update({'29': ' ', '2a': '"', '3a': '.', 'b0': '⁻', '04': '→', '2b': ',', '10': '(', '11': ')', '6a': '=', '6f': '≠', '6d': '≤', '6e': '≥', '6b': '<', '6c': '>', '70': '+', '71': '-', '82': '*', '83': '/', 'f0': '^', '0d': '²', 'bc': '√(', 'ac': 'π'})

COLORS = {'BLUE': (0, 0, 255), 'RED': (255, 0, 0), 'BLACK': (0, 0, 0), 'MAGENTA': (255, 0, 255), 'GREEN': (0, 158, 0),
          'ORANGE': (255, 140, 0), 'BROWN': (150, 75, 0), 'NAVY': (0, 0, 128), 'LTBLUE': (90, 170, 255), 'YELLOW': (255, 255, 0),
          'WHITE': (255, 255, 255), 'LTGRAY': (210, 210, 210), 'MEDGRAY': (160, 160, 160), 'GRAY': (128, 128, 128), 'DARKGRAY': (80, 80, 80)}
for _k in list(COLORS):
    COLORS[_k.replace('GRAY', 'GREY')] = COLORS[_k]
FONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 10)
HOMEFONT = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf', 15)


class TIError(Exception):
    pass


class Stop(Exception):
    pass


def detokenize(data):
    lines, cur, i = [], [], 0
    instr = False
    while i < len(data):
        b = data[i]
        if b == 0x3F:
            lines.append(cur); cur = []; instr = False; i += 1; continue
        if b in PREFIX:
            hx = data[i:i + 2].hex(); i += 2
        else:
            hx = '%02x' % b; i += 1
        if hx not in REV:
            raise TIError('jeton inconnu ' + hx)
        name = REV[hx]
        if hx == '2a':
            instr = not instr
        if hx == '04':
            instr = False
        cur.append(name)
    lines.append(cur)
    return lines


class Prog:
    def __init__(self, data, keys, outdir):
        self.lines = detokenize(data)
        self.labels = {}
        for i, l in enumerate(self.lines):
            if l and l[0] == 'Lbl ':
                lab = ''.join(l[1:])
                if lab in self.labels:
                    raise TIError('étiquette en double ' + lab)
                self.labels[lab] = i
        self.keys = list(keys)
        self.outdir = outdir
        self.vars = {}
        self.ans = 0
        self.stack = []
        self.color = 'BLUE'
        self.graph = Image.new('RGB', (265, 165), 'white')
        self.gd = ImageDraw.Draw(self.graph)
        self.screen = 'home'
        self.home = []
        self.snaps = {}
        self.steps = 0
        self.maxstack = 0

    # ------------------------------------------------ scénario
    def next_action(self):
        while self.keys:
            a = self.keys.pop(0)
            if isinstance(a, tuple) and a[0] == 'snap':
                self.snaps[a[1]] = self.render()
                continue
            return a
        raise Stop()

    def render(self):
        if self.screen == 'graph':
            return self.graph.copy()
        im = Image.new('RGB', (265, 165), 'white')
        d = ImageDraw.Draw(im)
        for i, (txt, inv) in enumerate(self.home[:10]):
            y = i * 16
            if inv:
                d.rectangle([0, y, 264, y + 15], fill=(0, 0, 0))
            d.text((2, y), txt, font=HOMEFONT, fill='white' if inv else 'black')
        return im

    # ------------------------------------------------ expressions
    def parse_expr(self, toks):
        self.t = toks
        self.p = 0
        v = self.e_or()
        if self.p != len(self.t):
            raise TIError('syntaxe : ' + ''.join(self.t[self.p:]))
        return v

    def peek(self):
        return self.t[self.p] if self.p < len(self.t) else None

    def take(self):
        x = self.t[self.p]; self.p += 1; return x

    def e_or(self):
        v = self.e_and()
        while self.peek() in (' or ', ' xor '):
            op = self.take(); w = self.e_and()
            v = float(bool(v) or bool(w)) if op == ' or ' else float(bool(v) != bool(w))
        return v

    def e_and(self):
        v = self.e_cmp()
        while self.peek() == ' and ':
            self.take(); w = self.e_cmp(); v = float(bool(v) and bool(w))
        return v

    def e_cmp(self):
        v = self.e_add()
        while self.peek() in ('=', '≠', '<', '>', '≤', '≥'):
            op = self.take(); w = self.e_add()
            if isinstance(v, list) != isinstance(w, list) and op not in ('=', '≠'):
                raise TIError('type : comparaison chaîne/nombre')
            v = float({'=': v == w, '≠': v != w, '<': v < w, '>': v > w, '≤': v <= w, '≥': v >= w}[op])
        return v

    def e_add(self):
        v = self.e_mul()
        while self.peek() in ('+', '-'):
            op = self.take(); w = self.e_mul()
            if isinstance(v, list) or isinstance(w, list):
                if op != '+' or not (isinstance(v, list) and isinstance(w, list)):
                    raise TIError('type : chaîne')
                v = v + w
            else:
                v = v + w if op == '+' else v - w
        return v

    def e_mul(self):
        v = self.e_neg()
        while True:
            nx = self.peek()
            if nx in ('*', '/'):
                self.take(); w = self.e_neg()
                if nx == '/' and w == 0:
                    raise TIError('division par 0')
                v = v * w if nx == '*' else v / w
            elif nx is not None and (nx == '(' or nx.endswith('(') and nx not in ('Text(',) or nx in ('π', 'Ans') or len(nx) == 1 and nx.isupper() or nx[0].isdigit()) and not isinstance(v, list):
                w = self.e_neg(); v = v * w  # multiplication implicite
            else:
                return v

    def e_neg(self):
        if self.peek() == '⁻':
            self.take(); return -self.e_pow()
        return self.e_pow()

    def e_pow(self):
        v = self.e_post()
        while self.peek() == '^':
            self.take(); w = self.e_neg(); v = v ** w
        return v

    def e_post(self):
        v = self.e_prim()
        while self.peek() == '²':
            self.take(); v = v * v
        return v

    def args(self):
        out = [self.e_or()]
        while self.peek() == ',':
            self.take(); out.append(self.e_or())
        if self.peek() == ')':
            self.take()
        return out

    def e_prim(self):
        x = self.peek()
        if x is None:
            raise TIError('syntaxe : expression vide')
        if x[0].isdigit() or x == '.':
            s = ''
            while self.peek() is not None and (self.peek()[0].isdigit() or self.peek() == '.'):
                s += self.take()
            return float(s)
        self.take()
        if x == '"':
            out = []
            while self.peek() is not None and self.peek() != '"':
                out.append(self.take())
            if self.peek() == '"':
                self.take()
            return out
        if x == '(':
            v = self.e_or()
            if self.peek() == ')':
                self.take()
            return v
        if x == 'getKey':
            return float(self.getkey())
        if x == 'Ans':
            return self.ans
        if x == 'π':
            return math.pi
        if x.startswith('Str') or (len(x) == 1 and (x.isupper() or x == 'θ')) or x in ('Xmin', 'Xmax', 'Ymin', 'Ymax'):
            if x not in self.vars:
                if x.startswith('Str'):
                    raise TIError('indéfini : ' + x)
                self.vars[x] = 0.0
            return self.vars[x]
        fn = {'sin(': lambda a: math.sin(math.radians(a[0])), 'cos(': lambda a: math.cos(math.radians(a[0])),
              'tan(': lambda a: math.tan(math.radians(a[0])), 'log(': lambda a: math.log10(self.dom(a[0])),
              'ln(': lambda a: math.log(self.dom(a[0])), '√(': lambda a: math.sqrt(self.dom(a[0], True)),
              'min(': lambda a: min(a), 'max(': lambda a: max(a), 'not(': lambda a: float(not a[0])}
        if x in fn:
            return fn[x](self.args())
        if x == 'length(':
            a = self.args(); return float(len(a[0]))
        if x == 'sub(':
            s, st, n = self.args()
            st, n = int(st), int(n)
            if n < 1 or st < 1 or st + n - 1 > len(s):
                raise TIError('domaine : sub(%d,%d) sur longueur %d' % (st, n, len(s)))
            return s[st - 1:st - 1 + n]
        if x == 'inString(':
            a = self.args(); hay, nd = a[0], a[1]
            for i in range(len(hay) - len(nd) + 1):
                if hay[i:i + len(nd)] == nd:
                    return float(i + 1)
            return 0.0
        if x == 'expr(':
            a = self.args()
            sub = Prog.__new__(Prog); sub.__dict__.update(self.__dict__)
            return sub.parse_expr(list(a[0]))
        raise TIError('jeton inattendu dans une expression : ' + x)

    def dom(self, v, sq=False):
        if v < 0 or (v == 0 and not sq):
            raise TIError('domaine')
        return v

    def getkey(self):
        a = self.next_action()
        if isinstance(a, tuple):
            raise TIError('le scénario attend un menu, pas une touche')
        return a

    # ------------------------------------------------ exécution
    def fmt(self, v):
        if isinstance(v, list):
            return ''.join(v)
        if abs(v - round(v)) < 1e-12 and abs(v) < 1e10:
            return str(int(round(v)))
        return ('%.10g' % v).replace('e', 'E')

    def text(self, row, col, val):
        row, col = int(row), int(col)
        if not (0 <= row <= 164 and 0 <= col <= 264):
            raise TIError('Text( hors écran %d,%d' % (row, col))
        s = self.fmt(val)
        self.screen = 'graph'
        w = int(self.gd.textlength(s, font=FONT))
        self.gd.rectangle([col, row, min(264, col + w), row + 11], fill='white')
        self.gd.text((col, row), s, font=FONT, fill=COLORS[self.color])
        self.last_text_right = col + w

    def split_args(self, toks):
        out, cur, depth, instr = [], [], 0, False
        for t in toks:
            if t == '"':
                instr = not instr
            if not instr:
                if t == ',' and depth == 0:
                    out.append(cur); cur = []; continue
                if t.endswith('('):
                    depth += 1
                if t == ')':
                    if depth == 0:
                        continue
                    depth -= 1
            cur.append(t)
        out.append(cur)
        return out

    def find_block_end(self, i, stop_at_else=False):
        depth = 0
        while i < len(self.lines):
            l = self.lines[i]
            h = l[0] if l else ''
            if h in ('If ',) and i + 1 < len(self.lines) and self.lines[i + 1][:1] == ['Then']:
                depth += 1; i += 2; continue
            if h in ('Repeat ', 'While ', 'For('):
                depth += 1
            elif h == 'End':
                if depth == 0:
                    return i
                depth -= 1
            elif h == 'Else' and depth == 0 and stop_at_else:
                return i
            i += 1
        raise TIError('End manquant')

    def run(self, max_steps=400000):
        pc = 0
        while pc < len(self.lines):
            self.steps += 1
            if self.steps > max_steps:
                raise TIError('boucle infinie ?')
            self.maxstack = max(self.maxstack, len(self.stack))
            if len(self.stack) > 60:
                raise TIError('fuite mémoire : trop de blocs ouverts (Goto dans un If/Then ?)')
            l = self.lines[pc]
            if not l:
                pc += 1; continue
            h = l[0]
            if h == 'Lbl ':
                pc += 1
            elif h == 'Goto ':
                lab = ''.join(l[1:])
                if lab not in self.labels:
                    raise TIError('étiquette introuvable ' + lab)
                pc = self.labels[lab] + 1
            elif h == 'If ':
                cond = self.parse_expr(l[1:])
                if pc + 1 < len(self.lines) and self.lines[pc + 1][:1] == ['Then']:
                    if cond:
                        self.stack.append(('if', pc)); pc += 2
                    else:
                        j = self.find_block_end(pc + 2, stop_at_else=True)
                        if self.lines[j][:1] == ['Else']:
                            self.stack.append(('if', pc))
                        pc = j + 1
                else:
                    pc += 1 if cond else 2
            elif h == 'Else':
                j = self.find_block_end(pc + 1)
                self.stack.pop(); pc = j + 1
            elif h == 'End':
                kind = self.stack[-1]
                if kind[0] == 'if':
                    self.stack.pop(); pc += 1
                elif kind[0] == 'repeat':
                    if self.parse_expr(self.lines[kind[1]][1:]):
                        self.stack.pop(); pc += 1
                    else:
                        pc = kind[1] + 1
                elif kind[0] == 'for':
                    var, end = kind[2], kind[3]
                    self.vars[var] += 1
                    if self.vars[var] > end:
                        self.stack.pop(); pc += 1
                    else:
                        pc = kind[1] + 1
            elif h == 'Repeat ':
                self.stack.append(('repeat', pc)); pc += 1
            elif h == 'For(':
                a = self.split_args(l[1:])
                var = a[0][0]
                st, en = self.parse_expr(a[1]), self.parse_expr(a[2])
                self.vars[var] = st
                if st > en:
                    pc = self.find_block_end(pc + 1) + 1
                else:
                    self.stack.append(('for', pc, var, en)); pc += 1
            elif h == 'Menu(':
                a = self.split_args(l[1:])
                title = self.fmt(self.parse_expr(a[0]))
                opts = [(self.fmt(self.parse_expr(a[i])), ''.join(a[i + 1])) for i in range(1, len(a), 2)]
                if len(opts) > 9:
                    raise TIError('Menu( : plus de 9 choix')
                self.screen = 'home'
                self.home = [(' ' + title[:25], True)] + [('%d:%s' % (i + 1, t[:24]), False) for i, (t, _) in enumerate(opts)]
                act = self.next_action()
                if not (isinstance(act, tuple) and act[0] == 'menu'):
                    raise TIError('le scénario attend une touche, pas un menu')
                lab = opts[act[1]][1]
                if lab not in self.labels:
                    raise TIError('Menu( : étiquette introuvable ' + lab)
                pc = self.labels[lab] + 1
            elif h == 'Stop':
                raise Stop()
            else:
                self.statement(l)
                pc += 1
        raise Stop()

    def statement(self, l):
        h = l[0]
        if h == 'ClrDraw':
            self.gd.rectangle([0, 0, 265, 165], fill='white'); self.screen = 'graph'
        elif h == 'ClrHome':
            self.home = []
        elif h in ('StoreGDB ', 'RecallGDB ', 'FnOff ', 'PlotsOff ', 'AxesOff', 'GridOff', 'LabelOff'):
            pass
        elif h == 'TextColor(':
            c = ''.join(t for t in l[1:] if t != ')').upper()
            if c not in COLORS:
                raise TIError('couleur inconnue ' + c)
            self.color = c
        elif h == 'Text(':
            a = self.split_args(l[1:])
            if len(a) != 3:
                raise TIError('Text( : 3 arguments attendus')
            self.text(self.parse_expr(a[0]), self.parse_expr(a[1]), self.parse_expr(a[2]))
        elif h == 'Horizontal ':
            a = self.split_args(l[1:])
            y = -self.parse_expr(a[0])
            c = ''.join(a[1]).upper()
            if not (0 <= y <= 164) or c not in COLORS:
                raise TIError('Horizontal invalide')
            self.gd.line([0, y, 264, y], fill=COLORS[c]); self.screen = 'graph'
        elif h == 'Disp ':
            self.screen = 'home'
            self.home.append((self.fmt(self.parse_expr(l[1:])), False))
        elif '→' in l:
            k = len(l) - 1 - l[::-1].index('→')
            v = self.parse_expr(l[:k])
            var = ''.join(l[k + 1:])
            if var.startswith('Str') != isinstance(v, list):
                raise TIError('type : ' + var)
            self.vars[var] = v
            self.ans = v
        else:
            self.ans = self.parse_expr(l)


def run(path, script, outdir=None):
    data = open(path, 'rb').read()
    n = data[55 + 15] | data[55 + 16] << 8
    prog = data[55 + 17 + 2:55 + 17 + n]
    p = Prog(prog, script, outdir)
    try:
        p.run()
    except Stop:
        pass
    return p


if __name__ == '__main__':
    path, outdir = sys.argv[1], sys.argv[2]
    os.makedirs(outdir, exist_ok=True)
    ENTER, CLEAR, DEL, MATH, UP, DOWN, LEFT, RIGHT, SECOND = 105, 45, 23, 41, 25, 34, 24, 26, 21
    D = {'0': 102, '1': 92, '2': 93, '3': 94, '4': 82, '5': 83, '6': 84, '7': 72, '8': 73, '9': 74, '.': 103, '+': 95, '-': 85, '*': 75, '/': 65, '(': 63, ')': 64}
    k = lambda s: [D[c] for c in s]
    snap = lambda n: ('snap', n)
    menu = lambda i: ('menu', i)
    sc = k('12*3') + [ENTER] + k('9.81*2') + [ENTER] + [SECOND, 61] + k('2)') + [ENTER] + k('1+') + [ENTER] + k('(1+2') + [ENTER, snap('calc')] + \
        [MATH, snap('menu-matieres'), menu(0), snap('menu-chapitres'), menu(0), snap('page1'), DOWN, snap('page2'), RIGHT, snap('chap2'),
         MATH, snap('retour-calcul'), MATH, snap('reouvre'), ENTER, menu(1), snap('chap-menu-2'),
         CLEAR] + k('2') + [DEL, CLEAR, snap('vide'), CLEAR, snap('fin')]
    p = run(path, sc, outdir)
    for name, im in p.snaps.items():
        im.save(os.path.join(outdir, 'ti-%s.png' % name))
    print('ok', len(p.snaps), 'captures · pile max', p.maxstack, '· étapes', p.steps)
    print('historique :', p.fmt(p.vars.get('Str4', [])), '=', p.vars.get('R'), '|', p.fmt(p.vars.get('Str5', [])), '=', p.vars.get('S'), '|', p.fmt(p.vars.get('Str6', [])), '=', p.vars.get('T'))
    assert p.vars['P'] == 4 or p.vars['P'] > 0
    assert p.home and 'bonnes' in p.home[-1][0], 'sortie ratée'
