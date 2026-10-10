/*
 * Offline search engine for the fault manual (no network, no dependencies).
 * Works for English and Gujarati (any Unicode letters). Uses BM25 with:
 *  - tags weighted higher than body text
 *  - light English stemming
 *  - prefix matching for words of 3+ characters (handles Gujarati inflections)
 *  - a small synonym table so typed Gujarati/Hinglish/English words hit the same procedure
 */
(function (root) {
  const STOP = new Set([
    "the", "a", "an", "is", "are", "was", "of", "to", "in", "on", "it", "my", "and", "or", "with",
    "not", "no", "do", "does", "this", "that", "for", "at", "be", "by", "from", "i", "me",
    "છે", "છો", "શું", "અને", "અથવા", "માં", "પર", "નો", "ની", "નું", "ને", "થી", "છે.", "મને", "કે", "આ",
  ]);

  // Maps common fault words in several languages to a canonical English term.
  const SYNONYMS = {
    // not starting / no power
    "chalu": "start", "chalu nahi": "start", "start": "start", "શરૂ": "start", "ચાલુ": "start", "ચાલતો": "start",
    "બંધ": "stop", "power": "power", "વીજળી": "power", "લાઇટ": "power",
    // overheating
    "garam": "hot", "ગરમ": "hot", "ગરમી": "hot", "વધુ": "high", "તાપમાન": "temperature", "temperature": "temperature",
    "dhuvan": "smoke", "ધુમાડો": "smoke", "ધુવાડો": "smoke", "બળ": "burn", "બળે": "burn", "બળવાની": "burn", "burning": "burn",
    // pressure / flow
    "dabav": "pressure", "દબાણ": "pressure", "પ્રેશર": "pressure", "pressure": "pressure",
    "ઓછું": "low", "ઓછો": "low", "ઓછી": "low", "પાણી": "water", "water": "water", "flow": "flow",
    // vibration / noise
    "dhrujaaro": "vibration", "કંપન": "vibration", "ધ્રુજ": "vibration", "ધ્રુજારી": "vibration",
    "અવાજ": "noise", "ઘોંઘાટ": "noise", "avaaj": "noise", "noisy": "noise",
    // earth / leakage
    "લીકેજ": "leakage", "શોક": "shock", "ઝટકો": "shock", "ઝણઝણાટી": "shock", "અર્થ": "earth", "earthing": "earth",
    "ચકરાવો": "trip", "ટ્રિપ": "trip", "trip": "trip",
    // motor / pump
    "મોટર": "motor", "પંપ": "pump", "pump": "pump", "motor": "motor",
  };

  function normalize(s) {
    return String(s || "").normalize("NFC").toLowerCase();
  }

  function stem(tok) {
    // only for Latin words: very light suffix stripping
    if (!/^[a-z]+$/.test(tok) || tok.length <= 4) return tok;
    for (const suf of ["ing", "ed", "es", "s"]) {
      if (tok.endsWith(suf) && tok.length - suf.length >= 3) return tok.slice(0, -suf.length);
    }
    return tok;
  }

  function tokenize(text) {
    const norm = normalize(text);
    const raw = norm.split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
    const out = [];
    for (const t of raw) {
      if (STOP.has(t)) continue;
      out.push(stem(t));
      if (SYNONYMS[t] && SYNONYMS[t] !== t) out.push(SYNONYMS[t]);
    }
    // also expand multi-word phrases present in the synonym table
    for (const phrase of Object.keys(SYNONYMS)) {
      if (phrase.includes(" ") && norm.includes(phrase)) out.push(SYNONYMS[phrase]);
    }
    return out;
  }

  function docTerms(doc) {
    const tagTerms = tokenize((doc.tags || []).join(" "));
    const bodyTerms = tokenize([doc.title, doc.symptoms, (doc.steps || []).join(" ")].join(" "));
    return { tagTerms, bodyTerms };
  }

  class ManualIndex {
    constructor(data) {
      this.docs = (data && data.docs) || [];
      this.entries = this.docs.map((d) => {
        const { tagTerms, bodyTerms } = docTerms(d);
        const tf = new Map();
        for (const t of tagTerms) tf.set(t, (tf.get(t) || 0) + 3); // tags count 3x
        for (const t of bodyTerms) tf.set(t, (tf.get(t) || 0) + 1);
        let len = 0;
        for (const v of tf.values()) len += v;
        return { tf, len };
      });
      this.avgLen = this.entries.reduce((a, e) => a + e.len, 0) / Math.max(1, this.entries.length);
      this.df = new Map();
      for (const e of this.entries) for (const t of e.tf.keys()) this.df.set(t, (this.df.get(t) || 0) + 1);
    }

    // Find doc terms matching a query term exactly or by prefix (>=3 chars).
    _matches(q) {
      const out = [];
      for (const term of this.df.keys()) {
        if (term === q || (q.length >= 3 && term.length >= 3 && (term.startsWith(q) || q.startsWith(term)))) {
          out.push(term);
        }
      }
      return out;
    }

    search(query, { limit = 5, lang } = {}) {
      const qTerms = [...new Set(tokenize(query))];
      if (!qTerms.length || !this.docs.length) return [];
      const N = this.docs.length;
      const k1 = 1.4, b = 0.75;
      const scores = new Array(N).fill(0);
      const matched = Array.from({ length: N }, () => new Set());

      for (const q of qTerms) {
        const terms = this._matches(q);
        for (const term of terms) {
          const dfv = this.df.get(term);
          const idf = Math.log(1 + (N - dfv + 0.5) / (dfv + 0.5));
          this.entries.forEach((e, i) => {
            const f = e.tf.get(term);
            if (!f) return;
            const norm = f * (k1 + 1) / (f + k1 * (1 - b + b * e.len / this.avgLen));
            scores[i] += idf * norm;
            matched[i].add(q);
          });
        }
      }

      let results = this.docs.map((d, i) => ({ doc: d, score: scores[i], coverage: matched[i].size / qTerms.length }))
        .filter((r) => r.score > 0);
      // prefer documents that cover more of the query terms
      results.sort((a, b) => (b.coverage - a.coverage) || (b.score - a.score));
      if (lang) {
        const pref = results.filter((r) => r.doc.lang === lang || r.doc.lang === "auto");
        if (pref.length) results = pref;
      }
      // one result per section (best language variant wins)
      const seen = new Set();
      const unique = [];
      for (const r of results) {
        if (seen.has(r.doc.section)) continue;
        seen.add(r.doc.section);
        unique.push(r);
        if (unique.length >= limit) break;
      }
      const top = unique.length ? unique[0].score : 1;
      return unique.map((r) => ({ ...r, confidence: Math.min(1, r.score / top) * r.coverage }));
    }
  }

  const api = { ManualIndex, tokenize, SYNONYMS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.FaultSearch = api;
})(typeof self !== "undefined" ? self : globalThis);
