import React, { useEffect, useMemo, useState } from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client";
import htm from "https://esm.sh/htm@3.1.1?external=react";
import { lessonDecks, slideOrder } from "./lessons.js";

const html = htm.bind(React.createElement);
const STORAGE_KEY = "math-quest-react-state-v1";

function createDeckState(deck) {
  return {
    currentSlide: 0,
    answers: {
      warmup: {},
      team: {},
      independent: {},
    },
    solved: [],
    feedback: {
      warmup: { type: "", text: "Solve the problems and press Check to earn progress." },
      team: { type: "", text: "Complete each answer, then check your team work." },
    },
    notes: {
      workspace: "",
      thinking: "",
      boss: "",
    },
    confidence: "",
    bonusProblems: [],
    stepKey: "step-1",
    hintIndex: 0,
    lastSavedAt: Date.now(),
  };
}

function createInitialState() {
  return {
    activeDeckId: "fractions",
    decks: Object.fromEntries(
      Object.values(lessonDecks).map((deck) => [deck.id, createDeckState(deck)]),
    ),
  };
}

function loadState() {
  const fallback = createInitialState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const merged = createInitialState();
    merged.activeDeckId = parsed.activeDeckId && lessonDecks[parsed.activeDeckId] ? parsed.activeDeckId : fallback.activeDeckId;

    Object.keys(lessonDecks).forEach((deckId) => {
      merged.decks[deckId] = {
        ...merged.decks[deckId],
        ...(parsed.decks?.[deckId] || {}),
        feedback: {
          ...merged.decks[deckId].feedback,
          ...(parsed.decks?.[deckId]?.feedback || {}),
        },
        notes: {
          ...merged.decks[deckId].notes,
          ...(parsed.decks?.[deckId]?.notes || {}),
        },
      };
    });

    return merged;
  } catch {
    return fallback;
  }
}

function normalizeAnswer(value) {
  return String(value || "").replace(/\s+/g, "").toLowerCase();
}

function uniquePush(list, value) {
  return list.includes(value) ? list : [...list, value];
}

