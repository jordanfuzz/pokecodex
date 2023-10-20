export const checkIfUserHasCompletedRecord = (mon, neededRules) => {
  const newRules = neededRules.filter(rule => mon.sources.includes(rule))
  let userHasCompletedRecord = false

  if (!newRules.length) {
    // if a user has any pokemon at all
    if (mon.usersSources[0]) userHasCompletedRecord = true
  } else userHasCompletedRecord = newRules.every(rule => mon.usersSources.includes(rule))

  return userHasCompletedRecord
}

export const getUsersSourcesByGen = mon => {
  let usersSourcesByGen = {
    all: [],
  }

  const userHasNoSources =
    !mon.usersSourcesByGen || !mon.usersSourcesByGen.length || !mon.usersSourcesByGen[0]

  if (userHasNoSources) {
    usersSourcesByGen = null
  } else {
    mon.usersSourcesByGen.forEach(source => {
      const { source: sourceType, name, gen } = source
      if (!sourceType || !name || !gen) {
        usersSourcesByGen = null
        return
      }
      if (!usersSourcesByGen[sourceType]) usersSourcesByGen[sourceType] = []
      const repeatableSourceTypes = [
        'variant',
        'regional',
        'special',
        'npc-trade',
        'side-game',
      ]
      if (repeatableSourceTypes.includes(sourceType)) {
        const index = usersSourcesByGen[sourceType].findIndex(x => x[0] === name)
        if (index === -1) usersSourcesByGen[sourceType].push([name, [Number(gen)]])
        else usersSourcesByGen[sourceType][index][1].push(Number(gen))
      } else usersSourcesByGen[sourceType].push(Number(gen))

      if (!usersSourcesByGen.all.includes(Number(gen)))
        usersSourcesByGen.all.push(Number(gen))
    })
  }
  return usersSourcesByGen
}

export const getSourcesByType = mon => {
  const sourcesByType = {}
  const imagesBySource = []
  let defaultSource
  mon.sourcesByType.forEach(source => {
    const { type, name, image, replaceDefault } = source
    if (!sourcesByType[type]) sourcesByType[type] = []
    sourcesByType[type].push(name)
    if (image) imagesBySource.push([name, image])
    if (replaceDefault) defaultSource = name
  })
  return [{ ...sourcesByType, defaultSource }, imagesBySource]
}

export const getNeededRules = rules => {
  let neededRules = []
  for (const [key, value] of Object.entries(rules)) {
    if (value) neededRules.push(key)
  }

  if (neededRules.includes('gender'))
    neededRules.splice(neededRules.indexOf('gender'), 1, 'male', 'female')
  return neededRules
}
