export function removeSetFromWorkouts(workouts, setId) {
  return workouts.map((workout) => ({
    ...workout,
    exercises: (workout.exercises || []).map((exercise) => ({
      ...exercise,
      exercise_sets: (exercise.exercise_sets || []).filter((set) => set.id !== setId)
    }))
  }));
}