function App() {
  const [appState, setAppState] = useState(loadState);
  const deck = lessonDecks[appState.activeDeckId];
  const deckState = appState.decks[deck.id];

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
  }, [appState]);

  function updateDeck(mutator) {
    setAppState((current) => {
      const currentDeck = current.decks[current.activeDeckId];
      const updatedDeck = {
        ...mutator(currentDeck),
        lastSavedAt: Date.now(),
      };

      return {
        ...current,
        decks: {
          ...current.decks,
          [current.activeDeckId]: updatedDeck,
        },
      };
    });
  }

  function switchDeck(deckId) {
    setAppState((current) => ({
      ...current,
      activeDeckId: deckId,
    }));
  }

  function showSlide(index) {
    updateDeck((currentDeck) => ({
      ...currentDeck,
      currentSlide: (index + slideOrder.length) % slideOrder.length,
    }));
  }

  function changeAnswer(section, id, value) {
    updateDeck((currentDeck) => ({
      ...currentDeck,
      answers: {
        ...currentDeck.answers,
        [section]: {
          ...currentDeck.answers[section],
          [id]: value,
        },
      },
    }));
  }

  function checkWarmup(problem) {
    const actual = normalizeAnswer(deckState.answers.warmup[problem.id]);
    const expected = normalizeAnswer(problem.answer);

    updateDeck((currentDeck) => ({
      ...currentDeck,
      solved: actual === expected ? uniquePush(currentDeck.solved, `warmup-${problem.id}`) : currentDeck.solved,
      feedback: {
        ...currentDeck.feedback,
        warmup: actual === expected
          ? { type: "success", text: `${problem.title} is correct. Progress updated.` }
          : { type: "error", text: actual ? "Not quite. Try using a stronger strategy and simplify if needed." : "Enter an answer first." },
      },
    }));
  }

  function gradeTeamWork() {
    let correctCount = 0;
    let nextSolved = deckState.solved;

    deck.team.problems.forEach((problem) => {
      const actual = normalizeAnswer(deckState.answers.team[problem.id]);
      const expected = normalizeAnswer(problem.answer);
      if (actual && actual === expected) {
        correctCount += 1;
        nextSolved = uniquePush(nextSolved, `team-${problem.id}`);
      }
    });

    updateDeck((currentDeck) => ({
      ...currentDeck,
      solved: nextSolved,
      feedback: {
        ...currentDeck.feedback,
        team: {
          type: correctCount === deck.team.problems.length ? "success" : "",
          text: `${correctCount}/${deck.team.problems.length} team problems correct.`,
        },
      },
    }));
  }

  function updateNote(field, value) {
    updateDeck((currentDeck) => ({
      ...currentDeck,
      notes: {
        ...currentDeck.notes,
        [field]: value,
      },
    }));
  }

  function setConfidence(level) {
    updateDeck((currentDeck) => ({
      ...currentDeck,
      confidence: level,
    }));
  }

  function setStep(stepKey) {
    updateDeck((currentDeck) => ({
      ...currentDeck,
      stepKey,
    }));
  }

  function generateBonusProblems() {
    const shuffled = [...deck.warmup.bonusBank].sort(() => Math.random() - 0.5).slice(0, 2);
    updateDeck((currentDeck) => ({
      ...currentDeck,
      bonusProblems: shuffled,
      solved: uniquePush(currentDeck.solved, "bonus-generated"),
    }));
  }

  function rotateHint() {
    updateDeck((currentDeck) => ({
      ...currentDeck,
      hintIndex: (currentDeck.hintIndex + 1) % deck.boss.hints.length,
    }));
  }

  function handleIndependentAnswer(problemId, expected, value) {
    const nextSolved = normalizeAnswer(value) === normalizeAnswer(expected)
      ? uniquePush(deckState.solved, `independent-${problemId}`)
      : deckState.solved.filter((entry) => entry !== `independent-${problemId}`);

    updateDeck((currentDeck) => ({
      ...currentDeck,
      answers: {
        ...currentDeck.answers,
        independent: {
          ...currentDeck.answers.independent,
          [problemId]: value,
        },
      },
      solved: nextSolved,
    }));
  }

  const progress = useMemo(() => {
    const noteCount = Object.values(deckState.notes).filter((value) => value.trim()).length;
    const confidenceCount = deckState.confidence ? 1 : 0;
    const totalCompleted = deckState.solved.length + noteCount + confidenceCount;
    const totalPossible = 16;
    const percent = Math.min(100, Math.round((totalCompleted / totalPossible) * 100));
    const levelsDone = Math.min(4, Math.round((percent / 100) * 4));
    return { percent, levelsDone };
  }, [deckState]);

  const achievements = useMemo(() => ([
    { label: "⭐ Problem Solver", unlocked: deckState.solved.length >= 3 },
    { label: "🧠 Strategy Star", unlocked: !!deckState.confidence || Object.values(deckState.notes).some((value) => value.trim()) },
    { label: "✔️ Accuracy King", unlocked: deckState.solved.length >= 7 },
  ]), [deckState]);

  const currentSlide = slideOrder[deckState.currentSlide];
  const powerupMessage = deck.powerup.strategyCopy[deckState.stepKey];
  const lastSaved = new Date(deckState.lastSavedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  function answerClass(section, id, expected) {
    const value = deckState.answers[section][id] || "";
    if (!value) {
      return "";
    }
    return normalizeAnswer(value) === normalizeAnswer(expected) ? "success-glow" : "error-glow";
  }

  return html`
    <div className="app-shell">
      <aside className="side-rail">
        <div className="brand-mark">
          <span className="brand-icon">${deck.icon}</span>
          <div>
            <h1>Math Quest</h1>
          </div>
        </div>

        <nav className="slide-nav" aria-label="Lesson pages">
          ${slideOrder.map((slideId, index) => html`
            <button
              type="button"
              className=${`slide-link ${index === deckState.currentSlide ? "active" : ""}`}
              onClick=${() => showSlide(index)}
            >
              <span>${String(index + 1).padStart(2, "0")}</span>
              <strong>${labelForSlide(slideId)}</strong>
            </button>
          `)}
        </nav>

        <section className="side-card mission-card">
          <p className="eyebrow">Mission Theme</p>
          <div className="mission-copy">
            <h2>${deck.missionTheme}</h2>
            <p>${deck.missionSummary}</p>
          </div>
          <div className="deck-switcher">
            ${Object.values(lessonDecks).map((item) => html`
              <button
                type="button"
                className=${`deck-button ${item.id === deck.id ? "active" : ""}`}
                onClick=${() => switchDeck(item.id)}
              >
                <strong>${item.icon} ${item.missionTheme}</strong>
                <span>${item.topbarSubtitle}</span>
              </button>
            `)}
          </div>
          <p className="question-bank-note">3 lesson decks with separate question banks and saved progress.</p>
        </section>

        <section className="side-card progress-card">
          <div className="card-row">
            <p className="eyebrow">Quest Progress</p>
            <strong>${progress.percent}%</strong>
          </div>
          <div className="progress-track compact">
            <div className="progress-fill" style=${{ width: `${progress.percent}%` }}></div>
          </div>
          <p className="muted">Interactive answers, confidence checks, and achievements update live.</p>
          <div className="saved-pill">Saved locally at ${lastSaved}</div>
        </section>
      </aside>

      <main className="main-stage">
        <header className="topbar">
          <div className="topbar-brand">
            <div className="badge-icon blue">${deck.icon}</div>
            <div>
              <h2>${deck.title}</h2>
              <p>${deck.topbarSubtitle}</p>
            </div>
          </div>
        </header>

        <section className=${`slide-panel ${currentSlide === "landing" ? "active" : ""} theme-blue`}>
          <div className="hero-page">
            <div className="hero-stars" aria-hidden="true">
              <span>⭐</span>
              <span>✨</span>
              <span>⭐</span>
              <span>✦</span>
            </div>
            <div className="hero-content">
              <div className="hero-title-wrap">
                <div className="hero-logo">${deck.icon}</div>
                <h3>${deck.title}</h3>
              </div>
              <p className="hero-deck-tag">${deck.missionTheme}</p>
              <p className="hero-subtitle">${deck.heroSubtitle}</p>
              <div className="hero-actions">
                ${deck.heroModes.map((mode, index) => html`<button type="button" className=${`mode-card ${["red", "gold", "green", "purple"][index % 4]}`}>${mode}</button>`)}
              </div>
              <button type="button" className="cta-pill" onClick=${() => showSlide(1)}>🔎 ${deck.heroCta}</button>
              <p className="hero-motto">✅ Solve it. Show it. Celebrate it! 🏆</p>
            </div>
          </div>
        </section>

        <section className=${`slide-panel ${currentSlide === "goal" ? "active" : ""} theme-green`}>
          <div className="page-grid two-up">
            <article className="quest-card large">
              <div className="card-heading">
                <div className="badge-icon green">🎯</div>
                <div>
                  <h3>Today’s Goal</h3>
                </div>
              </div>
              <div className="highlight-block success">
                <p>${deck.goal}</p>
              </div>
              <div className="sub-panel">
                <h4>Success Criteria</h4>
                <ul className="check-list">
                  ${deck.successCriteria.map((item) => html`<li>${item}</li>`)}
                </ul>
              </div>
            </article>

            <div className="stack">
              <article className="quest-card">
                <div className="card-heading">
                  <div className="badge-icon gold">📒</div>
                  <div>
                    <h3>Key Vocabulary</h3>
                  </div>
                </div>
                <div className="vocab-grid">
                  ${deck.vocabulary.map(([term, meaning]) => html`<div className="mini-tile"><strong>${term}</strong><span>${meaning}</span></div>`)}
                </div>
              </article>
            </div>
          </div>
          <div className="floating-toast green">⭐ You’re doing great! Keep up the good work!</div>
        </section>

        <section className=${`slide-panel ${currentSlide === "warmup" ? "active" : ""} theme-gold`}>
          <article className="banner-card">
            <div className="card-heading">
              <div className="badge-icon gold">⚡</div>
              <div>
                <h3>Warm-Up Challenge</h3>
              </div>
            </div>
          </article>

          <div className="three-grid">
            ${deck.warmup.problems.map((problem) => html`
              <article className="quest-card problem-card">
                <div className="problem-label">${problem.label}</div>
                <h4>${problem.title}</h4>
                <div className="problem-box">${problem.prompt}</div>
                <div className="answer-row">
                  <input
                    className=${`answer-input ${answerClass("warmup", problem.id, problem.answer)}`}
                    value=${deckState.answers.warmup[problem.id] || ""}
                    onInput=${(event) => changeAnswer("warmup", problem.id, event.target.value)}
                    placeholder="Enter your answer here..."
                  />
                  <button type="button" className="check-answer" onClick=${() => checkWarmup(problem)}>Check</button>
                </div>
              </article>
            `)}
          </div>

          <div className="two-up lower-grid">
            <article className="quest-card accent-green">
              <div className="card-heading">
                <div className="badge-icon green">💡</div>
                <div>
                  <h3>Quick Tip</h3>
                </div>
              </div>
              <p>${deck.warmup.tip}</p>
            </article>

            <article className="quest-card accent-blue">
              <div className="card-heading">
                <div className="badge-icon blue">🚀</div>
                <div>
                  <h3>Finisher Challenge</h3>
                </div>
              </div>
              <div className="chip-row">
                <button type="button" className="chip action-chip" onClick=${generateBonusProblems}>⭐ Bonus: Create 2 more problems</button>
                <button
                  type="button"
                  className="chip action-chip"
                  onClick=${() => updateDeck((currentDeck) => ({
                    ...currentDeck,
                    feedback: {
                      ...currentDeck.feedback,
                      warmup: { type: "", text: "Check each answer for simplified answers, units, or matching place values." },
                    },
                  }))}
                >
                  ✔️ Check your work
                </button>
              </div>
              ${deckState.bonusProblems.length
                ? html`<div className="bonus-list"><strong>Bonus Problems:</strong><br />${deckState.bonusProblems.map((problem, index) => html`<span>${index + 1}. ${problem}<br /></span>`)}</div>`
                : html`<div className="empty-state">Generate bonus problems from this deck’s question bank.</div>`}
              <p className=${`feedback-text ${deckState.feedback.warmup.type}`}>${deckState.feedback.warmup.text}</p>
            </article>
          </div>
        </section>

        <section className=${`slide-panel ${currentSlide === "powerup" ? "active" : ""} theme-blue`}>
          <article className="banner-card">
            <div className="card-heading">
              <div className="badge-icon blue">⚡</div>
              <div>
                <h3>${deck.powerup.title}</h3>
                <p>${deck.powerup.subtitle}</p>
              </div>
            </div>
            <div className="timer-pill">⭐ Strategy Focus</div>
          </article>

          <div className="page-grid two-up">
            <article className="quest-card large">
              <div className="card-heading">
                <div className="badge-icon blue">🧮</div>
                <div>
                  <h3>Example Problem</h3>
                </div>
              </div>
              <div className="problem-box dashed">${deck.powerup.exampleProblem}</div>
              <div className="step-tabs">
                ${Object.keys(deck.powerup.strategyCopy).map((stepKey, index) => html`
                  <button type="button" className=${`step-tab ${deckState.stepKey === stepKey ? "active" : ""}`} onClick=${() => setStep(stepKey)}>
                    Step ${index + 1}<br />
                    <span>${deck.powerup.strategyCopy[stepKey].split(":")[0]}</span>
                  </button>
                `)}
              </div>
              <div className="visual-model">
                <p><strong>${powerupMessage.split(":")[0]}:</strong>${powerupMessage.split(":").slice(1).join(":")}</p>
              </div>
            </article>

            <article className="quest-card accent-green">
              <div className="card-heading">
                <div className="badge-icon green">🧩</div>
                <div>
                  <h3>Strategy Steps</h3>
                </div>
              </div>
              <div className="strategy-list">
                ${deck.powerup.strategySteps.map((item, index) => html`<div className="strategy-item"><span>${index + 1}</span><p><strong>${item.split(":")[0]}:</strong>${item.includes(":") ? item.split(":").slice(1).join(":") : item}</p></div>`)}
              </div>
            </article>
          </div>
        </section>

        <section className=${`slide-panel ${currentSlide === "team" ? "active" : ""} theme-green`}>
          <article className="banner-card">
            <div className="card-heading">
              <div className="badge-icon green">👥</div>
              <div>
                <h3>${deck.team.title}</h3>
                <p>${deck.team.subtitle}</p>
              </div>
            </div>
            <div className="timer-pill">🤝 Partner/Team Activity</div>
          </article>

          <div className="two-by-two">
            ${deck.team.problems.map((problem) => html`
              <article className="quest-card problem-card">
                <div className="problem-label green">${problem.label}</div>
                <h4>${problem.title}</h4>
                <div className="problem-box light-green">${problem.prompt}</div>
                <input
                  className=${`answer-input ${answerClass("team", problem.id, problem.answer)}`}
                  value=${deckState.answers.team[problem.id] || ""}
                  onInput=${(event) => changeAnswer("team", problem.id, event.target.value)}
                  placeholder="Enter your answer here..."
                />
              </article>
            `)}
          </div>
          <div className="footer-actions">
            <button type="button" className="cta-secondary" onClick=${gradeTeamWork}>Check Team Work</button>
            <p className=${`feedback-text ${deckState.feedback.team.type}`}>${deckState.feedback.team.text}</p>
          </div>
        </section>

        <section className=${`slide-panel ${currentSlide === "final-check" ? "active" : ""} theme-sky`}>
          <article className="banner-card">
            <div className="card-heading">
              <div className="badge-icon blue">🏁</div>
              <div>
                <h3>Final Check</h3>
                <p>One last problem to show what you know.</p>
              </div>
            </div>
          </article>

          <div className="page-grid two-up final-grid">
            <article className="quest-card large">
              <div className="card-heading">
                <div className="badge-icon blue">❔</div>
                <div>
                  <h3>Key Question</h3>
                </div>
              </div>
              <div className="scenario-box">
                <p><strong>Solve:</strong> ${deck.finalCheck.question}</p>
              </div>
              <label className="workspace-box">
                <span>✏️ Work Space - Show your strategy here</span>
                <textarea value=${deckState.notes.workspace} onInput=${(event) => updateNote("workspace", event.target.value)} placeholder="Number line, area model, or calculation steps"></textarea>
              </label>
            </article>

            <div className="stack">
              <article className="quest-card accent-green">
                <div className="card-heading">
                  <div className="badge-icon green">🙂</div>
                  <div>
                    <h3>Confidence Check</h3>
                  </div>
                </div>
                <div className="confidence-list">
                  ${[
                    ["high", "🤩 I got it!", "I can solve this confidently"],
                    ["medium", "🙂 I'm close", "I need a little help"],
                    ["low", "😅 I need help", "I'm not sure where to start"],
                  ].map(([level, label, note]) => html`
                    <button type="button" className=${`confidence-option ${deckState.confidence === level ? "selected" : ""}`} onClick=${() => setConfidence(level)}>${label}<span>${note}</span></button>
                  `)}
                </div>
              </article>

              <article className="quest-card accent-orange">
                <div className="card-heading">
                  <div className="badge-icon orange">💬</div>
                  <div>
                    <h3>Explain Your Thinking</h3>
                  </div>
                </div>
                <textarea value=${deckState.notes.thinking} onInput=${(event) => updateNote("thinking", event.target.value)} placeholder="Write how you solved the problem and why your strategy worked."></textarea>
              </article>
            </div>
          </div>
        </section>

        <section className=${`slide-panel ${currentSlide === "boss" ? "active" : ""} theme-red`}>
          <article className="banner-card danger">
            <div className="card-heading">
              <div className="badge-icon red">⚡</div>
              <div>
                <h3>${deck.boss.title}</h3>
                <p>${deck.boss.subtitle}</p>
              </div>
            </div>
            <div className="timer-pill outlined">🐉 Boss Level</div>
          </article>

          <div className="page-grid boss-layout">
            <article className="quest-card large accent-red">
              <div className="card-heading">
                <div className="badge-icon red">🧮</div>
                <div>
                  <h3>Featured Word Problem</h3>
                </div>
              </div>
              <div className="scenario-box rosy">
                <p><strong>Scenario:</strong> ${deck.boss.scenario}</p>
              </div>
              <div className="plan-grid">
                ${[
                  ["Understand", "What is being asked? What do I know?"],
                  ["Plan", "What strategy should I use? Draw a diagram?"],
                  ["Solve", "Show your work step by step."],
                  ["Check", "Does my answer make sense?"],
                ].map(([title, copy]) => html`<div className="plan-tile"><strong>${title}</strong><span>${copy}</span></div>`)}
              </div>
              <label className="workspace-box dashed-light">
                <span>✏️ Work Space - Show your strategy here</span>
                <textarea value=${deckState.notes.boss} onInput=${(event) => updateNote("boss", event.target.value)} placeholder="Number line, bar model, or area model"></textarea>
              </label>
            </article>

            <div className="stack">
              <article className="quest-card accent-orange">
                <div className="card-heading">
                  <div className="badge-icon orange">💡</div>
                  <div>
                    <h3>Power-Up Hint</h3>
                  </div>
                </div>
                <p>${deck.boss.hints[deckState.hintIndex]}</p>
                <button type="button" className="cta-secondary" onClick=${rotateHint}>Reveal Hint</button>
              </article>

              <article className="quest-card accent-blue">
                <div className="card-heading">
                  <div className="badge-icon blue">🛠️</div>
                  <div>
                    <h3>Problem-Solving Strategies</h3>
                  </div>
                </div>
                <div className="strategy-pills">
                  ${deck.boss.strategies.map((item) => html`<span className="strategy-pill">${item}</span>`)}
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className=${`slide-panel ${currentSlide === "independent" ? "active" : ""} theme-lilac`}>
          <article className="banner-card">
            <div className="card-heading">
              <div className="badge-icon purple">${deck.icon}</div>
              <div>
                <h3>On Your Own</h3>
                <p>Complete these problems independently. You’ve got this!</p>
              </div>
            </div>
            <div className="timer-pill">⭐ Self-Check</div>
          </article>

          <div className="three-grid levels-grid">
            ${deck.independent.levels.map((level) => html`
              <article className=${`quest-card accent-${level.accent} level-card`}>
                <div className="card-heading compact-heading">
                  <div className=${`badge-icon ${level.accent}`}>${level.accent === "green" ? "🌱" : level.accent === "gold" ? "⚡" : "🏆"}</div>
                  <div>
                    <h3>${level.title}</h3>
                  </div>
                  <span className=${`difficulty ${level.difficulty.toLowerCase()}`}>${level.difficulty}</span>
                </div>
                ${level.problems.map((problem) => html`
                  <div className="mini-problem">
                    <span>${problem.number}</span>
                    <p>${problem.prompt}</p>
                    <input
                      className=${`mini-answer ${normalizeAnswer(deckState.answers.independent[problem.id] || "") === normalizeAnswer(problem.answer) && deckState.answers.independent[problem.id] ? "success-glow" : deckState.answers.independent[problem.id] ? "error-glow" : ""}`}
                      value=${deckState.answers.independent[problem.id] || ""}
                      onInput=${(event) => handleIndependentAnswer(problem.id, problem.answer, event.target.value)}
                      placeholder="Answer"
                    />
                  </div>
                `)}
                <p className="completion-note">${level.note}</p>
              </article>
            `)}
          </div>

          <div className="two-up lower-grid">
            <article className="quest-card accent-blue">
              <div className="card-heading">
                <div className="badge-icon blue">📈</div>
                <div>
                  <h3>Progress Tracker</h3>
                </div>
              </div>
              <div className="progress-track big">
                <div className="progress-fill" style=${{ width: `${progress.percent}%` }}></div>
              </div>
              <div className="progress-copy">
                <span>${progress.percent}% Complete</span>
                <span>${progress.levelsDone}/4 levels done</span>
              </div>
            </article>

            <article className="quest-card accent-orange">
              <div className="card-heading">
                <div className="badge-icon orange">🏅</div>
                <div>
                  <h3>Achievements</h3>
                </div>
              </div>
              <div className="chip-row">
                ${achievements.map((achievement) => html`<span className=${`chip achievement ${achievement.unlocked ? "unlocked" : "locked"}`}>${achievement.label}</span>`)}
              </div>
            </article>
          </div>
        </section>

        <footer className="stage-footer">
          <button type="button" className="nav-button" onClick=${() => showSlide(deckState.currentSlide - 1)}>← Previous</button>
          <div className="dot-nav">
            ${slideOrder.map((slideId, index) => html`<button type="button" className=${index === deckState.currentSlide ? "active" : ""} onClick=${() => showSlide(index)} aria-label=${`Go to ${labelForSlide(slideId)}`}></button>`)}
          </div>
          <button type="button" className="nav-button primary" onClick=${() => showSlide(deckState.currentSlide + 1)}>Next →</button>
        </footer>
      </main>
    </div>
  `;
}

function labelForSlide(slideId) {
  const labels = {
    landing: "Launch",
    goal: "Goal",
    warmup: "Warm-Up",
    powerup: "Power-Up",
    team: "Team Solve",
    "final-check": "Final Check",
    boss: "Boss Battle",
    independent: "On Your Own",
  };

  return labels[slideId];
}

createRoot(document.getElementById("app")).render(html`<${App} />`);