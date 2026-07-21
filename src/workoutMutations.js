export function removeSetFromWorkouts(workouts, setId) {
  return workouts.map((workout) => ({
    ...workout,
    exercises: (workout.exercises || []).map((exercise) => ({
      ...exercise,
      exercise_sets: (exercise.exercise_sets || []).filter((set) => set.id !== setId)
    }))
  }));
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
