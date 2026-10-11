"""Builds the MediMind TE Mini Project report PDF.
Usage: python build_report.py <work_dir> <out.pdf>
work_dir must contain: metrics.json, tests.json, shots/ (screenshots + vals.json), fig/ (diagrams), logo_p1.png, logo_p2.png
"""
import json, os, sys, re
from html import escape as esc
import fitz
from PIL import Image

W = os.path.abspath(sys.argv[1]); OUT = os.path.abspath(sys.argv[2]); HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(f'{W}/metrics.json', encoding='utf-8'))
T = json.load(open(f'{W}/tests.json', encoding='utf-8'))
V = json.load(open(f'{W}/shots/vals.json', encoding='utf-8'))

# ---------- constants copied from the reference report (edit freely later) ----------
TITLE = 'MediMind: An AI-Powered Smart Hospital Assistant'
STUDENT, ROLL = 'Md Shahnawaz Noor', '32'
SUPERVISOR, HOD, PRINCIPAL = 'Prof Nirosha Uppu', 'Dr. Shankar M. Patil', 'Dr. Sunil Chavan'
ACK_NOTE = '(The following text shall be 12pt Font, Times New Roman, Justified, 1.5 line spacing)'

tests_pass = sum(1 for t in T if t['pass']); tests_total = len(T)

def f1(x): return f'{x:.1f}'
def f2(x): return f'{x:.2f}'
def f3(x): return f'{x:.3f}'
def pct(x, d=1): return f'{100 * x:.{d}f}%'
def img(path): return 'file:///' + path.replace('\\', '/')


# ---------- screenshots: crop browser chrome for experiment figures ----------
def crop_main(name, top=135, left=372, height=None):
    src = f'{W}/shots/{name}.png'; dst = f'{W}/shots/{name}_c.png'
    im = Image.open(src); w, h = im.size
    box = (left, top, w, min(h, top + height) if height else h)
    im.crop(box).save(dst); return dst

shots = {}
for k in ('overview', 'patients', 'routing', 'analytics', 'monitoring'):
    shots[k] = f'{W}/shots/s_{k}.png'
for k in ('peas1', 'peas2', 'room1', 'room2'):
    shots[k] = f'{W}/shots/s_{k}.png'
shots['risk'] = crop_main('s_risk', height=1500)
shots['security'] = crop_main('s_security', height=1500)
shots['perceptron'] = crop_main('s_perceptron', height=1120)
shots['competitive'] = crop_main('s_competitive', height=1120)
shots['messages'] = crop_main('s_messages', height=1500)

# ---------- html helpers ----------
def fig(src, caption, shot=False, width='100%'):
    return f'<figure class="{"shot" if shot else ""}"><img src="{img(src)}" style="width:{width}"><figcaption>{caption}</figcaption></figure>'

def tbl(head, rows, caption, widths=None, center_cols=()):
    h = ''.join(f'<th class="{"c" if i in center_cols else ""}"' + (f' style="width:{widths[i]}"' if widths else '') + f'>{c}</th>' for i, c in enumerate(head))
    r = ''.join('<tr>' + ''.join(f'<td class="{"c" if i in center_cols else ""}">{c}</td>' for i, c in enumerate(row)) + '</tr>' for row in rows)
    return f'<div class="nobreak"><table class="t"><thead><tr>{h}</tr></thead><tbody>{r}</tbody></table><div class="cap">{caption}</div></div>'

def chap(n, title): return f'<section class="chapter"><h1 class="chap">Chapter {n}</h1><h1 class="chap">{title}</h1>'
def sec(num, title): return f'<h2 class="sec">{num} {title}</h2>'
def sub(num, title): return f'<h3 class="sub">{num} {title}</h3>'
def ul(items): return '<ul class="b">' + ''.join(f'<li>{i}</li>' for i in items) + '</ul>'
def ol(items): return '<ol class="n">' + ''.join(f'<li>{i}</li>' for i in items) + '</ol>'
def eq(expr, no): return f'<div class="eq"><span>{expr}</span><span class="no">({no})</span></div>'

# ---------- TOC / lists definition ----------
TOC = [  # (level, number, title, find-key)
    (0, '', 'Abstract', 'Abstract'), (0, '', 'List of Figures', 'List of Figures'), (0, '', 'List of Tables', 'List of Tables'),
    (1, '1.', 'Introduction', 'Chapter 1'), (2, '1.1', 'Fundamentals', '1.1 Fundamentals'), (2, '1.2', 'Objectives', '1.2 Objectives'),
    (2, '1.3', 'Scope', '1.3 Scope'), (2, '1.4', 'Outline', '1.4 Outline'),
    (1, '2.', 'Literature Survey', 'Chapter 2'), (2, '2.1', 'Search, Rule-Based and Adversarial Techniques', '2.1 Search, Rule-Based and Adversarial Techniques'),
    (2, '2.2', 'Soft Computing, Machine Learning and Language Model Techniques', '2.2 Soft Computing, Machine Learning and Language Model Techniques'),
    (2, '2.3', 'Summary of Literature Survey', '2.3 Literature Summary'),
    (1, '3.', 'Proposed System', 'Chapter 3'), (2, '3.1', 'Overview', '3.1 Overview'),
    (3, '3.1.1', 'Existing System Architecture', '3.1.1 Existing System Architecture'), (3, '3.1.2', 'Proposed System Architecture', '3.1.2 Proposed System Architecture'),
    (2, '3.2', 'Implementation Details', '3.2 Implementation Details'),
    (3, '3.2.1', 'Algorithm / Tools / Techniques', '3.2.1 Algorithm'), (3, '3.2.2', 'Use Case / Activity Diagram', '3.2.2 Use Case'),
    (3, '3.2.3', 'Dataset and Input Details', '3.2.3 Dataset and Input Details'), (3, '3.2.4', 'Hardware and Software Specifications', '3.2.4 Hardware and Software Specifications'),
    (1, '4.', 'Performance and Results', 'Chapter 4'), (2, '4.1', 'Dashboard Telemetry and Simulation Graphs', '4.1 Dashboard Telemetry'),
    (2, '4.2', 'Verification and Comparative Results', '4.2 Verification and Comparative Results'),
    (1, '5.', 'Applications', 'Chapter 5'), (2, '5.1', 'Social and Educational Applications', '5.1 Social and Educational'),
    (2, '5.2', 'Technical and Institutional Applications', '5.2 Technical and Institutional'),
    (1, '6.', 'Conclusion and Future Scope', 'Chapter 6'),
    (0, '', 'References', 'References'), (0, '', 'Acknowledgement', 'Acknowledgement'),
]
FIGS = [
    ('Fig 1.1', 'MediMind Pipeline'), ('Fig 2.1', 'Hybrid Neuro-Fuzzy (ANFIS) Risk Estimator Architecture adapted from Jang [8]'),
    ('Fig 3.1', 'MEDIMIND AI &amp; Soft Computing Core taxonomy'), ('Fig 3.2', 'Existing system architecture used for conventional manual hospital workflows'),
    ('Fig 3.3', 'Proposed MediMind System Architecture'), ('Fig 3.4', 'Activity diagram of one simulated minute (tick)'),
    ('Fig 4.1', 'MediMind Overview Dashboard Displaying Live KPIs, Queue, AI Decision Summary and Emergency Alerts'),
    ('Fig 4.2', 'PEAS Description and Problem Formulation (a), Agent Action and Live Performance Measures (b)'),
    ('Fig 4.3', 'Patient Detail Drawer Showing the Prolog Triage Decision, Factors Used and Patient Timeline'),
    ('Fig 4.4', 'Emergency Routing Page: A* Route with Closed Corridors, Route Cost and Nodes Expanded'),
    ('Fig 4.5', 'Traffic &amp; Queue Analytics: Department Load, Priority Mix, Waiting Times and Resource Utilization'),
    ('Fig 4.6', 'Patient Monitoring: Fuzzy Vital-Sign Scoring and Fuzzy Room-Lighting Control'),
    ('Fig 4.7', 'Mamdani versus Sugeno Room-Lighting Control (a) and Output Comparison over an Input Sweep (b)'),
    ('Fig 4.8', 'Neuro-Fuzzy Risk Estimator after 100 Training Epochs (RMSE Curves and Predicted vs Actual Risk)'),
    ('Fig 4.9', 'Minimax Security Experiment: Optimal Defensive Strategy and Game Tree'),
    ('Fig 4.10', '(a) Perceptron Decision Boundary and (b) Competitive-Learning Prototypes'),
    ('Fig 4.11', 'Bigram µLM and Trigram SLM Next-Word Prediction and Message Generation'),
]
TABLES = [
    ('Table 1.1', 'Mapping of AI and Soft Computing Subsystems in MediMind'), ('Table 2.1', 'Summary of literature survey'),
    ('Table 3.1', 'PEAS description of the MediMind triage and monitoring agent'),
    ('Table 3.2', 'Sample Dataset Used for Experiment'), ('Table 3.3', 'Hardware details'), ('Table 3.4', 'Software details'),
    ('Table 4.1', 'Mamdani versus Sugeno Room-Lighting Output for the Preset Scenarios'),
    ('Table 4.2', 'Confusion Matrix and Rule Verification for MediMind Triage'),
    ('Table 4.3', 'Comparative Results of Existing System vs. Proposed MediMind System'),
    ('Table 4.4', 'Measured Results of the Individual AI Modules'),
]

def toc_html(pg):
    out = ''
    for lvl, num, title, key in TOC:
        p = pg.get(key, '00')
        out += f'<div class="row l{lvl}"><span class="n">{num}</span><span class="t">{title}</span><span class="d"></span><span class="p">{p}</span></div>'
    return out

def list_html(items, pg):
    return ''.join(f'<div class="row"><span class="a">{a}</span><span class="b">{b}</span><span class="c">{pg.get(a, "00")}</span></div>' for a, b in items)


# ---------- numbers used in the text ----------
S1, S2 = M['search'], M['searchAll']
A, P, C, MM, L = M['anfis'], M['perceptron'], M['competitive'], M['minimax'], M['lm']
SIM, FC, RT, TR = M['sim'], M['simFcfs'], M['routes'], M['triage']
red_train = 1 - A['trainRmse'][-1] / A['trainRmse'][0]
red_test = 1 - A['testRmse'][-1] / A['testRmse'][0]
exp_cut = 1 - S2['astarExpAvg'] / S2['ucsExpAvg']
ab_cut = 1 - MM['nodesAB'] / MM['nodesPlain']
wb = lambda d, k: d['waitByPriority'].get(k, {'avg': 0, 'max': 0, 'n': 0})
kp, kf = V['kpi'], V['kpi_foot']
N_CLOSED = len(re.findall(r'\| Reopen(?! all)', V['closed']))
CLOSED_TXT = ('one simulated corridor closure (a red cross)' if N_CLOSED == 1 else f'{N_CLOSED} simulated corridor closures (red crosses)')
ROUTE_TEXT = re.sub(r'\s*\d\d:\d\d\s*$', '', V['decisions'][2].split('|')[2]).strip()


FIS = M['fis']
PS, PF = SIM['peas'], FC['peas']
FN = {k: f'4.{i + 1}' for i, k in enumerate(['overview', 'peas', 'drawer', 'routing', 'analytics', 'monitoring', 'room', 'risk', 'security', 'learning', 'messages'])}
SPEEDUP = FIS['mamdaniMs'] / FIS['sugenoMs']
COST_CUT = 1 - PS['weightedCost'] / PF['weightedCost']


