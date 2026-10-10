import { useMemo, useState } from 'react';
import { train, predict, generate, DEFAULT_CORPUS, END } from '../lib/ngram.js';
import { Card, Explain, PageHeader, Stat } from '../components/ui.jsx';

const SEEDS = ['your appointment', 'please', 'regular', 'visit the emergency', 'drink plenty', 'the pharmacy'];

function Predictions({ title, model, lm, words }) {
  const r = predict(lm, words, model);
  const top = r.dist.slice(0, 5);
  return (
    <Card title={title} sub={model === 'bigram' ? 'Context: 1 previous word' : 'Context: 2 previous words'}>
      <div className="note" style={{ marginBottom: 8 }}>
        Context key: <span className="mono">{r.ctx || '(none)'}</span> {r.backoff && <span className="badge b-warn" style={{ marginLeft: 6 }}>backed off to bigram</span>}
      </div>
      {top.length ? top.map((d) => (
        <div key={d.word} style={{ marginBottom: 8 }}>
          <div className="row spread"><b>{d.word === END ? '⟨end of message⟩' : d.word}</b><span className="mono">{(d.p * 100).toFixed(0)}% · {d.count}×</span></div>
          <div className="bar"><i style={{ width: `${d.p * 100}%` }} /></div>
        </div>
      )) : <div className="muted">Unseen context: this word never appears in the corpus.</div>}
    </Card>
  );
}

export default function Messages() {
  const [corpus, setCorpus] = useState(DEFAULT_CORPUS);
  const [seed, setSeed] = useState('your appointment');
  const [temp, setTemp] = useState(0.7);
  const lm = useMemo(() => train(corpus), [corpus]);
  const make = (l, sd, t) => ({ bigram: generate(l, sd, 'bigram', { temperature: t }), trigram: generate(l, sd, 'trigram', { temperature: t }) });
  const [gen, setGen] = useState(() => make(train(DEFAULT_CORPUS), 'your appointment', 0));
  const words = seed.trim() ? seed.trim().toLowerCase().split(/\s+/) : [];
  const biCtx = Object.keys(lm.bi).length, triCtx = Object.keys(lm.tri).length;

  const run = () => setGen(make(lm, seed, temp));

  return (
    <div className="stack">
      <PageHeader title="Health Messages with µLM and SLM"
        desc="A Micro Language Model (bigram, one previous word) and a Small Language Model (trigram, two previous words) are trained on a healthcare corpus. Type a few words to see next-word predictions, then generate a short informational message."
        tags={['Bigram µLM', 'Trigram SLM', 'Next-word prediction', 'Text generation']} />

      <Card title="Start a message" sub="Type any words or pick a starter.">
        <div className="field"><input type="text" value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="e.g. your appointment" aria-label="Seed words" /></div>
        <div className="chips">{SEEDS.map((s) => <button key={s} className="chip" onClick={() => { setSeed(s); setGen(make(lm, s, temp)); }}>{s}</button>)}</div>
      </Card>

      <div className="grid g2">
        <Predictions title="µLM · Bigram next-word prediction" model="bigram" lm={lm} words={words} />
        <Predictions title="SLM · Trigram next-word prediction" model="trigram" lm={lm} words={words} />
      </div>

      <Card title="Generate and compare" sub="Both models start from the same words, so you can see what the extra context word buys."
        right={<div className="row"><span className="note">Creativity {temp === 0 ? '0 (most likely word)' : temp}</span>
          <input type="range" min={0} max={1.5} step={0.1} value={temp} onChange={(e) => setTemp(Number(e.target.value))} aria-label="Creativity (temperature)" style={{ width: 140 }} />
          <button className="btn primary" onClick={run}>Generate</button></div>}>
        <div className="grid g2">
          {[['bigram', 'µLM (bigram)'], ['trigram', 'SLM (trigram)']].map(([m, name]) => (
            <div key={m}>
              <div className="lbl" style={{ marginBottom: 6 }}>{name}</div>
              <div className="msg-out">{gen ? gen[m].text : <span className="muted" style={{ fontWeight: 400, fontSize: 15 }}>Press Generate.</span>}</div>
              {gen && (
                <div className="chips" style={{ marginTop: 8 }}>
                  {gen[m].trace.filter((t) => t.word !== END).map((t, i) => (
                    <span key={i} className="tag" style={{ opacity: 0.45 + t.p * 0.55 }} title={`${t.options} possible next words`}>{t.word} {(t.p * 100).toFixed(0)}%{t.backoff ? ' ↩' : ''}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </Card>

      <div className="grid g-main">
        <Card title="Training corpus" sub="Edit freely: both models retrain instantly. One sentence per line.">
          <textarea className="input" rows={10} value={corpus} onChange={(e) => setCorpus(e.target.value)} aria-label="Training corpus" />
        </Card>
        <Card title="Model statistics">
          <div className="grid g2" style={{ gap: 10, marginBottom: 12 }}>
            <Stat k="Sentences" v={lm.sentences} /><Stat k="Vocabulary" v={lm.vocab.length} />
            <Stat k="Bigram contexts" v={biCtx} /><Stat k="Trigram contexts" v={triCtx} />
          </div>
          <Explain>Bigram: P(w<sub>n</sub> | w<sub>n−1</sub>) = count(w<sub>n−1</sub>, w<sub>n</sub>) / count(w<sub>n−1</sub>). Trigram conditions on two words, so output is more coherent but needs more data; unseen contexts back off to the bigram (↩). Sentence boundaries are modelled with start and end markers.</Explain>
        </Card>
      </div>
    </div>
  );
}
