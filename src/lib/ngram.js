// Bigram (micro LM, 1 previous word) and Trigram (small LM, 2 previous words).
export const START = '<s>';
export const END = '</s>';

export const DEFAULT_CORPUS = `Your appointment is confirmed for tomorrow morning.
Your appointment is confirmed at the outpatient clinic.
Please arrive fifteen minutes before your appointment time.
Please bring your health card and previous medical reports.
Please bring your medicines to the clinic.
Please carry a valid photo identity card to the reception.
Please wear a mask inside the hospital.
Please wash your hands before entering the ward.
The outpatient clinic is open from nine in the morning to five in the evening.
The pharmacy is open every day from eight in the morning to eight in the evening.
The pathology lab is open every day for blood tests.
The emergency department is open all day and all night.
The radiology department offers x-ray and scan services every day.
The cardiology clinic is on the first floor of the hospital.
The pediatrics ward is on the first floor near the lift.
The reception desk is near the main entrance of the hospital.
Visiting hours are from four in the evening to six in the evening.
Visiting hours for the intensive care unit are limited to one visitor at a time.
Regular health checkups help detect problems early.
Regular exercise keeps your heart healthy and strong.
Regular sleep helps your body recover and stay healthy.
Drink plenty of water every day to stay healthy.
Drink plenty of fluids when you have a fever.
Eat fresh fruits and vegetables every day to stay healthy.
Eat a balanced diet to keep your body strong.
Wash your hands with soap and water to prevent infection.
Wash your hands before eating and after using the toilet.
Vaccination protects you and your family from serious diseases.
Vaccination protects children from serious diseases.
Your vaccination schedule is available at the pediatrics clinic.
Your test results will be ready within two days.
Your test results will be shared with your doctor.
Your doctor will review your test results during your next appointment.
Your next appointment is scheduled for next week.
Your prescription is ready at the pharmacy.
Your prescription can be collected from the pharmacy counter.
Take your medicines on time as advised by your doctor.
Take your medicines with water after meals.
Do not stop your medicines without asking your doctor.
Do not skip your follow up appointment.
Do not ignore chest pain or difficulty in breathing.
Visit the emergency department if you have chest pain or difficulty in breathing.
Visit the emergency department if you have a high fever that does not go down.
Visit the outpatient clinic if you have a mild cough or cold.
Contact the hospital helpline if you need to reschedule your appointment.
Contact the reception desk if you need help finding a department.
Contact your doctor if your symptoms get worse.
Regular walking for thirty minutes every day is good for your health.
Quit smoking to reduce the risk of heart disease.
Reduce salt in your food to keep your blood pressure under control.
Check your blood pressure regularly to stay healthy.
Check your blood sugar regularly if you have diabetes.
Get enough rest and sleep to help your body recover.
Thank you for visiting our hospital and stay healthy.
Thank you for choosing our hospital for your care.
We wish you a speedy recovery and good health.
Our doctors and nurses are here to care for you.
Our team is here to help you at every step of your care.
Free health screening camps are held on the first saturday of every month.
Free health screening is available for senior citizens every week.`;

export function tokenizeSentences(text) {
  return text.toLowerCase().split(/[\n.!?]+/).map((s) => s.replace(/[^a-z0-9\s-]/g, ' ').trim().split(/\s+/).filter(Boolean)).filter((s) => s.length);
}

export function train(text) {
  const sents = tokenizeSentences(text);
  const bi = {}, tri = {};
  const add = (table, ctx, w) => { ((table[ctx] ||= {})[w] = (table[ctx][w] || 0) + 1); };
  const vocab = new Set();
  for (const s of sents) {
    const t = [START, START, ...s, END];
    s.forEach((w) => vocab.add(w));
    for (let i = 2; i < t.length; i++) {
      add(bi, t[i - 1], t[i]);
      add(tri, `${t[i - 2]} ${t[i - 1]}`, t[i]);
    }
  }
  return { bi, tri, vocab: [...vocab], sentences: sents.length, tokens: sents.reduce((a, s) => a + s.length, 0) };
}

const dist = (counts) => {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return Object.entries(counts).map(([word, c]) => ({ word, count: c, p: c / total })).sort((a, b) => b.p - a.p || a.word.localeCompare(b.word));
};

// model: 'bigram' uses 1 previous word, 'trigram' uses 2 (backs off to bigram if the context is unseen).
export function predict(lm, words, model = 'bigram') {
  const w = [START, START, ...words.map((x) => x.toLowerCase())];
  const last = w[w.length - 1], prev = w[w.length - 2];
  if (model === 'trigram') {
    const ctx = `${prev} ${last}`;
    if (lm.tri[ctx]) return { dist: dist(lm.tri[ctx]), ctx, backoff: false };
    if (lm.bi[last]) return { dist: dist(lm.bi[last]), ctx: last, backoff: true };
    return { dist: [], ctx, backoff: true };
  }
  return lm.bi[last] ? { dist: dist(lm.bi[last]), ctx: last, backoff: false } : { dist: [], ctx: last, backoff: false };
}

export function generate(lm, seed, model, { maxLen = 18, minLen = 6, temperature = 0.8, rnd = Math.random } = {}) {
  const words = seed.trim() ? seed.trim().toLowerCase().split(/\s+/) : [];
  const trace = [];
  while (words.length < maxLen) {
    const full = predict(lm, words, model);
    const backoff = full.backoff;
    // avoid stub messages: don't end the sentence too early if other words are possible
    const open = words.length < minLen ? full.dist.filter((x) => x.word !== END) : full.dist;
    const d = open.length ? open : full.dist;
    if (!d.length) break;
    let pick;
    if (temperature <= 0.01) pick = d[0];
    else {
      const wts = d.map((x) => x.p ** (1 / temperature));
      const sum = wts.reduce((a, b) => a + b, 0);
      let r = rnd() * sum;
      pick = d[d.length - 1];
      for (let i = 0; i < d.length; i++) { r -= wts[i]; if (r <= 0) { pick = d[i]; break; } }
    }
    trace.push({ word: pick.word, p: pick.p, options: d.length, backoff });
    if (pick.word === END) break;
    words.push(pick.word);
  }
  const text = words.join(' ');
  return { text: text.charAt(0).toUpperCase() + text.slice(1) + '.', trace };
}
