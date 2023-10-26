const repeatableSourceTypes = ['variant', 'regional', 'special', 'npc-trade', 'side-game']

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
      if (!sourceType || !name || !gen) return
      if (!usersSourcesByGen[sourceType]) usersSourcesByGen[sourceType] = []
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
    const { type, name, image, replaceDefault, firstGen } = source
    // types
    if (!sourcesByType[type]) sourcesByType[type] = []
    if (repeatableSourceTypes.includes(type)) sourcesByType[type].push([name, firstGen])
    else sourcesByType[type].push(name, firstGen)

    //images
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

export const formatGamesForBoxView = gameVersions => {
  // ['Box Option', gameVersionId]
  const boxViewOptions = [
    ['Gen 1', 3],
    ['Gen 2', 6],
    ['Gen 3', 9],
    ['Gen 4', 16],
    ['Gen 5', 22],
    ['Gen 6', 26],
    ['Gen 7', 30],
    ['Gen 8', 34],
    ['Gen 9', 48],
    ['Stadium', 38],
    ['Stadium 2', 39],
    ['Pokemon Box', 41],
    ['Colosseum', 10],
    ['XD', 11],
    ['Pokemon Ranch', 42],
    ["Let's Go", 32],
    ['BD/SP', 36],
    ['Legends Arceus', 37],
  ]

  return boxViewOptions.map(option => {
    const [name, id] = option
    const game = gameVersions.find(game => game.id === id)
    return [name, game]
  })
}