def build(pg):
    h = []
    # ================= COVER =================
    h.append(f'''<section class="page cover">
<p style="font-size:15pt">TE Artificial Intelligence and Soft Computing<br>Mini Project Report</p><div class="gap"></div>
<p style="font-size:15pt">On</p>
<p style="font-size:18pt;font-weight:700;margin-top:6pt">{TITLE.split(': ')[0]}: {TITLE.split(': ')[1]}</p><div class="gap"></div>
<p style="font-size:14pt">Submitted in partial fulfillment of the requirement of<br>University of Mumbai for the Degree of</p><div class="gap"></div>
<p style="font-size:16pt;font-weight:700">Bachelor of Engineering</p><div class="gap"></div>
<p style="font-size:16pt;font-weight:700">in</p><div class="gap"></div>
<p style="font-size:16pt"><b>Artificial Intelligence and Data Science</b>.</p><div class="gap"></div><div class="gap"></div>
<p style="font-size:12pt">Submitted By</p><div class="gap"></div>
<p style="font-size:14pt;font-weight:700">{STUDENT}</p><div class="gap"></div>
<p style="font-size:12pt">Supervisor</p><div class="gap"></div>
<p style="font-size:14pt;font-weight:700">{SUPERVISOR}</p>
<img class="logo" src="{img(W + '/logo_p1.png')}">
<p style="font-size:12pt">Department of Artificial Intelligence and Data Science<b>.</b></p><div class="gap"></div>
<p style="font-size:16pt;margin-top:14pt">Smt. Indira Gandhi College of Engineering, Ghansoli <span style="font-size:12pt">&ndash; 400701</span></p>
<p style="font-size:16pt;margin-top:12pt">An Autonomous Institute</p>
<p style="font-size:16pt;margin-top:10pt">Academic Year 2025 &ndash; 26</p>
</section>''')
    # ================= CERTIFICATE =================
    h.append(f'''<section class="page hdr" style="padding-top:0.3in">
<img src="{img(W + '/logo_p2.png')}">
<p style="margin-top:22pt">Department of Artificial Intelligence and Data Science<b>.</b></p>
<p style="font-size:9pt;margin-top:4pt">SMT. INDIRA GANDHI COLLEGE OF ENGINEERING</p>
<p style="font-size:12pt;margin-top:2pt">GHANSOLI <span style="font-size:9pt">&ndash; 400701</span> <span style="font-size:11pt">(An Autonomous Institute)</span></p>
<p class="big">CERTIFICATE</p>
<p class="cert-p">This is to certify that the requirements for the TE Mini Project report entitled &lsquo;<b>{TITLE}</b>&rsquo; have been successfully completed by the following students:</p>
<table class="names"><tr><th>Name</th><th>Roll No.</th></tr><tr><td>{STUDENT}</td><td>{ROLL}</td></tr></table>
<p style="text-align:left;margin:0 0 6pt">in partial fulfillment of Bachelor of Engineering in Department of Artificial Intelligence and Data Science, Smt. Indira Gandhi College of Engineering, Ghansoli 401701,An Autonomous Institute during the Academic Year 2025 &ndash; 2026.</p>
<p style="margin-top:40pt"><b>{SUPERVISOR}</b><br><b>Supervisor</b></p>
<div class="sigrow" style="margin-top:34pt"><p><b>{HOD}</b><br><b>Head of Department</b></p><p><b>{PRINCIPAL}</b><br><b>Principal</b></p></div>
</section>''')
    # ================= APPROVAL =================
    h.append(f'''<section class="page hdr" style="padding-top:0.55in">
<img src="{img(W + '/logo_p2.png')}">
<p style="margin-top:22pt"><b>Department of Artificial Intelligence and Data Science</b></p>
<p style="font-size:9pt;margin-top:18pt">SMT. INDIRA GANDHI COLLEGE OF ENGINEERING</p>
<p style="font-size:12pt;margin-top:2pt">GHANSOLI <span style="font-size:9pt">&ndash; 400701</span> <span style="font-size:11pt">(An Autonomous Institute)</span></p>
<p class="big" style="margin-top:28pt">REPORT APPROVAL</p>
<p style="text-align:left;margin-top:6pt;line-height:14pt">This TE Mini Project report entitled &ldquo;<b>{TITLE}</b>&rdquo; by <b>{STUDENT}</b> is approved for the degree of <b>Bachelor of Engineering</b> Department of Artificial Intelligence and Data Science<b>, Smt. Indira Gandhi College of Engineering, Ghansoli.</b> (An Autonomous Institute)</p>
<div class="examiners"><p>Examiners:</p><p>1. <span class="line"></span></p><p>2. <span class="line"></span></p><p>Supervisors:</p><p>1. <span class="line"></span></p><p>2. <span class="line"></span></p><p>Chairman:</p><p>1. <span class="line"></span></p></div>
<p style="text-align:left;margin-top:44pt;padding-left:0.2in">Date:</p><p style="text-align:left;margin-top:10pt;padding-left:0.2in">Place :</p>
</section>''')
    # ================= DECLARATION =================
    h.append(f'''<section class="page" style="padding-top:0"><p class="title16">Declaration</p>
<p style="margin:0 0.35in;text-indent:0.45in">We declare that this written submission for TE Mini Project Report Declaration entitled &ldquo;<b>{TITLE}</b>&rdquo; represents our ideas in our own words and where others&rsquo; ideas or words have been included. We have adequately cited and referenced the original sources. We also declared that we have adhered to all principles of academic honesty and integrity and have not misrepresented or fabricated or falsified any ideas / data / fact / source in our submission. We understand that any violation of the above will cause disciplinary action by the institute and also evoke penal action from the sources which have thus not been properly cited or from whom paper permission has not been taken when needed.</p>
<div style="margin:44pt 0 0 3.4in;font-size:11pt"><p style="text-align:left;line-height:26pt;margin:0"><b>Project Group Members:</b></p>
<p style="text-align:left;line-height:27pt;margin:0">Student 1 Name &amp; Sign: <span class="lineL"></span></p><p style="text-align:left;line-height:27pt;margin:0">Student 2 Name &amp; Sign: <span class="lineL"></span></p>
<p style="text-align:left;line-height:27pt;margin:0">Student 3 Name &amp; Sign: <span class="lineL"></span></p><p style="text-align:left;line-height:27pt;margin:0">Student 4 Name &amp; Sign: <span class="lineL"></span></p></div>
<div style="margin:52pt 0 0 0.35in;font-size:11pt"><p style="text-align:left;margin:0 0 14pt">Date:</p><p style="text-align:left;margin:0">Place:</p></div></section>''')
    # ================= TOC =================
    h.append(f'<section class="page"><p class="title16" style="margin-top:6pt">Table of Contents</p><div class="toc">{toc_html(pg)}</div></section>')
    # ================= ABSTRACT =================
    h.append(f'''<section class="page"><p class="title16">Abstract</p>
<p>Hospitals must make many interdependent decisions every minute: which patient is seen first, how vital signs are interpreted, which beds, doctors and scanners are assigned, how emergency transfers move through the building, how rooms are controlled and how digital systems are protected. Many hospitals still depend on first-come-first-served queues, manual allocation by phone, static signage and fixed alarm thresholds, while purely statistical models behave as unexplainable black boxes. To overcome these limitations, problem formulation with the PEAS model, Prolog rule-based reasoning, graph search (BFS, DFS and A*), adversarial Minimax search, fuzzy logic, Hybrid Neuro-Fuzzy Systems, Perceptron and competitive learning, and bigram and trigram language models are utilized in this work because each one is transparent, runs in the browser without cloud services, and can explain the reason behind every decision.</p>
<p>In this report, we design and implement MediMind, an end-to-end smart hospital assistant that integrates ten Artificial Intelligence and Soft Computing paradigms into one shared, seeded simulation of synthetic patients. The task is first formulated as an intelligent triage and monitoring agent with the PEAS model. The system then triages arrivals with Prolog rules, finds routes with BFS, DFS and A*, plans cyber-defence with Minimax, scores vital signs with a fuzzy logic controller, controls room lighting with both Mamdani and Sugeno fuzzy inference systems, estimates risk with a neuro-fuzzy network, discovers patient groups with competitive learning, and generates patient information messages with n-gram models, while a supporting Prolog knowledge base allocates beds, doctors and diagnostics. Experimental evaluation across {tests_total} automated test cases ({tests_pass} passed) shows that all {TR['correct']} of {TR['total']} hand-labelled triage cases were classified correctly, neuro-fuzzy test error fell by {pct(red_test, 0)} (RMSE {f3(A['testRmse'][0])} to {f3(A['testRmse'][-1])}), A* expanded {pct(exp_cut, 0)} fewer nodes than uniform-cost search at the same optimal cost, alpha-beta pruning reduced Minimax search from {MM['nodesPlain']} to {MM['nodesAB']} nodes, and priority triage reduced the mean waiting time of Emergency patients from {f1(wb(FC, 'emergency')['avg'])} to {f1(wb(SIM, 'emergency')['avg'])} minutes in an eight-hour simulation (the PEAS performance measure shows {pct(PS['byClass']['emergency']['pct'] / 100, 0)} of Emergency patients assessed within target against {pct(PF['byClass']['emergency']['pct'] / 100, 0)} for first-come-first-served), and the Sugeno controller tracked the Mamdani controller with a correlation of {f3(FIS['corr'])} at about {SPEEDUP:.0f} times lower computation, all visualized on a responsive React dashboard.</p></section>''')
    # ================= LISTS =================
    h.append(f'<section class="page lof"><p class="title16" style="margin-top:4pt">List of Figures</p><div style="margin-top:18pt">{list_html(FIGS, pg)}</div></section>')
    h.append(f'<section class="page lof"><p class="title16" style="margin-top:4pt">List of Tables</p><div style="margin-top:18pt">{list_html(TABLES, pg)}</div></section>')

    # ================= CHAPTER 1 =================
    h.append(chap(1, 'Introduction'))
    h.append(sec('1.1', 'Fundamentals'))
    h.append(f'''<p>A hospital is a complex, time-critical system in which patients, staff, beds, scanners, corridors and information systems all interact. Patients arrive unpredictably with different symptoms and urgency, vital signs drift between &ldquo;normal&rdquo; and &ldquo;abnormal&rdquo;, resources are limited, corridors close, and the digital services that hold patient records must stay protected.</p>
<p><b>MediMind</b> addresses these challenges by unifying ten core Artificial Intelligence and Soft Computing techniques into one educational smart hospital assistant. The task is first formulated as an intelligent triage and monitoring agent using the PEAS model (Performance measure, Environment, Actuators, Sensors). At the care-pathway level, a Prolog rule base classifies each arriving patient as Routine, Moderate, High or Emergency priority, a Mamdani fuzzy inference system converts heart rate and temperature into a smooth monitoring priority, and a hybrid neuro-fuzzy network (ANFIS) estimates an illustrative risk score. At the resource level, a supporting Prolog knowledge base allocates beds, doctors and diagnostic units, while Breadth-First Search (BFS), Depth-First Search (DFS) and A* search plan routes through a two-floor hospital graph with blocked corridors. At the facility level, Mamdani and Sugeno fuzzy inference systems set room lighting and their outputs are compared, and a two-ply Minimax game tree plans the defence of hospital servers. Finally, Perceptron, competitive learning and n-gram language models analyse records and generate patient messages.</p>''')
    h.append(fig(f'{W}/fig/fig1_1.png', 'Fig 1.1: MediMind Pipeline', width='56%'))
    h.append('''<p>All ten techniques share one seeded, deterministic simulation, so a single synthetic patient can be followed from arrival to discharge and every decision shows which algorithm made it and why. The system is a frontend-only React application: no patient data is collected, and every patient, vital sign and dataset is synthetic.</p>''')

    h.append(sec('1.2', 'Objectives'))
    h.append('<p>Table 1.1 summarizes the core Artificial Intelligence and Soft Computing modules integrated within the MediMind architecture along with their respective functional roles.</p>')
    h.append(tbl(['Subsystem / Experiment', 'AI / Soft Computing Technique', 'Primary Objective in MediMind'], [
        ['<b>Problem Formulation</b>', 'PEAS model, state-space formulation', 'Describe the triage and monitoring agent and measure its performance on the live simulation.'],
        ['<b>Patient Flow</b>', 'Prolog rules, fuzzy logic controller, Neuro-Fuzzy (ANFIS)', 'Classify arrival priority, interpret vital signs smoothly and estimate an illustrative risk score.'],
        ['<b>Resources</b>', 'Prolog knowledge base (supporting rule base)', 'Assign beds, doctors and diagnostic units to waiting patients with fallback rules.'],
        ['<b>Navigation</b>', 'BFS, DFS, A* heuristic search', 'Find hospital routes and low-cost emergency transfers that avoid closed corridors.'],
        ['<b>Facility &amp; Security</b>', 'Mamdani and Sugeno FIS, Minimax with alpha-beta pruning', 'Control room lighting with both FIS types, compare their outputs, and choose a defensive strategy for hospital servers.'],
        ['<b>Insight &amp; Messaging</b>', 'Perceptron, competitive learning, bigram / trigram models', 'Classify and group synthetic records and generate patient information messages.'],
    ], 'Table 1.1: Mapping of AI and Soft Computing Subsystems in MediMind', widths=['22%', '33%', '45%']))
    h.append('<p style="margin-top:12pt">The objective of this work is as follows:</p>')
    h.append(ol([
        'To study traditional manual and threshold-based hospital workflows and identify their limitations in order to formulate the problem with the PEAS model and propose an integrated assistant that uses Prolog rules, fuzzy inference and a Hybrid Neuro-Fuzzy System to handle uncertain and conflicting patient information with explainable decisions.',
        'To optimize patient and emergency movement using BFS, DFS and A* search on a hospital graph with blocked corridors and transport restrictions, to allocate beds, doctors and diagnostics with Prolog rules, and to plan server defence with a Minimax game tree.',
        f'To combine all techniques in one shared seeded simulation with a responsive dashboard, and to evaluate it using automated test cases ({tests_total}), triage rule verification, training error (RMSE), search cost, Mamdani-versus-Sugeno agreement, and waiting-time and performance-measure comparison against first-come-first-served queueing.']))
    h.append(sec('1.3', 'Scope'))
    h.append(f'''<p>MediMind is scoped as an educational simulation and decision-support demonstration designed for AI and soft computing students, teachers and hospital-operations researchers. The deliverables include a frontend-only React application with a deterministic simulation engine (<code>sim.js</code>), a Prolog rule base executed in the browser through Tau Prolog, Mamdani and Sugeno fuzzy inference engines, a PEAS problem-formulation page, an ANFIS model trained by back-propagation, graph search, Minimax, Perceptron and competitive-learning modules, n-gram language models, ten stand-alone AI experiments and an automated verification suite (TC-01 to TC-{tests_total:02d}). Key features include live triage, resource allocation, emergency routing with closable corridors, vital-sign monitoring, analytics charts, CSV and JSON export, and a selectable queue policy. The system is not connected to any real hospital, uses no real patient data, and its output is not medical advice.</p>''')
    h.append(sec('1.4', 'Outline'))
    h.append('''<p>The report is organized as follows: The introduction is given in Chapter 1, describing the fundamental AI and Soft Computing paradigms used in MediMind along with the project objectives and scope. Chapter 2 presents the literature survey of graph search, logic programming, adversarial search, fuzzy logic, neuro-fuzzy learning, neural learning rules and language models, highlighting their advantages and limitations. Chapter 3 details the proposed MediMind system architecture, algorithms, datasets, and hardware and software specifications. Chapter 4 analyzes dashboard telemetry, training convergence, search cost, triage verification and queueing results. The societal and technical applications of the platform are discussed in Chapter 5, while Chapter 6 concludes the report and outlines future research directions.</p></section>''')

    # ================= CHAPTER 2 =================
    h.append(chap(2, 'Literature Survey'))
    h.append(sec('2.1', 'Search, Rule-Based and Adversarial Techniques'))
    h.append('<p>The techniques in this category represent hospital decisions as explicit states, rules or games. They are transparent, deterministic and easy to verify, which is important in healthcare. Various techniques in this category are listed here. These techniques have various advantages and are used extensively in literature.</p>')
    h.append(sub('2.1.1', 'Intelligent Agents, PEAS and Problem Formulation'))
    h.append('<p>Russell and Norvig [1] define an intelligent agent as anything that perceives its environment through sensors and acts on it through actuators, and they describe its task environment with the PEAS model: Performance measure, Environment, Actuators and Sensors. A problem is then formulated by stating its states, initial state, actions, transition model, goal test and path cost. In MediMind (<code>peas.js</code>), the patient triage and monitoring agent is described with PEAS, its task environment is classified (partially observable, stochastic, sequential, dynamic, hybrid and multi-agent), and the performance measure is computed live from the simulation. The advantage is a precise, testable statement of what the agent must achieve; the limitation is that the formulation is only as good as the performance measure chosen.</p>')
    h.append(sub('2.1.2', 'Uninformed and Informed Graph Search'))
    h.append(f'''<p>Russell and Norvig [1] formalize uninformed search algorithms, specifically Breadth-First Search (BFS) [12] and Depth-First Search (DFS) [13], together with heuristic search. Hart, Nilsson and Raphael [2] introduced A*, which orders expansion by f(n) = g(n) + h(n) and returns an optimal path whenever the heuristic never overestimates the true cost. In a hospital, locations such as the entrance, triage desk, laboratory, lift and intensive care unit form a graph whose edges are corridors, lifts and staircases with walking cost. This approach is divided into three operational parts in our project: first, applying BFS to find the route with the fewest hops; second, applying DFS to demonstrate that a reachable path need not be short; and third, applying A* with a straight-line heuristic to find the lowest-cost route while avoiding blocked corridors and staircases. The primary advantage of these techniques is deterministic and explainable path planning. The main limitation is that graph search only decides movement and says nothing about patient priority or resource availability.</p>''')
    h.append(sub('2.1.3', 'Logic Programming and Rule-Based Reasoning'))
    h.append('''<p>Clocksin and Mellish [3] describe Prolog, in which knowledge is written as facts and rules and answers are obtained by logical inference with backtracking. In MediMind (<code>prolog.js</code>), simulated patient attributes are asserted as facts, and rules such as <code>priority_reason(P, high, severe_symptom(S))</code> derive a priority together with the exact rule that fired. A second knowledge base matches a patient&rsquo;s priority and condition to free beds, specialist doctors and diagnostic units, using fallback clauses when a resource is full. The advantage is full explainability and easy editing of the rules. The disadvantage is that crisp rules do not express gradual changes such as a heart rate of 101 bpm, which motivates fuzzy logic.</p>''')
    h.append(sub('2.1.4', 'Adversarial Minimax Search'))
    h.append('''<p>Formalized in game theory by von Neumann and Morgenstern [4] and made efficient by alpha-beta pruning [5], Minimax search models zero-sum decision-making between a Maximizer and a Minimizer. In MediMind (<code>minimax.js</code>), a defender chooses which hospital digital asset (patient-record database, laboratory server or appointment portal) to harden while an attacker chooses what to attack. Using predefined utilities, the defender finds the strategy with the best worst-case outcome. The advantage is a principled defensive plan under a worst-case adversary; the disadvantage is that utilities are assumptions and the game tree grows quickly with more rounds.</p>''')
    h.append(sec('2.2', 'Soft Computing, Machine Learning and Language Model Techniques'))
    h.append('<p>The techniques in this category handle imprecise measurements, learn from data and generate text from corpora.</p>')
    h.append(sub('2.2.1', 'Fuzzy Logic and Fuzzy Control'))
    h.append('''<p>Zadeh [6] introduced fuzzy set theory to replace rigid true/false membership with degrees between 0 and 1, and Mamdani and Assilian [7] applied it to rule-based control. In MediMind (<code>fuzzy.js</code>), membership functions describe heart rate (low, normal, elevated, very high) and body temperature (low, normal, fever, high), sixteen rules map them to a monitoring priority, and centroid defuzzification returns a smooth score from 0 to 100. A second controller with 27 rules sets room-lighting intensity from ambient light, occupancy and activity and is implemented twice: as a Mamdani system and as a Takagi-Sugeno system [15], whose rules output crisp constants combined by a weighted average, so that the two approaches can be compared. The advantage is human-readable, continuous scoring; the disadvantage of a standalone fuzzy system is that its membership parameters stay fixed unless paired with learning.</p>''')
    h.append(sub('2.2.2', 'Hybrid Neuro-Fuzzy Approach (ANFIS)'))
    h.append(f'''<p>Jang [8] presented the Adaptive-Network-Based Fuzzy Inference System (ANFIS), which implements a Takagi-Sugeno fuzzy inference system inside an adaptive neural network. As shown conceptually in Figure 2.1, the hybrid combines the qualitative if-then reasoning of fuzzy logic with gradient-based learning of membership parameters and linear consequents. In MediMind (<code>anfis.js</code>), four inputs (age, systolic blood pressure, BMI and glucose) are described by two Gaussian sets each, giving {A['rules']} rules, and back-propagation reduced the held-out RMSE from {f3(A['testRmse'][0])} to {f3(A['testRmse'][-1])} on a synthetic dataset.</p>''')
    h.append(fig(f'{W}/fig/fig2_1.png', 'Fig 2.1: Hybrid Neuro-Fuzzy (ANFIS) Risk Estimator Architecture adapted from Jang [8]', width='96%'))
    h.append(sub('2.2.3', 'Perceptron and Competitive Learning'))
    h.append('''<p>Rosenblatt [9] introduced the Perceptron learning rule, w &larr; w + &eta;(t &minus; y)x, a supervised method that learns a linear boundary between two classes. Rumelhart and Zipser [10] described competitive learning, an unsupervised winner-takes-all rule in which the prototype nearest to an input moves toward it, so groups emerge without labels. In MediMind (<code>learn.js</code>), the Perceptron separates routine-care from intensive-care synthetic records and competitive learning discovers three groups of similar records. The advantage is simplicity and interpretability; the limitation is that a single Perceptron cannot separate overlapping classes perfectly.</p>''')
    h.append(sub('2.2.4', 'N-Gram Language Models'))
    h.append('''<p>Shannon [14] introduced statistical models of word sequences, and n-gram models are described in detail by Jurafsky and Martin [11]. A bigram model predicts the next word from one previous word, P(w<sub>n</sub> | w<sub>n&minus;1</sub>), and a trigram model uses two previous words. In MediMind (<code>ngram.js</code>), a bigram Micro Language Model (&micro;LM) and a trigram Small Language Model (SLM) are trained on a healthcare corpus, predict the next word and generate short informational messages, with the trigram model backing off to the bigram when a context is unseen. The advantage is small size, speed and transparency; the disadvantage is that coherence depends on corpus size.</p>''')
    h.append(sec('2.3', 'Literature Summary'))
    h.append('<p>A literature review is an objective, critical summary of published research literature relevant to a topic under consideration for research. The summary of the literature used to build the ten modules of MediMind is presented in Table 2.1.</p>')
    h.append(tbl(['SN', 'Paper / Author', 'Advantages and Disadvantages'], [
        ['1.', 'S. Russell and P. Norvig [1]<br>(PEAS, BFS, DFS, Minimax)', '<b>Advantages:</b> A precise PEAS description of the agent, deterministic path discovery with BFS and DFS and a worst-case defensive strategy with Minimax.<br><b>Disadvantages:</b> Blind search ignores edge cost; Minimax needs assumed utilities.'],
        ['2.', 'P. Hart, N. Nilsson and B. Raphael [2]<br>(A* Search)', '<b>Advantages:</b> Optimal lowest-cost route with fewer expansions than uninformed search when the heuristic is admissible.<br><b>Disadvantages:</b> Needs a good heuristic and a weighted graph of the building.'],
        ['3.', 'W. Clocksin and C. Mellish [3]<br>(Prolog)', '<b>Advantages:</b> Facts and rules give fully explainable triage and allocation decisions.<br><b>Disadvantages:</b> Crisp rules cannot express gradual changes in measurements.'],
        ['4.', 'L. A. Zadeh [6]; E. Mamdani and S. Assilian [7]; T. Takagi and M. Sugeno [15]<br>(Fuzzy Sets, Mamdani and Sugeno Control)', '<b>Advantages:</b> Replaces brittle thresholds with smooth, human-readable scores; Sugeno is cheaper to compute, Mamdani more readable.<br><b>Disadvantages:</b> Static membership functions do not adapt to data.'],
        ['5.', 'J.-S. R. Jang [8]<br>(ANFIS)', '<b>Advantages:</b> Combines fuzzy rules with learned parameters and reduces training error.<br><b>Disadvantages:</b> Rule count grows exponentially with inputs and results depend on the data used.'],
        ['6.', 'F. Rosenblatt [9]; D. Rumelhart and D. Zipser [10]<br>(Perceptron, Competitive Learning)', '<b>Advantages:</b> Simple supervised classification and unsupervised group discovery.<br><b>Disadvantages:</b> Linear boundary only; results depend on prototype initialization.'],
        ['7.', 'D. Jurafsky and J. Martin [11]<br>(N-gram Language Models)', '<b>Advantages:</b> Small, fast and transparent next-word prediction and text generation.<br><b>Disadvantages:</b> Limited context and coherence on small corpora.'],
    ], 'Table 2.1 Summary of literature survey', widths=['6%', '34%', '60%']) + '</section>')

    # ================= CHAPTER 3 =================
    h.append(chap(3, 'Proposed System'))
    h.append(sec('3.1', 'Overview'))
    h.append('<p>The system overview of <b>MediMind</b> is presented in this section. The classification of the ten Artificial Intelligence and Soft Computing techniques integrated within the smart hospital domain is shown in Figure 3.1.</p>')
    h.append(fig(f'{W}/fig/fig3_1.png', 'Fig. 3.1 MEDIMIND AI &amp; Soft Computing Core taxonomy', width='92%'))
    h.append('<p>This system assists hospital staff and students in making explainable, risk-aware decisions about patient flow under uncertainty. Based on the challenges of hospital operations, the techniques can be categorized into the following core paradigms:</p>')
    h.append(ul([
        '<b>Agent-Based Problem Formulation:</b> The task is described as an intelligent triage and monitoring agent with the PEAS model (<code>peas.js</code>): its performance measure, environment, actuators and sensors, the properties of its task environment, and a state-space formulation with states, actions, transition model, goal test and path cost.',
        '<b>Rule-Based and Logic-Programming Systems:</b> Prolog facts and rules (<code>prolog.js</code>) classify arriving patients into Routine, Moderate, High and Emergency priority and allocate beds, doctors and diagnostics. Instead of predicting outcomes, they apply transparent policy: a severe symptom such as chest pain always produces an Emergency, and every result lists the rule that fired.',
        '<b>Search-Based Planning:</b> BFS, DFS and A* (<code>search.js</code>) treat hospital locations as states and corridors, lifts and staircases as actions with cost. A* uses a straight-line heuristic that never overestimates, so emergency routes are optimal while avoiding closed corridors and, for stretcher transport, staircases.',
        '<b>Crisp vs. Continuous Fuzzy Controllers:</b> Traditional alarms use crisp thresholds on heart rate and temperature. MediMind implements a Mamdani fuzzy controller for vital signs that maps crisp measurements to smooth degrees of membership, avoiding sudden jumps between &ldquo;normal&rdquo; and &ldquo;abnormal&rdquo;, and a 27-rule room-lighting controller built twice, as Mamdani and as Takagi-Sugeno inference (<code>fuzzy.js</code>), so that centroid defuzzification can be compared with a weighted average.',
        '<b>Learning Systems:</b> A neuro-fuzzy network learns membership parameters and linear consequents from synthetic data (<code>anfis.js</code>), a Perceptron learns a supervised boundary, competitive learning discovers unlabelled groups (<code>learn.js</code>), and n-gram models learn word sequences (<code>ngram.js</code>).',
        '<b>Adversarial Decision Making:</b> A two-player Minimax game (<code>minimax.js</code>) lets a defender protect hospital servers against a worst-case attacker using predefined utilities.']))
    h.append('<p>Before any algorithm is chosen, the task is identified and described with the PEAS model (Performance measure, Environment, Actuators, Sensors). Table 3.1 summarizes the PEAS description of the MediMind intelligent patient triage and monitoring agent, which is implemented in <code>peas.js</code> and measured live on the simulation.</p>')
    h.append(tbl(['PEAS Element', 'Description for the MediMind Triage and Monitoring Agent'], [
        ['<b>Performance measure</b>', 'Share of patients assessed within their triage target (Emergency and High 10 min, Moderate 60 min, Routine 120 min); mean wait of urgent patients; urgency-weighted waiting cost; bed and doctor utilisation; every priority decision explained.'],
        ['<b>Environment</b>', 'Emergency department, wards and corridors of a two-floor hospital; arriving patients with symptoms, pain and changing vital signs; limited beds, specialist doctors and diagnostic units; simulated clock and closed corridors.'],
        ['<b>Actuators</b>', 'Assign triage priority; raise emergency and long-wait alerts; allocate a bed, specialist and diagnostic unit; escalate or discharge; plan a transfer route and recommend an assessment time.'],
        ['<b>Sensors</b>', 'Reported symptoms and pain score; heart rate and body temperature; age, blood pressure, BMI and glucose; bed, doctor and scanner availability and queue length; simulated clock and corridor status.'],
    ], 'Table 3.1 PEAS description of the MediMind triage and monitoring agent', widths=['22%', '78%']))
    h.append('<p style="margin-top:10pt">The task environment is <b>partially observable</b> (only symptoms and vitals are sensed), <b>stochastic</b> (random arrivals and vital-sign drift), <b>sequential</b> (a bed given now is not available later), <b>dynamic</b> (patients arrive while the agent decides), <b>hybrid</b> (discrete symptoms and continuous vitals), <b>multi-agent</b> and cooperative, and <b>partly known</b>. The agent is a utility-based agent with a model of the hospital. The problem is formulated as a state-space problem: a <i>state</i> is the set of patients with their priorities and vitals, the availability of every resource and the clock; the <i>initial state</i> is the seeded hospital with seven patients and all resources free; the <i>actions</i> are ASSIGN-PRIORITY, ADMIT, ESCALATE, DISCHARGE, ROUTE and WAIT; the <i>transition model</i> applies the action and advances one minute; the <i>goal test</i> requires every patient to be assessed within its target and no Emergency patient to be left without a route; and the <i>path cost</i> is the urgency-weighted waiting time (Emergency x8, High x4, Moderate x2, Routine x1).</p>')
    h.append(sub('3.1.1', 'Existing System Architecture'))
    h.append('<p>Conventional hospital workflows operate as manual, single-queue pipelines that lack a shared view of resources, explainable priorities and live routing.</p>')
    h.append(fig(f'{W}/fig/fig3_2.png', 'Fig. 3.2 Existing system architecture used for conventional manual hospital workflows', width='92%'))
    h.append('<p>The high-level architecture of an existing manual workflow is depicted in Figure 3.2. Its process is performed in four rigid steps:</p>')
    h.append(ol([
        '<b>Registration Desk:</b> Records the patient on paper or at a counter without structured symptoms, so urgency is judged by eye.',
        '<b>First-Come-First-Served Queue:</b> Serves patients in arrival order. A critical patient who arrives behind several routine patients must wait, and a fixed threshold alarm cannot resolve conflicting vital signs.',
        '<b>Manual Allocation:</b> Staff phone different wards to find a free bed, doctor or scanner, with no shared live picture and no fallback logic.',
        '<b>Verbal Directions:</b> Patients and stretchers follow static signage or verbal directions, which cannot adapt when a corridor or lift is unavailable.']))
    h.append(sub('3.1.2', 'Proposed System Architecture'))
    h.append('<p>The previous section highlighted the fragility of existing manual workflows. To achieve explainable, adaptive and low-cost decision support, MediMind combines all ten AI and Soft Computing techniques into one browser-based architecture whose central component is a shared simulation engine (<code>Simulation</code> in <code>src/lib/sim.js</code>), as shown in Figure 3.3.</p>')
    h.append(fig(f'{W}/fig/fig3_3.png', 'Fig. 3.3 Proposed MediMind System Architecture', width='84%'))
    h.append('<p>In MediMind, multiple soft computing, machine learning and search components are hybridized across the pipeline using the following combination strategies:</p>')
    h.append(ul([
        '<b>Cascade Hybrid:</b> Each decision feeds the next. The Prolog triage result decides bed type and queue order, the allocation result starts treatment, and an Emergency priority triggers A* route planning and an alert.',
        '<b>Feature Augmentation Hybrid:</b> The Prolog priority, the fuzzy monitoring score and the neuro-fuzzy risk score are attached to each patient record and shown together in the patient drawer and monitoring page.',
        '<b>Switching Hybrid:</b> Components switch according to state: bed fallback rules step to a neighbouring bed type when the preferred one is full, the queue policy can be switched between priority triage and first-come-first-served, and stretcher mode switches off staircases.',
        '<b>Weighted Hybrid:</b> The neuro-fuzzy network weights sixteen fuzzy rules by their normalized firing strength to produce one risk score.']))
    h.append(sec('3.2', 'Implementation Details'))
    h.append('<p>The implementation details and step-by-step procedural algorithm of MediMind are given in this section.</p>')
    h.append(sub('3.2.1', 'Algorithm: Simulation Tick Pipeline (Simulation.step)'))
    h.append('<div class="steps"><p><b>Input:</b> Simulation state <i>S</i> = (patients, resources, alerts, events, history, queue policy, seed)</p><p><b>Output:</b> Updated state and an immutable snapshot published to every dashboard page</p></div>')
    steps = [
        ('Step 1 (Advance Clock)', 'Increase the simulated minute counter. With probability equal to the arrival rate (default 0.35 per minute) generate one synthetic patient with a seeded generator.'),
        ('Step 2 (Prolog Triage)', 'Assert the patient&rsquo;s age, pain, temperature and symptoms as Prolog facts and query <code>priority/2</code> and <code>priority_reason/3</code>. A &ldquo;high&rdquo; result caused by a severe symptom becomes Emergency. Store the reasons.'),
        ('Step 3 (Fuzzy Monitoring and Risk)', 'Compute the monitoring priority with the Mamdani system (heart rate, temperature) and the risk score with the trained neuro-fuzzy model (age, blood pressure, BMI, glucose).'),
        ('Step 4 (Vitals Drift)', 'Move each active patient&rsquo;s vitals slightly using a separate random stream: waiting patients fluctuate and treated patients recover toward normal. Re-evaluate the fuzzy score.'),
        ('Step 5 (Release Resources)', 'Discharge patients whose treatment time has ended and free their beds, doctors and diagnostic units on schedule.'),
        ('Step 6 (Prolog Allocation)', 'Order waiting patients by the queue policy (priority triage or first-come-first-served) and query <code>allocation/4</code> to choose a bed, a matching specialist and a diagnostic unit, using fallback clauses when a resource is full.'),
        ('Step 7 (A* Routing and Alerts)', 'For Emergency patients, optionally close a corridor, then run A* (and uniform-cost search for comparison) from the Ambulance Bay to the destination department with stairs excluded. Raise alerts for emergencies, closures and long waits.'),
        ('Step 8 (Record and Publish)', 'Append a history sample (waiting, treating, bed and doctor utilization), derive KPIs, chart data and the PEAS performance measures, and publish one new snapshot that all pages render.'),
    ]
    h.append('<div class="steps">' + ''.join(f'<p><b>{a}:</b> {b}</p>' for a, b in steps) + '</div>')
    h.append(eq('f(n) = g(n) + h(n)', '3.1'))
    h.append(eq('y = &Sigma;<sub>k</sub> &nbsp;w&#772;<sub>k</sub> &nbsp;f<sub>k</sub>(x), &nbsp; w&#772;<sub>k</sub> = w<sub>k</sub> / &Sigma;<sub>j</sub> w<sub>j</sub>, &nbsp; f<sub>k</sub>(x) = p<sub>k0</sub> + &Sigma;<sub>i</sub> p<sub>ki</sub> x<sub>i</sub>', '3.2'))
    h.append(eq('z<sub>Mamdani</sub> = &int; z &mu;(z) dz / &int; &mu;(z) dz, &nbsp; z<sub>Sugeno</sub> = &Sigma;<sub>k</sub> w<sub>k</sub> z<sub>k</sub> / &Sigma;<sub>k</sub> w<sub>k</sub>', '3.3'))
    h.append(eq('P(w<sub>n</sub> | w<sub>n&minus;1</sub>, w<sub>n&minus;2</sub>) = count(w<sub>n&minus;2</sub>, w<sub>n&minus;1</sub>, w<sub>n</sub>) / count(w<sub>n&minus;2</sub>, w<sub>n&minus;1</sub>)', '3.4'))
    h.append('<p>Equation (3.1) is the A* evaluation function, where g(n) is the walking cost so far and h(n) the straight-line estimate to the goal. Equation (3.2) is the Takagi-Sugeno output of the neuro-fuzzy network, Equation (3.3) contrasts Mamdani centroid defuzzification with the Sugeno weighted average used in the room-lighting comparison, and Equation (3.4) is the trigram probability used by the Small Language Model.</p>')
    h.append(sub('3.2.2', 'Use Case Diagram / Activity Diagram'))
    h.append('<p>The activity of one simulated minute is shown in Figure 3.4. Each block in the workflow performs a dedicated role:</p>')
    h.append(fig(f'{W}/fig/fig3_4.png', 'Fig. 3.4 Activity diagram of one simulated minute (tick)', width='64%'))
    h.append(ol([
        '<b>Patient-Flow Block</b> (<code>simData.js</code>, <code>prolog.js</code>, <code>fuzzy.js</code>, <code>anfis.js</code>): Generates synthetic patients and transforms raw symptoms and vitals into a priority, a monitoring score and a risk score.',
        '<b>Resource and Navigation Block</b> (<code>prolog.js</code>, <code>graph.js</code>, <code>search.js</code>): Allocates beds, doctors and diagnostics and plans A* routes through the hospital graph with closed corridors and stretcher restrictions.',
        '<b>Presentation and Analytics Block</b> (<code>sim.js</code>, <code>pages/</code>, <code>components/</code>): Publishes the shared snapshot, draws KPIs and charts, raises alerts, and exports CSV and JSON reports.']))
    h.append(sub('3.2.3', 'Dataset and Input Details'))
    h.append(f'<p>Experiments are conducted using synthetic datasets and a seeded scenario stream to evaluate model training, record grouping, text prediction and end-to-end simulation. No real patient data is used. The datasets used in the experiment are summarized in Table 3.2.</p>')
    h.append(tbl(['Dataset / Scenario Stream', 'Entities', 'Features / Dimensions', 'Records / Interactions', 'Type'], [
        ['<b>Risk Estimation Dataset</b>', 'Synthetic adults', '4 features (age, systolic BP, BMI, glucose)', f"{A['nTrain'] + A['nTest']} records ({A['nTrain']} train, {A['nTest']} test)", 'Supervised Neuro-Fuzzy Training'],
        ['<b>Patient Category Dataset</b>', 'Routine vs intensive care', '2 features (vital instability, lab abnormality)', f"{P['n']} records", 'Perceptron (supervised)'],
        ['<b>Pattern Discovery Dataset</b>', '3 hidden record groups', '2 features (visit frequency, care intensity)', f"{C['n']} records", 'Competitive Learning (unsupervised)'],
        ['<b>Healthcare Text Corpus</b>', 'Appointments, services, prevention', f"{L['vocab']} distinct words", f"{L['sentences']} sentences, {L['tokens']} tokens", 'Bigram and Trigram Language Models'],
        ['<b>Simulation Stream</b>', '6 departments, 19 locations', 'symptoms, pain, vitals, age, condition', f"7 initial patients + {SIM['arrived'] - 7} arrivals in 480 min (seed 42)", 'End-to-End Pipeline and Queue Evaluation'],
        ['<b>Room-Lighting Input Grid</b>', 'Ambient light, occupancy, activity', '3 inputs (0 to 1000 lux, 0 to 6 people, 0 to 10)', f"{FIS['points']:,} combinations", 'Mamdani versus Sugeno comparison'],
        ['<b>Security Game</b>', '3 digital assets', 'values 100, 60, 30; shield cost 8', '2 rounds, 4 plies', 'Minimax / Alpha-Beta'],
    ], 'Table 3.2 Sample Dataset Used for Experiment', widths=['19%', '17%', '24%', '22%', '18%']))
    h.append(sub('3.2.4', 'Hardware and Software Specifications'))
    h.append('<p>The experimental setup and the automated verification suite are executed on a computer system with the hardware and software specifications given in Table 3.3 and Table 3.4 respectively.</p>')
    h.append(tbl(['Component', 'Specification'], [['<b>Processor</b>', 'Intel Core Ultra 5 125H (14 cores, 18 threads)'], ['<b>HDD / SSD</b>', '512 GB NVMe SSD (Samsung)'], ['<b>RAM</b>', '16 GB'], ['<b>Graphics</b>', 'Intel Arc Graphics (integrated)']], 'Table 3.3 Hardware details', widths=['28%', '72%']))
    h.append(tbl(['Category', 'Specification'], [
        ['<b>Operating System</b>', 'Windows 11 Home (build 26200)'],
        ['<b>Programming Language</b>', 'JavaScript (ES modules), Node.js 25.2.1, npm 11.6.2'],
        ['<b>Frontend Framework</b>', 'React 19.3, React Router 7.18, Vite 8.3'],
        ['<b>AI Libraries</b>', 'Tau Prolog 0.3.4 (Prolog in the browser); PEAS, fuzzy (Mamdani and Sugeno), ANFIS, search, Minimax, Perceptron, competitive learning and n-gram models implemented from scratch'],
        ['<b>Visualization</b>', 'Custom SVG and CSS charts, hospital floor-plan graph'],
        ['<b>Testing and Hosting</b>', f'Node verification suite ({tests_total} cases), Playwright 1.63 with Chromium 153, Cloudflare Pages static hosting']], 'Table 3.4 Software details', widths=['28%', '72%']) + '</section>')

    # ================= CHAPTER 4 =================
    h.append(chap(4, 'Performance and Results'))
    h.append(sec('4.1', 'Dashboard Telemetry and Simulation Graphs :'))
    h.append(f'''<p>Figure {FN['overview']} shows the live MediMind Overview dashboard after the seeded simulation had run to {V['clock']} of simulated time and two emergencies had been triggered. The KPI row reports {kp['Total patients']} patients arrived ({kf['Total patients']}), {kp['Patients waiting']} waiting, {kp['Available beds']} beds available ({kf['Available beds']}), {kp['Active emergencies']} active emergencies and a busiest-department workload of {kp['Department workload']} ({kf['Department workload'].replace('Busiest: ', 'busiest: ')}). The AI decision summary on the right names the algorithm behind each latest decision and the reason: Prolog rule base for triage, Prolog allocation rules, A* search for routing, Mamdani fuzzy inference for monitoring and the neuro-fuzzy model for risk.</p>''')
    h.append(fig(shots['overview'], f"Fig {FN['overview']} MediMind Overview Dashboard Displaying Live KPIs, Queue, AI Decision Summary and Emergency Alerts", shot=True, width='84%'))
    h.append(f'''<p>Figure {FN['peas']} shows Experiment 1. The upper part describes the triage and monitoring agent with the PEAS model, classifies its task environment (partially observable, stochastic, sequential, dynamic, hybrid, multi-agent, partly known) and gives the state-space formulation with states, initial state, actions, transition model, goal test and path cost. The lower part applies the agent function to one percept, producing a priority with its reasons, a monitoring alert, a risk estimate and a destination, and then measures the performance measure on the live simulation: the share of patients assessed within their triage target (10 minutes for Emergency and High, 60 for Moderate, 120 for Routine), the mean wait of urgent patients, and an urgency-weighted waiting cost used as the path cost.</p>''')
    h.append(f'<figure class="shot"><div class="subcap">(a) PEAS description, task environment and problem formulation</div><img src="{img(shots["peas1"])}" style="width:78%"><div class="subcap">(b) Agent function on one percept and live performance measures</div><img src="{img(shots["peas2"])}" style="width:78%"><figcaption>Fig {FN["peas"]} PEAS Description and Problem Formulation (a), Agent Action and Live Performance Measures (b)</figcaption></figure>')
    h.append(f'''<p>Figure {FN['drawer']} presents the patient detail drawer. {V['drawer_head'].split(' · ')[0]} was triaged as Emergency by the Prolog rule base because of a severe symptom; the drawer lists the factors used, the recommended assessment (&ldquo;Immediate assessment - target under 10 minutes, route to Emergency Room&rdquo;), the fuzzy monitoring score, the neuro-fuzzy risk score, the allocated bed and doctor, and a timeline of decisions. Every triage result carries a notice that it is educational decision support and not a medical diagnosis.</p>''')
    h.append(fig(shots['patients'], f"Fig {FN['drawer']} Patient Detail Drawer Showing the Prolog Triage Decision, Factors Used and Patient Timeline", shot=True, width='54%'))
    h.append(f'''<p>Figure {FN['routing']} illustrates emergency routing. {ROUTE_TEXT} The map shows {CLOSED_TXT}, the selected stretcher route avoiding staircases (thick teal line), a route cost in metres, the number of nodes expanded by A* and the number uniform-cost search would need. Clicking any corridor closes or reopens it and the route is recalculated immediately.</p>''')
    h.append(fig(shots['routing'], f"Fig {FN['routing']} Emergency Routing Page: A* Route with Closed Corridors, Route Cost and Nodes Expanded", shot=True, width='94%'))
    h.append(f'''<p>Figure {FN['analytics']} shows the analytics page, drawn from the same simulation state as every other page: average wait {V['analytics_kpis'][0].replace('Average wait ', '').replace(' Longest', ', longest')}; the priority distribution ({V['donut']}); the waiting-time distribution of patients; arrivals per five simulated minutes; and the bed and doctor utilization and queue length over time. Hovering a chart shows its exact values.</p>''')
    h.append(fig(shots['analytics'], f"Fig {FN['analytics']} Traffic &amp; Queue Analytics: Department Load, Priority Mix, Waiting Times and Resource Utilization", shot=True, width='94%'))
    mc = [m.replace(' fuzzy monitoring priority', '') for m in V['monitor_counts']]
    h.append(f'''<p>Figure {FN['monitoring']} shows the Patient Monitoring page (Experiment 6). Every active patient&rsquo;s heart rate and temperature are interpreted by the fuzzy logic controller; the current counts by fuzzy category are: {mc[0]}, {mc[1]}, {mc[2]}, {mc[3]}. Below, the 27-rule fuzzy lighting controller sets a lighting percentage for each department room from the simulated clock&rsquo;s ambient light, the room occupancy and the activity level.</p>''')
    h.append(fig(shots['monitoring'], f"Fig {FN['monitoring']} Patient Monitoring: Fuzzy Vital-Sign Scoring and Fuzzy Room-Lighting Control", shot=True, width='94%'))
    h.append(f'''<p>Figure {FN['room']} shows Experiment 7, in which the same 27 rules are implemented as a Mamdani system (clipped output sets and centroid defuzzification) and as a zero-order Takagi-Sugeno system (a crisp constant per rule and a weighted average). Over {FIS['points']:,} combinations of ambient light, occupancy and activity the two outputs differ by {f2(FIS['meanDiff'])} percentage points on average and by at most {f1(FIS['maxDiff'])}, with a correlation of r = {f3(FIS['corr'])}, and {pct(FIS['within5'], 1)} of the combinations agree within 5 points. The largest gaps occur at the ends of the scale, because Mamdani&rsquo;s output sets cannot reach the extremes (its output ranged from {f1(FIS['mamdaniRange'][0])} to {f1(FIS['mamdaniRange'][1])}) whereas Sugeno spans its constants ({FIS['sugenoRange'][0]:.0f} to {FIS['sugenoRange'][1]:.0f}). On this computer the Sugeno system evaluated all combinations in {FIS['sugenoMs']:.0f} ms against {FIS['mamdaniMs']:.0f} ms for Mamdani, about {FIS['mamdaniMs'] / FIS['sugenoMs']:.0f} times faster, because it needs no aggregation or centroid integral. Table 4.1 lists the five preset scenarios.</p>''')
    h.append(f'<figure class="shot"><div class="subcap">(a) Inputs, Mamdani and Sugeno outputs and room preview</div><img src="{img(shots["room1"])}" style="width:80%"><div class="subcap">(b) Comparison sweep of the two inference systems</div><img src="{img(shots["room2"])}" style="width:80%"><figcaption>Fig {FN["room"]} Mamdani versus Sugeno Room-Lighting Control (a) and Output Comparison over an Input Sweep (b)</figcaption></figure>')
    h.append(tbl(['Scenario', 'Mamdani output', 'Sugeno output', 'Difference'], [[r['name'], f"{r['mamdani']}%", f"{r['sugeno']}%", f"{abs(r['mamdani'] - r['sugeno']):.1f}"] for r in FIS['presets']],
                 'Table 4.1: Mamdani versus Sugeno Room-Lighting Output for the Preset Scenarios', widths=['40%', '20%', '20%', '20%'], center_cols=(1, 2, 3)))
    h.append(f'''<p style="margin-top:10pt">Figure {FN['risk']} presents the neuro-fuzzy experiment. Training the {A['rules']}-rule ANFIS on {A['nTrain']} synthetic records reduced the training RMSE from {f3(A['trainRmse'][0])} to {f3(A['trainRmse'][-1])} ({pct(red_train, 1)} reduction) and the held-out test RMSE from {f3(A['testRmse'][0])} to {f3(A['testRmse'][-1])} ({pct(red_test, 1)} reduction) in 100 epochs. On the {A['nTest']} unseen records the predictions correlate with the hidden risk at r = {f3(A['corr'])}, with a mean absolute error of {f3(A['maeTest'])} and a correct low/medium/high category in {pct(A['categoryAccuracy'], 1)} of cases.</p>''')
    h.append(fig(shots['risk'], f"Fig {FN['risk']} Neuro-Fuzzy Risk Estimator after 100 Training Epochs (RMSE Curves and Predicted vs Actual Risk)", shot=True, width='94%'))
    h.append(f'''<p>Figure {FN['security']} shows the Minimax security experiment. With asset values of 100, 60 and 30, a hardening cost of 8 and a leak of 15%, the optimal line of play is: {'; '.join(MM['pv'])}, giving the defender a utility of {MM['value']} compared with {MM['naive']} for an undefended system. Alpha-beta pruning returns the same value while searching {MM['nodesAB']} nodes instead of {MM['nodesPlain']} ({pct(ab_cut, 0)} fewer).</p>''')
    h.append(fig(shots['security'], f"Fig {FN['security']} Minimax Security Experiment: Optimal Defensive Strategy and Game Tree", shot=True, width='94%'))
    h.append(f'''<p>Figure {FN['learning']} shows the two learning experiments on synthetic patient records. In (a) the Perceptron started with {P['errorsStart']} misclassified records of {P['n']} and ended with {P['errorsFinal']} after {P['epochsRun']} epochs ({pct(P['accFinal'], 1)} accuracy) on classes that overlap by design; on well-separated classes it reached zero errors in {P['easyEpochs']} epochs. In (b) competitive learning, which never sees the labels, raised cluster purity from {pct(C['purityStart'], 0)} to {pct(C['purityFinal'], 0)} in {C['epochs']} epochs and placed its three prototypes at ({', '.join(f'{p[0]}, {p[1]}' for p in C['protos'][:1])}), ({', '.join(f'{p[0]}, {p[1]}' for p in C['protos'][1:2])}) and ({', '.join(f'{p[0]}, {p[1]}' for p in C['protos'][2:])}).</p>''')
    h.append(f'<figure class="shot"><div class="subcap">(a) Perceptron decision boundary</div><img src="{img(shots["perceptron"])}" style="width:88%"><div class="subcap">(b) Competitive-learning prototypes</div><img src="{img(shots["competitive"])}" style="width:88%"><figcaption>Fig {FN["learning"]} (a) Perceptron Decision Boundary and (b) Competitive-Learning Prototypes</figcaption></figure>')
    h.append(f'''<p>Figure {FN['messages']} shows the language-model experiment. The corpus contains {L['sentences']} sentences ({L['tokens']} tokens, {L['vocab']} distinct words) giving {L['biCtx']} bigram and {L['triCtx']} trigram contexts. In a leave-one-sentence-out test of {L['bigram']['n']} next-word predictions the bigram &micro;LM ranked the correct word first in {pct(L['bigram']['top1'], 1)} of cases ({pct(L['bigram']['top3'], 1)} within the top three), while the trigram SLM reached {pct(L['trigram']['top1'], 1)} ({pct(L['trigram']['top3'], 1)}); it had to back off to the bigram for {pct(L['trigram']['backoff'], 0)} of contexts, which shows the data sparsity of a small corpus. Example trigram output: &ldquo;{L['sampleTri'][0]}&rdquo; and &ldquo;{L['sampleTri'][3]}&rdquo; whereas the bigram produced less coherent text such as &ldquo;{L['sampleBi'][3]}&rdquo;.</p>''')
    h.append(fig(shots['messages'], f"Fig {FN['messages']} Bigram µLM and Trigram SLM Next-Word Prediction and Message Generation", shot=True, width='94%'))

    h.append(sec('4.2', 'Verification and Comparative Results'))
    h.append(f'''<p>Table 4.2 presents the verification outcome for the Prolog triage rule base on {TR['total']} hand-labelled test cases (six per priority class), whose expected labels were written from the triage policy before the rules were run. In addition, the automated verification suite (<code>npm run verify</code>) passed {tests_pass} of {tests_total} test cases covering search optimality, Prolog triage and allocation, fuzzy systems, neuro-fuzzy training, Minimax, learning rules, language models and simulation invariants (no shared beds, reproducibility from a seed, reset and capacity limits).</p>''')
    mx = TR['matrix']; cls = ['routine', 'moderate', 'high', 'emergency']
    rows = [[f'<b>Expected {c.capitalize()}</b>'] + [str(mx[c][d]) for d in cls] for c in cls]
    h.append(tbl(['Confusion matrix (24 cases)', 'Routine', 'Moderate', 'High', 'Emergency'], rows, 'Table 4.2: Confusion Matrix and Rule Verification for MediMind Triage (rows = expected, columns = predicted)', center_cols=(1, 2, 3, 4)))
    emg_tp = mx['emergency']['emergency']; emg_fp = sum(mx[c]['emergency'] for c in cls if c != 'emergency')
    h.append(f'<p style="margin-top:10pt">For the safety-critical Emergency class there were {emg_tp} true positives, {emg_fp} false positives and {sum(v for k, v in mx["emergency"].items() if k != "emergency")} false negatives, and the overall agreement was {TR["correct"]} of {TR["total"]} ({pct(TR["correct"] / TR["total"], 0)}). These cases verify the implemented rules; they are not a clinical validation.</p>')
    h.append(f'''<p>Table 4.3 compares the measured results of MediMind with a conventional first-come-first-served (FCFS) workflow. Both policies were run on the identical 480-minute synthetic arrival stream ({SIM['arrived']} patients, seed 42, 12 beds, 7 doctors), because the arrival generator uses a random stream that is independent of care decisions.</p>''')
    h.append(tbl(['Evaluation Parameter', 'Existing First-Come-First-Served / Unguided Workflow', 'Proposed MediMind System (Measured)'], [
        ['<b>Emergency patients: mean (max) wait</b>', f"{f1(wb(FC, 'emergency')['avg'])} min ({wb(FC, 'emergency')['max']} min)", f"{f1(wb(SIM, 'emergency')['avg'])} min ({wb(SIM, 'emergency')['max']} min)"],
        ['<b>High-priority patients: mean wait</b>', f"{f1(wb(FC, 'high')['avg'])} min", f"{f1(wb(SIM, 'high')['avg'])} min"],
        ['<b>Moderate patients: mean wait</b>', f"{f1(wb(FC, 'moderate')['avg'])} min", f"{f1(wb(SIM, 'moderate')['avg'])} min"],
        ['<b>Routine patients: mean wait</b>', f"{f1(wb(FC, 'routine')['avg'])} min", f"{f1(wb(SIM, 'routine')['avg'])} min (the cost of serving urgent cases first)"],
        ['<b>Hospital route planning</b>', f"DFS: mean {f1(S2['dfsCostAvg'])} m over {S2['pairs']} location pairs; BFS: {f1(S2['bfsCostAvg'])} m", f"A*: mean {f1(S2['astarCostAvg'])} m, nodes expanded {f1(S2['astarExpAvg'])} vs {f1(S2['ucsExpAvg'])} for uniform-cost ({pct(exp_cut, 0)} fewer)"],
        ['<b>Emergency transfer with closures</b>', 'Static signage; no re-planning when a corridor closes', f"{RT['found']} of {RT['n']} simulated emergencies routed (up to {RT['maxClosed']} closed corridors); A* expanded {f1(RT['avgExpanded'])} vs {f1(RT['avgUcs'])} nodes"],
        ['<b>Vital-sign interpretation</b>', 'Rigid threshold alarm (normal or abnormal)', f"Smooth fuzzy score, e.g. HR 100 bpm and 37.6 °C gives {M['fuzzyVitals'][1]['score']}/100 ({M['fuzzyVitals'][1]['label']})"],
        ['<b>Emergency patients assessed within the 10-minute target</b>', f"{pct(PF['byClass']['emergency']['pct'] / 100, 0)} ({PF['byClass']['emergency']['within']} of {PF['byClass']['emergency']['n']})", f"{pct(PS['byClass']['emergency']['pct'] / 100, 0)} ({PS['byClass']['emergency']['within']} of {PS['byClass']['emergency']['n']})"],
        ['<b>High-priority patients assessed within target</b>', f"{pct(PF['byClass']['high']['pct'] / 100, 0)}", f"{pct(PS['byClass']['high']['pct'] / 100, 0)}"],
        ['<b>PEAS: all patients within target / urgency-weighted waiting cost</b>', f"{f1(PF['withinPct'])}% / {round(PF['weightedCost'])}", f"{f1(PS['withinPct'])}% / {round(PS['weightedCost'])} ({pct(COST_CUT, 0)} lower)"],
        ['<b>Decision explainability</b>', 'None recorded', f"{SIM['triageEvents']} triage and {SIM['allocations']} allocation decisions logged with algorithm and reason"],
        ['<b>Security planning</b>', f"Undefended utility {MM['naive']}", f"Minimax utility {MM['value']}"],
    ], 'Table 4.3: Comparative Results of Existing System vs. Proposed MediMind System', widths=['25%', '33%', '42%']))
    h.append(f'''<p style="margin-top:10pt">The comparison shows the expected trade-off of triage. Under heavy load (average bed occupancy {f1(SIM['bedUtilAvg'])}%), priority ordering cut the mean wait of Emergency patients by {f1(wb(FC, 'emergency')['avg'] - wb(SIM, 'emergency')['avg'])} minutes and of High-priority patients by {f1(wb(FC, 'high')['avg'] - wb(SIM, 'high')['avg'])} minutes, while Routine patients waited {f1(wb(SIM, 'routine')['avg'] - wb(FC, 'routine')['avg'])} minutes longer, and the overall mean wait was {SIM['avgWait']} minutes against {FC['avgWait']} minutes for FCFS. Triage therefore shifts waiting away from the patients who are most urgent and onto those who can wait.</p>''')
    h.append(f'<p>Table 4.4 lists the measured results of the individual modules.</p>')
    r0 = S1[0]; r3 = S1[3]
    h.append(tbl(['Module', 'Metric', 'Measured Result'], [
        ['<b>BFS / DFS</b>', f"{r0['from']} to {r0['to']}", f"BFS {r0['bfs']['hops']} hops, {r0['bfs']['cost']} m; DFS {r0['dfs']['hops']} hops, {r0['dfs']['cost']} m. Mean over all pairs: {f1(S2['bfsHopsAvg'])} vs {f1(S2['dfsHopsAvg'])} hops"],
        ['<b>A* search</b>', f"{r3['from']} to {r3['to']} (stretcher)", f"cost {r3['astar']['cost']} m, {r3['astar']['expanded']} nodes expanded vs {r3['ucs']['expanded']} for uniform-cost; equal optimal cost on all {S2['pairs']} pairs"],
        ['<b>Prolog triage</b>', 'Hand-labelled cases', f"{TR['correct']} of {TR['total']} correct"],
        ['<b>Fuzzy vitals</b>', 'HR 130 bpm, 39.0 °C', f"{M['fuzzyVitals'][3]['score']}/100 ({M['fuzzyVitals'][3]['label']}); HR 72 bpm, 36.8 °C gives {M['fuzzyVitals'][0]['score']}/100 ({M['fuzzyVitals'][0]['label']})"],
        ['<b>Fuzzy room lighting (Mamdani)</b>', 'Dark, 5 people, activity 9', f"{M['fuzzyRoom'][3]['intensity']}% ({M['fuzzyRoom'][3]['label']}); empty room gives {M['fuzzyRoom'][4]['intensity']}% ({M['fuzzyRoom'][4]['label']})"],
        ['<b>Mamdani vs Sugeno FIS</b>', f"{FIS['points']:,} input combinations", f"mean difference {f2(FIS['meanDiff'])} points, max {f1(FIS['maxDiff'])}, r = {f3(FIS['corr'])}; Sugeno {SPEEDUP:.0f}x faster ({FIS['sugenoMs']:.0f} ms vs {FIS['mamdaniMs']:.0f} ms)"],
        ['<b>PEAS performance measure</b>', '480 simulated minutes', f"urgent mean wait {f1(PS['urgentAvg'])} min vs {f1(PF['urgentAvg'])} min (FCFS); weighted waiting cost {round(PS['weightedCost'])} vs {round(PF['weightedCost'])}"],
        ['<b>Neuro-fuzzy (ANFIS)</b>', 'Test RMSE', f"{f3(A['testRmse'][0])} to {f3(A['testRmse'][-1])} ({pct(red_test, 1)} lower), r = {f3(A['corr'])}"],
        ['<b>Perceptron</b>', 'Overlapping classes', f"{P['errorsStart']} to {P['errorsFinal']} errors of {P['n']} ({pct(P['accFinal'], 1)})"],
        ['<b>Competitive learning</b>', 'Cluster purity', f"{pct(C['purityStart'], 0)} to {pct(C['purityFinal'], 0)}"],
        ['<b>Minimax</b>', 'Nodes searched', f"{MM['nodesPlain']} (plain) vs {MM['nodesAB']} (alpha-beta), same value {MM['value']}"],
        ['<b>N-gram models</b>', 'Next-word top-1 / top-3', f"bigram {pct(L['bigram']['top1'], 1)} / {pct(L['bigram']['top3'], 1)}; trigram {pct(L['trigram']['top1'], 1)} / {pct(L['trigram']['top3'], 1)}"],
        ['<b>Simulation</b>', '480 simulated minutes', f"{SIM['arrived']} arrivals, {SIM['discharged']} discharged, mean bed use {f1(SIM['bedUtilAvg'])}%, {SIM['emergencyAlerts']} emergency alerts"],
    ], 'Table 4.4: Measured Results of the Individual AI Modules', widths=['20%', '24%', '56%']) + '</section>')

    # ================= CHAPTER 5 =================
    h.append(chap(5, 'Applications'))
    h.append('<p>There are various applications of the MediMind AI and Soft Computing platform across hospital operations, academic education and healthcare engineering. The primary applications are listed below under Social and Technical categories.</p>')
    h.append(sec('5.1', 'Social and Educational Applications'))
    h.append(ul([
        '<b>5.1.1 Teaching Explainable AI and Soft Computing</b> Students often meet problem formulation and algorithms such as BFS, A*, Prolog, fuzzy logic and Minimax in isolation. MediMind shows all ten in one believable context, with a step-through view and a stated reason for every decision, so learners can see why each technique exists and how the techniques cooperate.',
        '<b>5.1.2 Understanding Fairness in Waiting Lines</b> The queue-policy switch lets the public and students compare first-come-first-served with priority triage on the same arrivals and see the trade-off in waiting time between urgent and routine patients, which supports informed discussion about emergency-department fairness.',
        '<b>5.1.3 Health Awareness Messaging</b> The bigram and trigram language models generate short, readable messages about appointments, hospital services, preventive care and general health awareness from an editable corpus, showing how simple on-device models can support patient communication without cloud services.',
        '<b>5.1.4 Transparent AI that Respects Privacy</b> Every patient is synthetic and every result carries a notice that it is educational decision support. This demonstrates how transparent, locally run AI can be presented responsibly without collecting personal data.']))
    h.append(sec('5.2', 'Technical and Institutional Applications'))
    h.append(ul([
        '<b>5.2.1 Hospital Operations Decision Support</b> Administrators can experiment with the number of ICU, ward and day-care beds and doctors per specialty, change the arrival rate, and immediately observe queue length, waiting times and utilization, using Prolog allocation rules with explainable fallback clauses.',
        '<b>5.2.2 Indoor Navigation and Emergency Transport</b> The A* planner finds the lowest-cost stretcher route through a two-floor building while avoiding staircases and closed corridors, and the same graph-search design can serve visitor wayfinding and porter dispatch in real buildings.',
        '<b>5.2.3 Early-Warning Patient Monitoring</b> The fuzzy monitoring system turns heart rate and temperature into a smooth priority that avoids the sudden jumps of threshold alarms, and the neuro-fuzzy model shows how learned risk scores can accompany fuzzy rules.',
        '<b>5.2.4 Smart Building and Environment Control</b> The 27-rule fuzzy lighting controller, built as both a Mamdani and a Sugeno system, adjusts room lighting to ambient light, occupancy and activity level, illustrating energy-aware, comfort-aware control and letting designers trade Mamdani&rsquo;s readability against Sugeno&rsquo;s speed.',
        '<b>5.2.5 Healthcare Cyber-Defence Planning</b> The Minimax experiment models a defender with limited hardening resources against a worst-case attacker for patient-record, laboratory and appointment services, and shows how alpha-beta pruning keeps such analysis efficient.',
        '<b>5.2.6 Pattern Discovery in Records</b> The Perceptron and competitive-learning experiments show how supervised classification and unsupervised grouping can reveal categories of patient records that need different services.']))
    h.append('</section>')

    # ================= CHAPTER 6 =================
    h.append(chap(6, 'Conclusion and Future Scope'))
    h.append('<h2 class="sec" style="margin-top:12pt">6.1 Conclusion</h2>')
    h.append(f'''<p>In this project, we designed, implemented and experimentally validated <b>MediMind</b>, an AI-powered smart hospital assistant that integrates ten Artificial Intelligence and Soft Computing techniques into one shared, seeded simulation. By replacing manual first-come-first-served handling and rigid thresholds with Prolog rule-based triage and allocation, Mamdani fuzzy inference and a trained Hybrid Neuro-Fuzzy System (test RMSE {f3(A['testRmse'][0])} to {f3(A['testRmse'][-1])}), the system produces explainable, smoothly graded decisions. Search-based modules found optimal routes with A* while expanding {pct(exp_cut, 0)} fewer nodes than uniform-cost search, Minimax with alpha-beta pruning cut the search from {MM['nodesPlain']} to {MM['nodesAB']} nodes,. The PEAS formulation made the performance measure explicit: priority triage assessed {pct(PS['byClass']['emergency']['pct'] / 100, 0)} of Emergency patients within the 10-minute target against {pct(PF['byClass']['emergency']['pct'] / 100, 0)} for first-come-first-served. In an eight-hour simulation priority triage cut the mean Emergency wait from {f1(wb(FC, 'emergency')['avg'])} to {f1(wb(SIM, 'emergency')['avg'])} minutes, at the cost of longer waits for Routine patients, and the platform passed {tests_pass} of {tests_total} automated test cases. The limitations are that all data is synthetic, the rules are simplified teaching rules, and the results are illustrative rather than clinically validated.</p>''')
    h.append('<h2 class="sec">6.2 Future Scope</h2>')
    h.append(ul([
        '<b>Real Data with Consent:</b> Replace the synthetic generator with de-identified HL7 FHIR data and validate triage and risk with clinicians before any operational use.',
        '<b>Reinforcement Learning for Scheduling:</b> Combine the rule-based allocator with reinforcement learning (for example Deep Q-Networks) to learn queue and bed-management policies.',
        '<b>On-Device Small Language Models:</b> Extend the n-gram messaging module with quantized small language models for multilingual patient guidance in the browser.',
        '<b>Digital Twin of the Building:</b> Import real floor plans and indoor positioning data so that A* routes and corridor closures reflect a real hospital.']))
    h.append('</section>')

    # ================= REFERENCES =================
    refs = [
        'S. Russell and P. Norvig, <i>Artificial Intelligence: A Modern Approach</i>, 4th ed. Hoboken, NJ, USA: Pearson, 2020.',
        'P. E. Hart, N. J. Nilsson and B. Raphael, &ldquo;A formal basis for the heuristic determination of minimum cost paths,&rdquo; <i>IEEE Transactions on Systems Science and Cybernetics</i>, vol. 4, no. 2, pp. 100&ndash;107, July 1968.',
        'W. F. Clocksin and C. S. Mellish, <i>Programming in Prolog</i>, 5th ed. Berlin, Germany: Springer, 2003.',
        'J. von Neumann and O. Morgenstern, <i>Theory of Games and Economic Behavior</i>. Princeton, NJ, USA: Princeton Univ. Press, 1944.',
        'D. E. Knuth and R. W. Moore, &ldquo;An analysis of alpha-beta pruning,&rdquo; <i>Artificial Intelligence</i>, vol. 6, no. 4, pp. 293&ndash;326, Winter 1975.',
        'L. A. Zadeh, &ldquo;Fuzzy sets,&rdquo; <i>Information and Control</i>, vol. 8, no. 3, pp. 338&ndash;353, June 1965.',
        'E. H. Mamdani and S. Assilian, &ldquo;An experiment in linguistic synthesis with a fuzzy logic controller,&rdquo; <i>International Journal of Man-Machine Studies</i>, vol. 7, no. 1, pp. 1&ndash;13, Jan. 1975.',
        'J.-S. R. Jang, &ldquo;ANFIS: Adaptive-network-based fuzzy inference system,&rdquo; <i>IEEE Transactions on Systems, Man, and Cybernetics</i>, vol. 23, no. 3, pp. 665&ndash;685, May/June 1993.',
        'F. Rosenblatt, &ldquo;The perceptron: A probabilistic model for information storage and organization in the brain,&rdquo; <i>Psychological Review</i>, vol. 65, no. 6, pp. 386&ndash;408, Nov. 1958.',
        'D. E. Rumelhart and D. Zipser, &ldquo;Feature discovery by competitive learning,&rdquo; <i>Cognitive Science</i>, vol. 9, no. 1, pp. 75&ndash;112, Jan. 1985.',
        'D. Jurafsky and J. H. Martin, <i>Speech and Language Processing</i>, 3rd ed. (draft), ch. 3, &ldquo;N-gram Language Models.&rdquo; [Online]. Available: https://web.stanford.edu/~jurafsky/slp3/',
        'E. F. Moore, &ldquo;The shortest path through a maze,&rdquo; in <i>Proc. Int. Symp. Theory of Switching, Part II</i>, Cambridge, MA, USA: Harvard Univ. Press, 1959, pp. 285&ndash;292.',
        'R. Tarjan, &ldquo;Depth-first search and linear graph algorithms,&rdquo; <i>SIAM Journal on Computing</i>, vol. 1, no. 2, pp. 146&ndash;160, June 1972.',
        'C. E. Shannon, &ldquo;A mathematical theory of communication,&rdquo; <i>Bell System Technical Journal</i>, vol. 27, no. 3, pp. 379&ndash;423, July 1948.',
    'T. Takagi and M. Sugeno, &ldquo;Fuzzy identification of systems and its applications to modeling and control,&rdquo; <i>IEEE Transactions on Systems, Man, and Cybernetics</i>, vol. SMC-15, no. 1, pp. 116&ndash;132, Jan./Feb. 1985.',
    ]
    h.append('<section class="page chapter refs"><p class="title16" style="margin-top:4pt">References</p>' + ''.join(f'<p>[{i + 1}] {r}</p>' for i, r in enumerate(refs)) + '</section>')
    # ================= ACKNOWLEDGEMENT =================
    h.append(f'''<section class="chapter ack"><p class="title16" style="margin-top:4pt">Acknowledgement</p>
<p style="text-align:center;font-style:italic;font-size:10pt;margin:0 0 14pt">{ACK_NOTE}</p>
<p>We would like to express our special thanks to <b>{SUPERVISOR}</b>, our mini project guide who guided us through the project and who helped us in applying the knowledge that we have acquired during the semester and learning new concepts.</p>
<p>We would like to express our special thanks to <b>{HOD}</b> Head, Department of Department of Artificial Intelligence and Data Science, who gave us the opportunity to do this mini project because of which we learned new concepts and their application.</p>
<p>We are also thankful to our mini project coordinator <b>{SUPERVISOR}</b> along with other faculties for their encouragement and support.</p>
<p>Finally we would like to express our specials thanks of gratitude to Principal <b>{PRINCIPAL}</b> who gave us the opportunity and facilities to conduct this mini project.</p>
<p style="text-align:right;margin-top:40pt">{STUDENT}</p></section>''')
    css = open(f'{HERE}/report.css', encoding='utf-8').read()
    return f'<!doctype html><html><head><meta charset="utf-8"><title>{esc(TITLE)} - Mini Project Report</title><style>{css}</style></head><body>' + ''.join(h) + '</body></html>'


