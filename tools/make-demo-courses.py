"""Génère un ZIP de cours de démonstration (PDF + Word + PowerPoint) dans demo/Cours_demo.zip."""
import io, os, sys, zipfile
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import docx
from pptx import Presentation

OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'demo')
os.makedirs(OUT, exist_ok=True)
pdfmetrics.registerFont(TTFont('DV', '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DVB', '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'))

OPTIQUE = [
    ('h', "Chapitre 1 - Propagation de la lumière"),
    ('p', "Bonjour à tous et bienvenue dans ce cours d'optique géométrique."),
    ('p', "Dans un milieu homogène et transparent, la lumière se propage en ligne droite."),
    ('p', "On appelle rayon lumineux la ligne qui modélise le trajet suivi par la lumière."),
    ('p', "La vitesse de la lumière dans le vide vaut c = 3,00 × 10^8 m/s."),
    ('p', "L'indice de réfraction d'un milieu est défini par n = c / v, où v est la vitesse de la lumière dans ce milieu."),
    ('p', "Par exemple, l'eau a un indice de 1,33 et le verre un indice d'environ 1,5."),
    ('p', "Voir le TD n°2 pour les exercices d'application."),
    ('h', "Chapitre 2 - Réflexion et réfraction"),
    ('p', "Loi de la réflexion : l'angle de réflexion est égal à l'angle d'incidence."),
    ('p', "Lorsque la lumière change de milieu, elle est déviée : c'est la réfraction."),
    ('p', "Loi de Snell-Descartes : n1 × sin(i1) = n2 × sin(i2)."),
    ('p', "Il y a réflexion totale lorsque n1 > n2 et que l'angle d'incidence dépasse l'angle limite."),
    ('p', "L'angle limite vérifie sin(ilim) = n2 / n1."),
    ('p', "On peut citer l'exemple de la fibre optique qui guide la lumière par réflexions totales successives."),
    ('p', "Nous allons maintenant voir la suite du chapitre."),
    ('h', "Chapitre 3 - Lentilles minces"),
    ('p', "Une lentille convergente fait converger les rayons parallèles à l'axe optique vers le foyer image F'."),
    ('p', "La distance focale f' est la distance entre le centre optique O et le foyer image F'."),
    ('p', "La vergence s'écrit C = 1 / f' et s'exprime en dioptries (δ)."),
    ('p', "Relation de conjugaison : 1/OA' - 1/OA = 1/f'."),
    ('p', "Le grandissement vaut γ = A'B'/AB = OA'/OA."),
    ('p', "Pour construire l'image d'un objet, on trace deux rayons particuliers issus du point B."),
    ('p', "Un rayon passant par le centre optique n'est pas dévié."),
    ('p', "Document réalisé par M. Martin - Université de démonstration - 2026"),
]

MATHS = [
    ('h', "Chapitre 4 : Dérivation"),
    ('p', "On appelle nombre dérivé de f en a la limite du taux d'accroissement (f(a+h) - f(a)) / h quand h tend vers 0."),
    ('p', "L'équation de la tangente en a est y = f'(a)(x - a) + f(a)."),
    ('p', "Si f'(x) > 0 sur un intervalle I, alors f est strictement croissante sur I."),
    ('p', "(u × v)' = u'v + uv' et (u / v)' = (u'v - uv') / v²."),
    ('p', "Méthode : pour étudier les variations d'une fonction, on calcule sa dérivée puis on étudie son signe."),
    ('p', "Exemple : f(x) = x² est dérivable sur R et f'(x) = 2x."),
    ('p', "Rappel : le contrôle aura lieu mardi prochain."),
    ('h', "Chapitre 5 : Suites numériques"),
    ('p', "Une suite arithmétique de raison r vérifie u(n+1) = u(n) + r, donc u(n) = u0 + n × r."),
    ('p', "Une suite géométrique de raison q vérifie u(n+1) = q × u(n), donc u(n) = u0 × q^n."),
    ('p', "Toute suite croissante et majorée converge."),
    ('p', "Pour démontrer par récurrence, on vérifie l'initialisation puis on prouve l'hérédité."),
    ('p', "La somme 1 + q + ... + q^n vaut (1 - q^(n+1)) / (1 - q) pour q différent de 1."),
    ('p', "La correction sera disponible sur Moodle."),
]

CHIMIE = [
    ("Oxydoréduction", ["Un oxydant est une espèce capable de capter un ou plusieurs électrons.",
                        "Un réducteur est une espèce capable de céder un ou plusieurs électrons.",
                        "Une réaction d'oxydoréduction est un transfert d'électrons du réducteur d'un couple vers l'oxydant d'un autre couple.",
                        "Questions ?"]),
    ("Équilibrer une équation", ["Pour équilibrer une demi-équation, on ajuste les éléments, puis O avec H2O, puis H avec H+, puis les charges avec e-.",
                                 "Exemple : Cu2+ + 2e- = Cu",
                                 "Activité 2 : observation"]),
    ("Concentration", ["La concentration molaire s'écrit c = n / V en mol/L.",
                       "La quantité de matière se calcule avec n = m / M.",
                       "Merci de votre attention."]),
]


def make_pdf(items):
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    w, h = A4
    y = h - 70
    for kind, text in items:
        if kind == 'h':
            if y < 160:
                c.showPage(); y = h - 70
            y -= 14
            c.setFont('DVB', 17); c.drawString(60, y, text); y -= 28
        else:
            c.setFont('DV', 10.5)
            words, line = text.split(), ''
            for wd in words:
                if c.stringWidth(line + ' ' + wd, 'DV', 10.5) > w - 120:
                    c.drawString(60, y, line.strip()); y -= 15; line = ''
                line += ' ' + wd
            c.drawString(60, y, line.strip()); y -= 20
        if y < 70:
            c.showPage(); y = h - 70
    c.save()
    return buf.getvalue()


def make_docx(items):
    d = docx.Document()
    for kind, text in items:
        if kind == 'h':
            d.add_heading(text, level=1)
        else:
            d.add_paragraph(text)
    buf = io.BytesIO(); d.save(buf)
    return buf.getvalue()


def make_pptx(slides):
    p = Presentation()
    for title, bullets in slides:
        s = p.slides.add_slide(p.slide_layouts[1])
        s.shapes.title.text = title
        tf = s.placeholders[1].text_frame
        tf.text = bullets[0]
        for b in bullets[1:]:
            tf.add_paragraph().text = b
    buf = io.BytesIO(); p.save(buf)
    return buf.getvalue()


zpath = os.path.join(OUT, 'Cours_demo.zip')
with zipfile.ZipFile(zpath, 'w', zipfile.ZIP_DEFLATED) as z:
    z.writestr('Mes cours/Physique - Optique/Optique_geometrique_CM.pdf', make_pdf(OPTIQUE))
    z.writestr('Mes cours/Mathematiques/Analyse_chapitres_4_5.docx', make_docx(MATHS))
    z.writestr('Mes cours/Chimie/Chimie_solutions.pptx', make_pptx(CHIMIE))
print(zpath)
