import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Dumbbell,
  Ellipsis,
  EyeOff,
  Plus,
  RefreshCw,
  Trash2
} from "lucide-react";
import { formatSuggestedPrescription } from "./workoutPlan";

export default function SuggestedWorkoutPlan({
  plan,
  existingExerciseNames,
  exerciseNames,
  formatDate,
  updateExercise,
  updateSet,
  addSet,
  removeSet,
  removeExercise,
  addExercise,
  acceptExercise,
  hidePlan,
  resetSuggestions,
  saving
}) {
  const [expandedIndex, setExpandedIndex] = useState(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const canLogExercise = (exercise) => {
    if (!exercise.name.trim()) return false;
    if (exercise.trackingType === "bodyweight") return exercise.sets.some((set) => set.reps);
    return exercise.sets.some((set) => set.reps && set.weight !== "");
  };

  useEffect(() => {
    if (expandedIndex !== null && expandedIndex >= plan.exercises.length) {
      setExpandedIndex(null);
    }
  }, [expandedIndex, plan.exercises.length]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;

    const closeOnOutsidePointer = (event) => {
      if (!menuRef.current?.contains(event.target)) setIsMenuOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMenuOpen]);

  function addSuggestionExercise() {
    const nextIndex = plan.exercises.length;
    addExercise();
    setExpandedIndex(nextIndex);
    setIsMenuOpen(false);
  }

  function resetPlan() {
    resetSuggestions();
    setExpandedIndex(null);
    setIsMenuOpen(false);
  }

  function hideSuggestions() {
    setIsMenuOpen(false);
    hidePlan();
  }

  function removeSuggestion(exerciseIndex) {
    removeExercise(exerciseIndex);
    setExpandedIndex(null);
  }

  return (
    <section className="panel-section suggested-plan">
      <header className="suggestion-header">
        <div>
          <span className="stage-label">Next session</span>
          <h2>{plan.title.replace("Suggested ", "").replace(" Day", " progression")}</h2>
          <p>
            {plan.sourceDate ? `Latest source ${formatDate(plan.sourceDate)}` : "Starting targets"}
            {" - "}{plan.exercises.length} movements
          </p>
        </div>
        <div className="suggestion-header-actions">
          <button
            type="button"
            className="icon-button"
            onClick={hideSuggestions}
            disabled={saving}
            aria-label="Hide suggestions"
            title="Hide suggestions"
          >
            <EyeOff size={17} />
          </button>
          <div className="suggestion-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="icon-button"
              onClick={() => setIsMenuOpen((open) => !open)}
              disabled={saving}
              aria-label="Suggestion options"
              aria-expanded={isMenuOpen}
              title="Suggestion options"
            >
              <Ellipsis size={18} />
            </button>
            {isMenuOpen ? (
              <div className="suggestion-menu" role="menu">
                <button type="button" role="menuitem" onClick={addSuggestionExercise}>
                  <Plus size={16} />Add exercise
                </button>
                <button type="button" role="menuitem" onClick={resetPlan}>
                  <RefreshCw size={16} />Reset suggestions
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <datalist id="suggested-exercise-options">
        {exerciseNames.map((name) => <option key={name} value={name} />)}
      </datalist>

      <div className="suggestion-ledger">
        {plan.exercises.map((exercise, exerciseIndex) => {
          const isExpanded = expandedIndex === exerciseIndex;
          const alreadyLogged = existingExerciseNames.has(exercise.name.toLowerCase());
          const previousSet = exercise.progression?.previousSet;
          const historyLabel = exercise.progression?.sourceDate && previousSet
            ? `Previous ${previousSet.weight}x${previousSet.reps} - ${formatDate(exercise.progression.sourceDate)}`
            : "Template starting point";

          return (
            <article
              className={`suggestion-row ${isExpanded ? "expanded" : ""} ${alreadyLogged ? "already-logged" : ""}`}
              key={exerciseIndex}
            >
              <button
                type="button"
                className="suggestion-summary"
                onClick={() => setExpandedIndex(isExpanded ? null : exerciseIndex)}
                aria-expanded={isExpanded}
              >
                <span className="suggestion-name">
                  <strong>{exercise.name || "New exercise"}</strong>
                  <small>{alreadyLogged ? `Logged today - ${historyLabel}` : historyLabel}</small>
                </span>
                <b className="suggestion-prescription">{formatSuggestedPrescription(exercise)}</b>
                <span className={`progression-tag ${exercise.progression?.kind || "baseline"}`}>
                  {exercise.progression?.label || "Baseline"}
                </span>
                <ChevronDown className="suggestion-chevron" size={17} aria-hidden="true" />
              </button>

              {isExpanded ? (
                <div className="suggestion-editor">
                  <div className="suggested-exercise-head">
                    <label>
                      Exercise
                      <input
                        value={exercise.name}
                        list="suggested-exercise-options"
                        placeholder="Exercise name"
                        onChange={(event) =>
                          updateExercise(exerciseIndex, { name: event.target.value })
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="danger icon-only"
                      onClick={() => removeSuggestion(exerciseIndex)}
                      disabled={plan.exercises.length === 1}
                      aria-label={`Remove ${exercise.name || "exercise"}`}
                      title={`Remove ${exercise.name || "exercise"}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="target-set-grid">
                    {exercise.sets.map((set, setIndex) => (
                      <div className="target-set-row" key={setIndex}>
                        <span>{setIndex + 1}</span>
                        <label>
                          Reps
                          <input
                            type="number"
                            min="1"
                            inputMode="numeric"
                            value={set.reps}
                            onChange={(event) =>
                              updateSet(exerciseIndex, setIndex, "reps", event.target.value)
                            }
                          />
                        </label>
                        {exercise.trackingType === "weighted" ? (
                          <label>
                            Lbs
                            <input
                              type="number"
                              min="0"
                              step="2.5"
                              inputMode="decimal"
                              value={set.weight}
                              onChange={(event) =>
                                updateSet(exerciseIndex, setIndex, "weight", event.target.value)
                              }
                            />
                          </label>
                        ) : null}
                        <button
                          type="button"
                          className="danger icon-only"
                          onClick={() => removeSet(exerciseIndex, setIndex)}
                          disabled={exercise.sets.length === 1}
                          aria-label={`Remove target set ${setIndex + 1} from ${exercise.name || "exercise"}`}
                          title={`Remove target set ${setIndex + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="secondary suggested-add-set"
                    onClick={() => addSet(exerciseIndex)}
                    disabled={saving}
                  >
                    <Plus size={16} />Add set
                  </button>

                  {exercise.note || alreadyLogged ? (
                    <p className="suggested-note">
                      {alreadyLogged
                        ? "Already logged today. Logging this will add another copy. "
                        : ""}
                      {exercise.note}
                    </p>
                  ) : null}

                  <div className="suggested-exercise-actions">
                    <button
                      type="button"
                      className="primary"
                      onClick={() => acceptExercise(exerciseIndex)}
                      disabled={saving || !canLogExercise(exercise)}
                    >
                      <Dumbbell size={17} />Log exercise
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeSuggestion(exerciseIndex)}
                      disabled={saving}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}