def render(html_path, pdf_path):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(); pg = b.new_page()
        pg.goto('file:///' + html_path.replace('\\', '/')); pg.wait_for_timeout(1500)
        pg.pdf(path=pdf_path, format='Letter', print_background=True, prefer_css_page_size=True)
        b.close()


def norm(s): return re.sub(r'\s+', ' ', s.replace('\xa0', ' ')).strip()


def analyse(pdf):
    d = fitz.open(pdf)
    texts = [norm(d[i].get_text()) for i in range(len(d))]
    firsts = [norm(d[i].get_text().strip().split('\n')[0]) if d[i].get_text().strip() else '' for i in range(len(d))]
    idx = {}
    for key in ('Abstract', 'List of Figures', 'List of Tables', 'References', 'Acknowledgement'):
        idx[key] = max(i for i, f in enumerate(firsts) if f == key) if key in firsts else None
    ch1 = next(i for i, f in enumerate(firsts) if f == 'Chapter 1')
    idx['Chapter 1'] = ch1
    pages = {}
    for n in range(2, 7):
        pages[f'Chapter {n}'] = next(i for i, f in enumerate(firsts) if f == f'Chapter {n}')
    pages['Chapter 1'] = ch1
    for lvl, num, title, key in TOC:
        if key.startswith('Chapter') or key in idx and idx[key] is not None and key in ('Abstract', 'List of Figures', 'List of Tables', 'References', 'Acknowledgement'):
            continue
        # section heading: first page after chapter 1 start that contains the heading text
        pages[key] = next((i for i in range(ch1, len(d)) if key in texts[i]), None)
        if pages[key] is None: print('!! not found:', key)
    for a, b in FIGS + TABLES:
        first = re.sub(r'&amp;', '&', b).split()[0]
        num = a.split(' ', 1)[1]
        kind = r'Fig\.?\s*' if a.startswith('Fig') else r'Table\s+'
        pat = re.compile(r'^' + kind + re.escape(num) + r':?\s+' + re.escape(first), re.M)
        pages[a] = next((i for i in range(ch1, len(d)) if pat.search(d[i].get_text().replace(' ', ' '))), None)
        if pages[a] is None: print('!! not found:', a)
    return d, idx, pages, ch1


