export function removeSetFromWorkouts(workouts, setId) {
  return workouts.map((workout) => ({
    ...workout,
    exercises: (workout.exercises || []).map((exercise) => ({
      ...exercise,
      exercise_sets: (exercise.exercise_sets || []).filter((set) => set.id !== setId)
    }))
  }));
}

export function upsertSetInWorkouts(workouts, workoutId, exercise, savedSet) {
  return workouts.map((workout) => {
    if (workout.id !== workoutId) return workout;
    const exercises = workout.exercises || [];
    const existingExercise = exercises.find((item) => item.id === exercise.id);
    if (!existingExercise) {
      return {
        ...workout,
        did_workout: true,
        exercises: [...exercises, { ...exercise, exercise_sets: [savedSet] }]
      };
    }

    return {
      ...workout,
      did_workout: true,
      exercises: exercises.map((item) => {
        if (item.id !== exercise.id) return item;
        const sets = item.exercise_sets || [];
        const hasSet = sets.some((set) => set.id === savedSet.id);
        return {
          ...item,
          ...exercise,
          exercise_sets: hasSet
            ? sets.map((set) => set.id === savedSet.id ? savedSet : set)
            : [...sets, savedSet]
        };
      })
    };
  });
}

export function removeSetFromPlan(plan, exerciseIndex, setIndex) {
  if (!plan) return plan;
  return {
    ...plan,
    exercises: (plan.exercises || []).map((exercise, index) => {
      if (index !== exerciseIndex) return exercise;
      if ((exercise.sets || []).length <= 1) return exercise;
      return {
        ...exercise,
        sets: exercise.sets.filter((_set, rowIndex) => rowIndex !== setIndex)
      };
    })
  };
}

export function addSetToPlan(plan, exerciseIndex) {
  if (!plan) return plan;
  return {
    ...plan,
    exercises: (plan.exercises || []).map((exercise, index) => {
      if (index !== exerciseIndex) return exercise;
      const sets = exercise.sets || [];
      const lastSet = sets.at(-1);
      const nextSet = lastSet ? { ...lastSet } : { reps: "", weight: "", duration: "" };
      return {
        ...exercise,
        sets: [...sets, nextSet]
      };
    })
  };
}
