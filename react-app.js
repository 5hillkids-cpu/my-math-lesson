import React, { useEffect, useMemo, useState } from "./vendor/react.mjs";
import { createRoot } from "./vendor/react-dom-client.bundle.mjs";
import htm from "./vendor/htm.bundle.mjs";
import { lessonDecks, slideOrder } from "./lessons.js";

const html = htm.bind(React.createElement);
const STORAGE_KEY = "math-quest-react-state-v1";

function createDeckState(deck) {
  return {
    currentSlide: 0,
    answers: {
      warmup: {},
      story: {},
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
    fractionView: deck.id === "fractions" ? "circle" : "standard",
    helpOpen: false,
    currentStreak: 0,
    bestStreak: 0,
    levelBadges: 0,
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

function clampNumber(value, min, max, fallback) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback;
  }

  return Math.max(min, Math.min(value, max));
}

function normalizeDeckState(savedDeck, fallbackDeck, deck) {
  return {
    ...fallbackDeck,
    ...(savedDeck || {}),
    currentSlide: clampNumber(savedDeck?.currentSlide, 0, slideOrder.length - 1, fallbackDeck.currentSlide),
    answers: {
      warmup: {
        ...fallbackDeck.answers.warmup,
        ...(savedDeck?.answers?.warmup || {}),
      },
      story: {
        ...fallbackDeck.answers.story,
        ...(savedDeck?.answers?.story || {}),
      },
      team: {
        ...fallbackDeck.answers.team,
        ...(savedDeck?.answers?.team || {}),
      },
      independent: {
        ...fallbackDeck.answers.independent,
        ...(savedDeck?.answers?.independent || {}),
      },
    },
    feedback: {
      ...fallbackDeck.feedback,
      ...(savedDeck?.feedback || {}),
    },
    notes: {
      ...fallbackDeck.notes,
      ...(savedDeck?.notes || {}),
    },
    solved: Array.isArray(savedDeck?.solved) ? savedDeck.solved.filter((entry) => typeof entry === "string") : fallbackDeck.solved,
    bonusProblems: Array.isArray(savedDeck?.bonusProblems) ? savedDeck.bonusProblems.slice(0, 2) : fallbackDeck.bonusProblems,
    confidence: typeof savedDeck?.confidence === "string" ? savedDeck.confidence : fallbackDeck.confidence,
    stepKey: deck.powerup.strategyCopy[savedDeck?.stepKey] ? savedDeck.stepKey : fallbackDeck.stepKey,
    hintIndex: clampNumber(savedDeck?.hintIndex, 0, deck.boss.hints.length - 1, fallbackDeck.hintIndex),
    fractionView: savedDeck?.fractionView === "number-line" ? "number-line" : fallbackDeck.fractionView,
    helpOpen: Boolean(savedDeck?.helpOpen),
    currentStreak: clampNumber(savedDeck?.currentStreak, 0, 999, fallbackDeck.currentStreak),
    bestStreak: clampNumber(savedDeck?.bestStreak, 0, 999, fallbackDeck.bestStreak),
    levelBadges: clampNumber(savedDeck?.levelBadges, 0, 99, fallbackDeck.levelBadges),
    lastSavedAt: typeof savedDeck?.lastSavedAt === "number" ? savedDeck.lastSavedAt : fallbackDeck.lastSavedAt,
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
      merged.decks[deckId] = normalizeDeckState(parsed.decks?.[deckId], merged.decks[deckId], lessonDecks[deckId]);
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

function applySolvedAttempt(currentDeck, solvedKey, isCorrect) {
  const alreadySolved = currentDeck.solved.includes(solvedKey);
  let solved = currentDeck.solved;
  let currentStreak = currentDeck.currentStreak;
  let bestStreak = currentDeck.bestStreak;
  let levelBadges = currentDeck.levelBadges;

  if (isCorrect) {
    if (!alreadySolved) {
      solved = uniquePush(solved, solvedKey);
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
      if (currentStreak % 5 === 0) {
        levelBadges += 1;
      }
    }
  } else {
    solved = solved.filter((entry) => entry !== solvedKey);
    currentStreak = 0;
  }

  return {
    solved,
    currentStreak,
    bestStreak,
    levelBadges,
  };
}

function App() {
  const [appState, setAppState] = useState(loadState);
  const deck = lessonDecks[appState.activeDeckId];
  const deckState = appState.decks[deck.id];
  const usesPlaceValueGrid = deck.id === "decimals";
  const nextBadgeIn = deckState.currentStreak > 0 && deckState.currentStreak % 5 === 0
    ? 5
    : 5 - (deckState.currentStreak % 5 || 0);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    } catch {
      // Ignore storage failures so the app keeps rendering even in restricted browsers.
    }
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
      currentSlide: Math.max(0, Math.min(index, slideOrder.length - 1)),
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

  function toggleFractionView(view) {
    updateDeck((currentDeck) => ({
      ...currentDeck,
      fractionView: view,
    }));
  }

  function toggleHelp() {
    updateDeck((currentDeck) => ({
      ...currentDeck,
      helpOpen: !currentDeck.helpOpen,
    }));
  }

  function chooseStoryOperation(problem, operation) {
    updateDeck((currentDeck) => {
      const streakState = applySolvedAttempt(currentDeck, `story-${problem.id}`, operation === problem.operation);
      return {
        ...currentDeck,
        answers: {
          ...currentDeck.answers,
          story: {
            ...currentDeck.answers.story,
            [problem.id]: operation,
          },
        },
        ...streakState,
      };
    });
  }

  function checkWarmup(problem) {
    const actual = normalizeAnswer(deckState.answers.warmup[problem.id]);
    const expected = normalizeAnswer(problem.answer);

    updateDeck((currentDeck) => {
      const isCorrect = actual === expected;
      const streakState = actual ? applySolvedAttempt(currentDeck, `warmup-${problem.id}`, isCorrect) : currentDeck;
      return {
        ...currentDeck,
        ...(actual ? streakState : {}),
        feedback: {
          ...currentDeck.feedback,
          warmup: isCorrect
            ? { type: "success", text: `${problem.title} is correct. Progress updated.` }
            : { type: "error", text: actual ? "Not quite. Try using a stronger strategy and simplify if needed." : "Enter an answer first." },
        },
      };
    });
  }

  function gradeTeamWork() {
    updateDeck((currentDeck) => {
      let correctCount = 0;
      let solved = currentDeck.solved;
      let currentStreak = currentDeck.currentStreak;
      let bestStreak = currentDeck.bestStreak;
      let levelBadges = currentDeck.levelBadges;
      let hadIncorrectAttempt = false;

      deck.team.problems.forEach((problem) => {
        const actual = normalizeAnswer(currentDeck.answers.team[problem.id]);
        const expected = normalizeAnswer(problem.answer);
        const solvedKey = `team-${problem.id}`;

        if (actual && actual === expected) {
          correctCount += 1;
          if (!solved.includes(solvedKey)) {
            solved = uniquePush(solved, solvedKey);
            currentStreak += 1;
            bestStreak = Math.max(bestStreak, currentStreak);
            if (currentStreak % 5 === 0) {
              levelBadges += 1;
            }
          }
        } else if (actual) {
          hadIncorrectAttempt = true;
          solved = solved.filter((entry) => entry !== solvedKey);
        }
      });

      return {
        ...currentDeck,
        solved,
        currentStreak: hadIncorrectAttempt ? 0 : currentStreak,
        bestStreak,
        levelBadges,
        feedback: {
          ...currentDeck.feedback,
          team: {
            type: correctCount === deck.team.problems.length ? "success" : "",
            text: `${correctCount}/${deck.team.problems.length} team problems correct.`,
          },
        },
      };
    });
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
    updateDeck((currentDeck) => ({
      ...currentDeck,
      answers: {
        ...currentDeck.answers,
        independent: {
          ...currentDeck.answers.independent,
          [problemId]: value,
        },
      },
      ...applySolvedAttempt(currentDeck, `independent-${problemId}`, normalizeAnswer(value) === normalizeAnswer(expected)),
    }));
  }

  const progress = useMemo(() => {
    const noteCount = Object.values(deckState.notes).filter((value) => value.trim()).length;
    const confidenceCount = deckState.confidence ? 1 : 0;
    const storyCount = deck.powerup.storyProblems ? deck.powerup.storyProblems.length : 0;
    const totalCompleted = deckState.solved.length + noteCount + confidenceCount;
    const totalPossible = 16 + storyCount;
    const percent = Math.min(100, Math.round((totalCompleted / totalPossible) * 100));
    const levelsDone = Math.min(4, Math.round((percent / 100) * 4));
    return { percent, levelsDone };
  }, [deck, deckState]);

  const achievements = useMemo(() => ([
    { label: "⭐ Problem Solver", unlocked: deckState.solved.length >= 3 },
    { label: "🧠 Strategy Star", unlocked: !!deckState.confidence || Object.values(deckState.notes).some((value) => value.trim()) },
    { label: "✔️ Accuracy King", unlocked: deckState.solved.length >= 7 },
    { label: `🏅 Level Up x${deckState.levelBadges}`, unlocked: deckState.levelBadges > 0 },
  ]), [deckState]);

  const currentSlide = slideOrder[deckState.currentSlide];
  const isFirstSlide = deckState.currentSlide === 0;
  const isLastSlide = deckState.currentSlide === slideOrder.length - 1;
  const powerupMessage = deck.powerup.strategyCopy[deckState.stepKey];
  function answerClass(section, id, expected) {
    const value = deckState.answers[section]?.[id] || "";
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

        <section className="side-card picker-card">
          <p className="eyebrow">Step 1</p>
          <h2>Pick A Lesson</h2>
          <p className="picker-copy">Choose which lesson deck you want to open.</p>
          <div className="deck-switcher compact-switcher">
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
        </section>

        <section className="side-card lesson-parts-card">
          <p className="eyebrow">Step 2</p>
          <h2>Pick A Part</h2>
          <p className="picker-copy">Now choose a part of <strong>${deck.missionTheme}</strong>.</p>
          <nav className="slide-nav" aria-label="Lesson parts">
            ${slideOrder.map((slideId, index) => {
              const slideMeta = getSlideMeta(deck, slideId);
              return html`
                <button
                  type="button"
                  className=${`slide-link ${index === deckState.currentSlide ? "active" : ""}`}
                  onClick=${() => showSlide(index)}
                >
                  <span>${String(index + 1).padStart(2, "0")}</span>
                  <span className="slide-link-copy">
                    <strong>${slideMeta.label}</strong>
                    ${slideMeta.badge ? html`<em className="slide-feature-badge">${slideMeta.badge}</em>` : null}
                  </span>
                </button>
              `;
            })}
          </nav>
        </section>

        <section className="side-card mission-card">
          <p className="eyebrow">Current Lesson</p>
          <div className="mission-copy">
            <h2>${deck.missionTheme}</h2>
            <p>${deck.missionSummary}</p>
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
        </section>

        <section className="side-card level-up-card">
          <div className="card-row">
            <p className="eyebrow">Level Up</p>
            <strong>${deckState.currentStreak} streak</strong>
          </div>
          <p className="muted">Earn a badge for every 5 correct problems in a row.</p>
          <div className="badge-bank">
            ${deckState.levelBadges
              ? Array.from({ length: deckState.levelBadges }).map((_, index) => html`<span className="level-badge">🏅 Badge ${index + 1}</span>`)
              : html`<span className="level-badge pending">${nextBadgeIn} more for your first badge</span>`}
          </div>
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
          ${deck.introVisual
            ? html`<${IntroVisualCard} visual=${deck.introVisual} viewMode=${deckState.fractionView} onChangeView=${toggleFractionView} />`
            : null}
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
                  ${deck.helpTopic
                    ? html`
                        <button type="button" className="help-icon-button" onClick=${toggleHelp} aria-label="Explain factors and multiples">
                          ?
                        </button>
                      `
                    : null}
                </div>
                <div className="vocab-grid">
                  ${deck.vocabulary.map(([term, meaning]) => html`<div className="mini-tile"><strong>${term}</strong><span>${meaning}</span></div>`)}
                </div>
              </article>

              ${deck.helpTopic && deckState.helpOpen
                ? html`
                    <article className="quest-card help-card accent-blue">
                      <div className="card-heading">
                        <div className="badge-icon blue">💁</div>
                        <div>
                          <h3>${deck.helpTopic.title}</h3>
                        </div>
                      </div>
                      <div className="help-copy">
                        <p><strong>Factors:</strong> ${deck.helpTopic.factorCopy}</p>
                        <p><strong>Multiples:</strong> ${deck.helpTopic.multipleCopy}</p>
                        <p><strong>Example:</strong> ${deck.helpTopic.example}</p>
                      </div>
                    </article>
                  `
                : null}
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
                  ${usesPlaceValueGrid
                    ? html`<${PlaceValueInput}
                        className=${`answer-input place-value-input ${answerClass("warmup", problem.id, problem.answer)}`}
                        value=${deckState.answers.warmup[problem.id] || ""}
                        onInput=${(event) => changeAnswer("warmup", problem.id, event.target.value)}
                        placeholder="0.00"
                      />`
                    : html`<input
                        className=${`answer-input ${answerClass("warmup", problem.id, problem.answer)}`}
                        value=${deckState.answers.warmup[problem.id] || ""}
                        onInput=${(event) => changeAnswer("warmup", problem.id, event.target.value)}
                        placeholder="Enter your answer here..."
                      />`}
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

          ${deck.powerup.storyProblems && deck.powerup.storyProblems.length
            ? html`
              <article className="quest-card story-problems-card">
                <div className="card-heading">
                  <div className="badge-icon orange">📚</div>
                  <div>
                    <h3>Story Problems</h3>
                    <p>Read each situation and identify the operation you should use.</p>
                  </div>
                </div>
                <div className="story-grid">
                  ${deck.powerup.storyProblems.map((problem) => {
                    const selected = deckState.answers.story[problem.id] || "";
                    const isCorrect = selected === problem.operation;
                    return html`
                      <article className="story-card">
                        <p className="eyebrow">${problem.title}</p>
                        <p className="story-prompt">${problem.prompt}</p>
                        <div className="operation-row">
                          ${[
                            ["add", "Add"],
                            ["subtract", "Subtract"],
                            ["multiply", "Multiply"],
                            ["divide", "Divide"],
                          ].map(([value, label]) => html`
                            <button
                              type="button"
                              className=${`operation-button ${selected === value ? "selected" : ""} ${selected && selected === value && value === problem.operation ? "correct" : ""} ${selected && selected === value && value !== problem.operation ? "incorrect" : ""}`}
                              onClick=${() => chooseStoryOperation(problem, value)}
                            >
                              ${label}
                            </button>
                          `)}
                        </div>
                        ${selected
                          ? html`<p className=${`feedback-text ${isCorrect ? "success" : "error"}`}>${isCorrect ? `Correct. ${problem.why}` : `Try again. ${problem.why}`}</p>`
                          : html`<p className="feedback-text">Choose the operation that matches the story.</p>`}
                      </article>
                    `;
                  })}
                </div>
              </article>
            `
            : null}
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
                ${usesPlaceValueGrid
                  ? html`<${PlaceValueInput}
                      className=${`answer-input place-value-input ${answerClass("team", problem.id, problem.answer)}`}
                      value=${deckState.answers.team[problem.id] || ""}
                      onInput=${(event) => changeAnswer("team", problem.id, event.target.value)}
                      placeholder="0.00"
                    />`
                  : html`<input
                      className=${`answer-input ${answerClass("team", problem.id, problem.answer)}`}
                      value=${deckState.answers.team[problem.id] || ""}
                      onInput=${(event) => changeAnswer("team", problem.id, event.target.value)}
                      placeholder="Enter your answer here..."
                    />`}
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
                    ${usesPlaceValueGrid
                      ? html`<${PlaceValueInput}
                          compact=${true}
                          showGuides=${false}
                          className=${`mini-answer place-value-input ${normalizeAnswer(deckState.answers.independent[problem.id] || "") === normalizeAnswer(problem.answer) && deckState.answers.independent[problem.id] ? "success-glow" : deckState.answers.independent[problem.id] ? "error-glow" : ""}`}
                          value=${deckState.answers.independent[problem.id] || ""}
                          onInput=${(event) => handleIndependentAnswer(problem.id, problem.answer, event.target.value)}
                          placeholder="0.00"
                        />`
                      : html`<input
                          className=${`mini-answer ${normalizeAnswer(deckState.answers.independent[problem.id] || "") === normalizeAnswer(problem.answer) && deckState.answers.independent[problem.id] ? "success-glow" : deckState.answers.independent[problem.id] ? "error-glow" : ""}`}
                          value=${deckState.answers.independent[problem.id] || ""}
                          onInput=${(event) => handleIndependentAnswer(problem.id, problem.answer, event.target.value)}
                          placeholder="Answer"
                        />`}
                  </div>
                `)}
                ${!(deck.id === "decimals") ? html`<p className="completion-note">${level.note}</p>` : null}
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

          <article className="quest-card lesson-finish-card">
            <div className="card-heading">
              <div className="badge-icon gold">🧭</div>
              <div>
                <h3>Lesson Complete</h3>
                <p>Choose your next lesson from the left menu when you are ready to continue.</p>
              </div>
            </div>
          </article>
        </section>

        <footer className="stage-footer">
          <button type="button" className="nav-button" disabled=${isFirstSlide} onClick=${() => showSlide(deckState.currentSlide - 1)}>← Previous</button>
          <div className="dot-nav">
            ${slideOrder.map((slideId, index) => html`<button type="button" className=${index === deckState.currentSlide ? "active" : ""} onClick=${() => showSlide(index)} aria-label=${`Go to ${labelForSlide(slideId)}`}></button>`)}
          </div>
          <button type="button" className="nav-button primary" disabled=${isLastSlide} onClick=${() => showSlide(deckState.currentSlide + 1)}>${isLastSlide ? "Pick Next Lesson" : "Next →"}</button>
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

function PlaceValueInput({ value, onInput, placeholder, className = "", compact = false, showGuides = true }) {
  return html`
    <label className=${`place-value-wrap ${compact ? "compact" : ""}`}>
      ${showGuides
        ? html`
            <span className="place-value-guides" aria-hidden="true">
              <em>ones</em>
              <em>.</em>
              <em>tenths</em>
              <em>hundredths</em>
            </span>
          `
        : null}
      <input className=${className} value=${value} onInput=${onInput} placeholder=${placeholder} inputMode="decimal" />
    </label>
  `;
}

function getSlideMeta(deck, slideId) {
  const defaultLabel = labelForSlide(slideId);
  const supportsVisual = (deck.id === "fractions" || deck.id === "decimals") && slideId === "goal";
  const supportsStory = (deck.id === "fractions" || deck.id === "decimals") && slideId === "powerup";

  if (supportsVisual) {
    return { label: "Goal + Visual Model", badge: "Visual" };
  }

  if (supportsStory) {
    return { label: "Power-Up + Story Problems", badge: "Story" };
  }

  return { label: defaultLabel, badge: "" };
}

function IntroVisualCard({ visual, viewMode, onChangeView }) {
  return html`
    <article className="quest-card intro-visual-card">
      <div className="card-heading">
        <div className="badge-icon blue">🖼️</div>
        <div>
          <h3>${visual.title}</h3>
          <p>${visual.description}</p>
        </div>
        ${visual.type === "fraction-area"
          ? html`
              <div className="visual-toggle-group">
                <button type="button" className=${`visual-toggle ${viewMode === "circle" ? "active" : ""}`} onClick=${() => onChangeView("circle")}>Shaded Circle</button>
                <button type="button" className=${`visual-toggle ${viewMode === "number-line" ? "active" : ""}`} onClick=${() => onChangeView("number-line")}>Number Line</button>
              </div>
            `
          : null}
      </div>

      ${visual.type === "fraction-area"
        ? html`
            <div className="fraction-visual-row">
              ${visual.models.map((model) => html`
                <div className="visual-model-card">
                  <strong>${model.label}</strong>
                  ${viewMode === "number-line"
                    ? html`
                        <div className="number-line-track">
                          <span className="number-line-fill" style=${{ width: `${(model.filled / model.total) * 100}%` }}></span>
                          ${Array.from({ length: model.total + 1 }).map((_, index) => html`
                            <span className=${`number-line-tick ${index === model.filled ? "active" : ""}`} style=${{ left: `${(index / model.total) * 100}%` }}>
                              <em>${index === 0 ? "0" : index === model.total ? "1" : index === model.filled ? model.label : ""}</em>
                            </span>
                          `)}
                        </div>
                      `
                    : html`
                        <div className="fraction-circle" style=${{ background: `conic-gradient(#4d86ff 0 ${(model.filled / model.total) * 100}%, #e6f0ff ${(model.filled / model.total) * 100}% 100%)` }}>
                          <span>${model.label}</span>
                        </div>
                      `}
                  <p>${model.filled} of ${model.total} equal parts are shown.</p>
                </div>
              `)}
            </div>
          `
        : null}

      ${visual.type === "decimal-grid"
        ? html`
            <div className="decimal-visual-wrap">
              <div className="decimal-grid">
                ${Array.from({ length: 100 }).map((_, index) => html`
                  <span className=${index < visual.filled ? "filled" : ""}></span>
                `)}
              </div>
              <div className="visual-model-card compact-card">
                <strong>${visual.valueLabel}</strong>
                <p>${visual.filled} shaded squares out of 100 hundredths.</p>
              </div>
            </div>
          `
        : null}
    </article>
  `;
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    console.error(error);
  }

  resetApp() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage failures while resetting.
    }
    window.location.reload();
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return html`
      <main className="app-fallback-shell">
        <article className="quest-card app-fallback-card">
          <div className="card-heading">
            <div className="badge-icon red">⚠️</div>
            <div>
              <h3>We hit a loading problem</h3>
              <p>Your saved browser progress may be from an older lesson version.</p>
            </div>
          </div>
          <p>Press reset to clear the old saved state and reload the lesson.</p>
          <button type="button" className="cta-pill" onClick=${() => this.resetApp()}>Reset saved progress and reload</button>
        </article>
      </main>
    `;
  }
}

createRoot(document.getElementById("app")).render(html`<${AppErrorBoundary}><${App} /></${AppErrorBoundary}>`);