def build_pdf():
    # pass 1
    html1 = os.path.join(W, 'report_pass1.html'); pdf1 = os.path.join(W, 'report_pass1.pdf')
    open(html1, 'w', encoding='utf-8').write(build({}))
    render(html1, pdf1)
    d, idx, pages, ch1 = analyse(pdf1)
    label = {}
    roman = {'Abstract': 'i', 'List of Figures': 'ii', 'List of Tables': 'iii'}
    for k, v in roman.items(): label[k] = v
    for k, v in pages.items(): label[k] = str(v - ch1 + 1) if v is not None else '??'
    label['References'] = str(idx['References'] - ch1 + 1) if idx['References'] is not None else ''
    label['Acknowledgement'] = str(idx['Acknowledgement'] - ch1 + 1) if idx['Acknowledgement'] is not None else ''
    # for TOC rows References / Acknowledgement the original has no page number
    toc_label = dict(label); toc_label['References'] = ''; toc_label['Acknowledgement'] = ''
    html2 = os.path.join(W, 'report.html'); pdf2 = os.path.join(W, 'report_nopages.pdf')
    open(html2, 'w', encoding='utf-8').write(build(toc_label))
    render(html2, pdf2)
    d2, idx2, pages2, ch12 = analyse(pdf2)
    assert len(d2) == len(d), f'page count changed {len(d)} -> {len(d2)}'
    # page numbers
    firsts = [norm(d2[i].get_text().strip().split('\n')[0]) for i in range(len(d2))]
    for i, page in enumerate(d2):
        if i >= ch12: lab = str(i - ch12 + 1)
        elif firsts[i] == 'Abstract' and i == idx2['Abstract']: lab = 'i'
        elif i == idx2['List of Figures']: lab = 'ii'
        elif i == idx2['List of Tables']: lab = 'iii'
        else: lab = ''
        if lab:
            w = fitz.get_text_length(lab, fontname='tiro', fontsize=12)
            page.insert_text(fitz.Point(306 - w / 2, 752), lab, fontname='tiro', fontsize=12)
    d2.set_metadata({'title': f'{TITLE} - TE Mini Project Report', 'author': STUDENT, 'subject': 'TE Artificial Intelligence and Soft Computing Mini Project Report'})
    d2.save(OUT, garbage=3, deflate=True)
    print('pages', len(d2), 'chapter1 at physical page', ch12 + 1)
    # verify TOC numbers equal pass-2 actuals
    bad = [(k, toc_label.get(k), str(pages2[k] - ch12 + 1)) for k in pages2 if pages2[k] is not None and k in toc_label and toc_label[k] != str(pages2[k] - ch12 + 1)]
    print('TOC mismatches:', bad)


if __name__ == '__main__':
    build_pdf()
