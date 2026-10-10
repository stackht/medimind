"""Builds the report diagrams as SVG and renders them to PNG with Playwright.
Usage: python diagrams.py <output_dir>"""
import sys, os
from xml.sax.saxutils import escape

NAVY, BLUE, TEAL, GREEN, AMBER, RED, GREY = '#16355c', '#2f6fb0', '#168f9c', '#2a9d6a', '#d99a1b', '#c9453b', '#6b7a8d'
FONT = "Arial, Helvetica, sans-serif"


class Svg:
    def __init__(self, w, h, bg='#f4f7fb'):
        self.w, self.h, self.parts = w, h, []
        self.parts.append(f'<rect width="{w}" height="{h}" fill="{bg}"/>')
        self.parts.append('<defs><marker id="ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#33475f"/></marker>'
                          '<marker id="ahr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="#c9453b"/></marker></defs>')

    def text(self, x, y, s, size=14, weight='400', fill='#1b2b40', anchor='middle', style=''):
        self.parts.append(f'<text x="{x}" y="{y}" font-family="{FONT}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}" {style}>{escape(s)}</text>')

    def lines(self, x, y, lines, size=13, weight='400', fill='#1b2b40', gap=1.25, anchor='middle'):
        for i, l in enumerate(lines):
            self.text(x, y + i * size * gap, l, size, weight, fill, anchor)

    def box(self, x, y, w, h, title='', sub=(), fill=BLUE, tcolor='#fff', scolor=None, r=10, tsize=15, ssize=12, stroke=None, tweight='700'):
        st = f' stroke="{stroke}" stroke-width="2"' if stroke else ''
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}"{st}/>')
        tl = title.split('\n') if title else []
        n = len(tl) + len(sub)
        total = len(tl) * tsize * 1.2 + len(sub) * ssize * 1.3
        cy = y + h / 2 - total / 2 + tsize * 0.95
        for i, t in enumerate(tl):
            self.text(x + w / 2, cy + i * tsize * 1.2, t, tsize, tweight, tcolor)
        base = cy + len(tl) * tsize * 1.2 - tsize * 0.1
        for i, t in enumerate(sub):
            self.text(x + w / 2, base + i * ssize * 1.3, t, ssize, '400', scolor or tcolor)

    def arrow(self, x1, y1, x2, y2, color='#33475f', width=2.5, dash=False, red=False):
        d = ' stroke-dasharray="6 5"' if dash else ''
        m = 'ahr' if red else 'ah'
        self.parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="{color}" stroke-width="{width}"{d} marker-end="url(#{m})"/>')

    def path(self, d, color='#33475f', width=2.5, dash=False, red=False):
        dd = ' stroke-dasharray="6 5"' if dash else ''
        m = 'ahr' if red else 'ah'
        self.parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}"{dd} marker-end="url(#{m})"/>')

    def frame(self, x, y, w, h, label, color=NAVY, fill='none', dash=False):
        d = ' stroke-dasharray="8 6"' if dash else ''
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="14" fill="{fill}" stroke="{color}" stroke-width="2"{d}/>')
        if label:
            self.text(x + 16, y + 24, label, 13, '700', color, 'start')

    def save(self, path):
        with open(path, 'w', encoding='utf-8') as f:
            f.write(f'<svg xmlns="http://www.w3.org/2000/svg" width="{self.w}" height="{self.h}" viewBox="0 0 {self.w} {self.h}">' + ''.join(self.parts) + '</svg>')


def fig_pipeline(path):
    s = Svg(1400, 640)
    s.text(700, 40, 'MEDIMIND PIPELINE', 24, '800', NAVY)
    # inputs
    s.frame(30, 120, 220, 420, 'INPUTS', GREY)
    s.box(50, 160, 180, 150, 'Synthetic patient\narrivals', ['symptoms, pain', 'vitals, age,', 'condition'], fill='#ffffff', tcolor=NAVY, scolor='#44556b', stroke=BLUE)
    s.box(50, 350, 180, 150, 'Hospital state', ['beds, doctors,', 'diagnostic units,', 'corridors'], fill='#ffffff', tcolor=NAVY, scolor='#44556b', stroke=BLUE)
    s.arrow(250, 330, 310, 330)
    # core
    s.frame(310, 80, 800, 500, 'MEDIMIND AI CORE (shared seeded simulation)', NAVY, '#e6eef8')
    items = [('1. PRIORITY TRIAGE', 'Prolog facts and rules', BLUE), ('2. VITALS MONITOR', 'Mamdani fuzzy inference', TEAL),
             ('3. RISK ESTIMATOR', 'Neuro-fuzzy (ANFIS)', BLUE), ('4. RESOURCE ALLOCATION', 'Prolog knowledge base', TEAL),
             ('5. ROUTING', 'BFS, DFS and A* search', BLUE), ('6. ROOM CONTROL', 'Fuzzy control (27 rules)', TEAL),
             ('7. SECURITY', 'Minimax game tree', BLUE), ('8. INSIGHT AND MESSAGING', 'Perceptron, competitive, n-gram', TEAL)]
    for i, (t, sub, c) in enumerate(items):
        col, row = i % 2, i // 2
        x, y = 340 + col * 385, 125 + row * 110
        s.box(x, y, 360, 92, t, [sub], fill=c, tsize=15, ssize=13)
    s.arrow(1110, 330, 1170, 330)
    # outputs
    s.frame(1170, 120, 200, 420, 'OUTPUTS', GREY)
    outs = [('Priority and\nqueue', 150), ('Bed, doctor and\nscanner plan', 255), ('Routes and\nalerts', 360), ('Dashboard, charts\nand reports', 465)]
    for t, y in outs:
        s.box(1185, y - 10, 170, 80, t, [], fill='#ffffff', tcolor=NAVY, stroke=BLUE, tsize=14)
    s.save(path)


def fig_anfis(path):
    s = Svg(1400, 620)
    s.text(700, 38, 'HYBRID NEURO-FUZZY (ANFIS) RISK ESTIMATOR', 22, '800', NAVY)
    s.text(700, 62, 'five-layer Takagi-Sugeno network, trained by back-propagation', 14, '400', GREY)
    s.box(30, 180, 160, 230, 'INPUTS', ['Age', 'Systolic BP', 'BMI', 'Glucose', '(normalised 0 to 1)'], fill=NAVY)
    xs = [250, 470, 690, 910, 1130]
    layers = [('LAYER 1', 'Fuzzification', 'Gaussian sets low / high', 'centre and width trainable', BLUE),
              ('LAYER 2', 'Rule firing', 'product of memberships', '2 x 2 x 2 x 2 = 16 rules', TEAL),
              ('LAYER 3', 'Normalisation', 'w_k / sum(w)', 'relative rule strength', BLUE),
              ('LAYER 4', 'TSK consequents', 'f_k = p0 + p1 x1 + ... + p4 x4', 'coefficients trainable', TEAL),
              ('LAYER 5', 'Weighted sum', 'risk = sum(wn_k x f_k)', 'score 0 to 100', GREEN)]
    for x, (a, b, c, d, col) in zip(xs, layers):
        s.box(x, 150, 190, 290, a, [b, '', c, d], fill=col, tsize=16, ssize=13)
    s.arrow(190, 295, 250, 295)
    for i in range(4):
        s.arrow(xs[i] + 190, 295, xs[i + 1], 295)
    s.box(1130, 480, 190, 70, 'Risk category', ['low / medium / high'], fill='#ffffff', tcolor=NAVY, scolor='#44556b', stroke=GREEN, tsize=14)
    s.arrow(1225, 440, 1225, 480)
    # backprop
    s.path('M 1130 470 L 1130 520 L 345 520 L 345 442', RED, 2.5, True, True)
    s.text(740, 545, 'back-propagation of the squared error updates membership centres, widths and consequents', 14, '700', RED)
    s.text(740, 580, 'Training data: 320 synthetic, de-identified records (240 train, 80 test)', 13, '400', GREY)
    s.save(path)


def fig_taxonomy(path):
    s = Svg(1400, 640)
    s.text(700, 40, 'CLASSIFICATION OF TECHNIQUES IN MEDIMIND', 24, '800', NAVY)
    s.box(520, 80, 360, 80, 'MEDIMIND AI AND\nSOFT COMPUTING CORE', [], fill=NAVY, tsize=18)
    cols = [('1. SEARCH AND\nGAME THEORY', ['Breadth-first search (BFS)', 'Depth-first search (DFS)', 'A* with admissible heuristic', 'Minimax with alpha-beta'], 60, BLUE),
            ('2. KNOWLEDGE-BASED\nAND SOFT COMPUTING', ['Prolog facts and rules', 'Mamdani fuzzy inference', 'Fuzzy control (rooms)', 'Neuro-fuzzy (ANFIS)'], 500, TEAL),
            ('3. LEARNING AND\nLANGUAGE MODELS', ['Perceptron (supervised)', 'Competitive learning', 'Bigram micro LM', 'Trigram small LM'], 940, GREEN)]
    for t, items, x, c in cols:
        s.arrow(700, 160, x + 200, 235)
        s.box(x, 235, 400, 80, t, [], fill=c, tsize=16)
        s.parts.append(f'<rect x="{x}" y="335" width="400" height="230" rx="12" fill="#fff" stroke="{c}" stroke-width="2"/>')
        for i, it in enumerate(items):
            s.text(x + 30, 385 + i * 50, '•  ' + it, 16, '500', '#1b2b40', 'start')
    s.save(path)


def fig_existing(path):
    s = Svg(1400, 520)
    s.text(700, 42, 'EXISTING MANUAL / RULE-OF-THUMB HOSPITAL FLOW', 22, '800', NAVY)
    steps = [('REGISTRATION DESK', ['paper or counter entry,', 'no structured symptoms']), ('FIRST-COME-FIRST-SERVED', ['single queue,', 'urgency judged by eye']),
             ('MANUAL ALLOCATION', ['staff phone calls to', 'find a bed or doctor']), ('VERBAL DIRECTIONS', ['static signage,', 'no live route changes'])]
    for i, (t, sub) in enumerate(steps):
        x = 50 + i * 335
        s.box(x, 180, 260, 150, t, sub, fill=NAVY, tsize=15, ssize=13)
        if i < 3:
            s.arrow(x + 260, 255, x + 335, 255)
    s.text(700, 420, 'No explanation of decisions, no shared view of beds, doctors or emergencies, and no protection', 16, '400', GREY)
    s.text(700, 446, 'for hospital information systems.', 16, '400', GREY)
    s.save(path)


def fig_proposed(path):
    s = Svg(1400, 900)
    s.text(700, 38, 'PROPOSED MEDIMIND SYSTEM ARCHITECTURE', 24, '800', NAVY)
    # presentation
    s.frame(40, 70, 1320, 150, 'PRESENTATION LAYER (React 19, Vite, SVG charts)', BLUE, '#eaf1fb')
    pages = ['Overview', 'Patients', 'Triage', 'Resources', 'Routing', 'Monitoring', 'Analytics', 'Experiments', 'Reports']
    for i, p in enumerate(pages):
        s.box(60 + i * 144, 120, 132, 70, p, [], fill=BLUE, tsize=14)
    s.arrow(700, 220, 700, 262)
    # simulation
    s.frame(40, 262, 1320, 150, 'SIMULATION ENGINE (seeded, deterministic, one shared state)', TEAL, '#e6f5f6')
    se = [('Clock and\nevent loop', []), ('Synthetic patient\ngenerator', []), ('Queue policy\n(priority / FCFS)', []), ('Alerts, event log\nand history', []), ('Derived KPIs\nand charts', [])]
    for i, (t, sub) in enumerate(se):
        s.box(70 + i * 255, 305, 235, 85, t, sub, fill=TEAL, tsize=14)
    s.arrow(700, 412, 700, 454)
    # ai services
    s.frame(40, 454, 1320, 250, 'AI SERVICES (implemented from scratch in JavaScript)', NAVY, '#e8edf5')
    ai = [('Prolog engine', ['Tau Prolog:', 'triage and', 'allocation rules']), ('Fuzzy engine', ['Mamdani FIS:', 'vitals and', 'room control']), ('Neuro-fuzzy', ['ANFIS risk', 'model']),
          ('Graph search', ['BFS, DFS, A*', 'on floor-plan', 'graph']), ('Minimax', ['defender vs', 'attacker', 'game tree']), ('Learning', ['perceptron,', 'competitive,', 'n-gram LMs'])]
    for i, (t, sub) in enumerate(ai):
        s.box(62 + i * 215, 500, 195, 170, t, sub, fill=NAVY, tsize=15, ssize=13)
    s.arrow(700, 704, 700, 746)
    s.frame(40, 746, 1320, 120, 'DATA AND OUTPUT (browser only, no backend)', GREY, '#f0f2f5')
    for i, t in enumerate(['Synthetic data\n(seeded)', 'In-memory\nsimulation state', 'Preferences in\nlocalStorage', 'CSV / JSON\nexports', 'Static hosting\n(Cloudflare Pages)']):
        s.box(70 + i * 255, 785, 235, 62, t, [], fill='#ffffff', tcolor=NAVY, stroke=GREY, tsize=13)
    s.save(path)


def fig_activity(path):
    s = Svg(1400, 980)
    s.text(700, 36, 'ACTIVITY DIAGRAM: ONE SIMULATED MINUTE (tick)', 22, '800', NAVY)
    def n(x, y, w, h, t, c=BLUE, sub=()):
        s.box(x, y, w, h, t, sub, fill=c, tsize=14, ssize=12)
    s.parts.append('<circle cx="170" cy="85" r="16" fill="#16355c"/>')
    s.arrow(170, 101, 170, 130)
    n(60, 130, 220, 60, 'Advance clock (tick + 1)', NAVY)
    s.arrow(170, 190, 170, 235)
    s.parts.append(f'<polygon points="170,235 270,285 170,335 70,285" fill="{AMBER}"/>')
    s.text(170, 282, 'New arrival?', 14, '700', '#fff'); s.text(170, 300, 'rate 0.35 / min', 11, '400', '#fff')
    s.arrow(270, 285, 340, 285); s.text(305, 275, 'yes', 12, '700', GREY)
    n(340, 250, 240, 70, 'Generate synthetic patient', BLUE)
    s.arrow(580, 285, 650, 285)
    n(650, 250, 250, 70, 'Triage with Prolog rules', TEAL, ['priority + reasons'])
    s.arrow(900, 285, 970, 285)
    n(970, 250, 250, 70, 'Fuzzy vitals + risk score', BLUE)
    s.path('M 1095 320 L 1095 385 L 170 385 L 170 420', '#33475f')
    s.arrow(170, 335, 170, 420); s.text(150, 380, 'no', 12, '700', GREY)
    n(60, 420, 220, 60, 'Drift patient vitals', BLUE)
    s.arrow(170, 480, 170, 525)
    n(60, 525, 220, 60, 'Discharge finished stays', BLUE, ['free beds and doctors'])
    s.arrow(280, 555, 340, 555)
    n(340, 520, 280, 70, 'Allocate with Prolog rules', TEAL, ['queue policy decides the order'])
    s.arrow(620, 555, 690, 555)
    s.parts.append(f'<polygon points="800,505 900,555 800,605 700,555" fill="{AMBER}"/>')
    s.text(800, 552, 'Emergency', 14, '700', '#fff'); s.text(800, 570, 'or closure?', 13, '700', '#fff')
    s.arrow(900, 555, 970, 555); s.text(935, 545, 'yes', 12, '700', GREY)
    n(970, 520, 260, 70, 'Plan route with A*', TEAL, ['stairs excluded, closed corridors avoided'])
    s.arrow(800, 605, 800, 690); s.text(780, 650, 'no', 12, '700', GREY)
    s.path('M 1100 590 L 1100 640 L 800 640 L 800 690', '#33475f')
    n(640, 690, 320, 66, 'Raise alerts and log decisions', BLUE, ['algorithm and reason recorded'])
    s.arrow(800, 756, 800, 800)
    n(640, 800, 320, 60, 'Record history sample', BLUE)
    s.arrow(800, 860, 800, 900)
    n(640, 900, 320, 56, 'Publish new snapshot to all pages', NAVY)
    s.save(path)


def render(out_dir):
    from playwright.sync_api import sync_playwright
    figs = [('fig1_1', fig_pipeline, 1400, 640), ('fig2_1', fig_anfis, 1400, 620), ('fig3_1', fig_taxonomy, 1400, 640),
            ('fig3_2', fig_existing, 1400, 520), ('fig3_3', fig_proposed, 1400, 900), ('fig3_4', fig_activity, 1400, 980)]
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page(viewport={'width': 1400, 'height': 1000}, device_scale_factor=1.5)
        for name, fn, w, h in figs:
            svg = os.path.join(out_dir, name + '.svg')
            fn(svg)
            pg.set_viewport_size({'width': w, 'height': h})
            pg.goto('file:///' + svg.replace('\\', '/'))
            pg.screenshot(path=os.path.join(out_dir, name + '.png'), clip={'x': 0, 'y': 0, 'width': w, 'height': h})
        b.close()


if __name__ == '__main__':
    os.makedirs(sys.argv[1], exist_ok=True)
    render(sys.argv[1])
    print('diagrams done')
