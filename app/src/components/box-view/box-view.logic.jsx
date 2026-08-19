import forest from '../../media/box-wallpapers/forest.png'
import city from '../../media/box-wallpapers/city.png'
import desert from '../../media/box-wallpapers/desert.png'
import savanna from '../../media/box-wallpapers/savanna.png'
import crag from '../../media/box-wallpapers/crag.png'
import volcano from '../../media/box-wallpapers/volcano.png'
import snow from '../../media/box-wallpapers/snow.png'
import cave from '../../media/box-wallpapers/cave.png'
import beach from '../../media/box-wallpapers/beach.png'
import seafloor from '../../media/box-wallpapers/seafloor.png'
import river from '../../media/box-wallpapers/river.png'
import sky from '../../media/box-wallpapers/sky.png'
import checks from '../../media/box-wallpapers/checks.png'
import pokecenter from '../../media/box-wallpapers/pokecenter.png'
import machine from '../../media/box-wallpapers/machine.png'
import simple from '../../media/box-wallpapers/simple.png'
import space from '../../media/box-wallpapers/space.png'
import backyard from '../../media/box-wallpapers/backyard.png'
import nostalgic from '../../media/box-wallpapers/nostalgic.png'
import torchic from '../../media/box-wallpapers/torchic.png'
import trio from '../../media/box-wallpapers/trio.png'
import pikapika from '../../media/box-wallpapers/pikapika.png'
import legend from '../../media/box-wallpapers/legend.png'
import galactic from '../../media/box-wallpapers/galactic.png'
import distortionPlatinum from '../../media/box-wallpapers/distortion-platinum.png'
import contestPlatinum from '../../media/box-wallpapers/contest-platinum.png'
import nostalgicPlatinum from '../../media/box-wallpapers/nostalgic-platinum.png'
import croagunkPlatinum from '../../media/box-wallpapers/croagunk-platinum.png'
import trioPlatinum from '../../media/box-wallpapers/trio-platinum.png'
import pikapikaPlatinum from '../../media/box-wallpapers/pikapika-platinum.png'
import legendPlatinum from '../../media/box-wallpapers/legend-platinum.png'
import galacticPlatinum from '../../media/box-wallpapers/galactic-platinum.png'
import pokemonBox from '../../media/box-wallpapers/pokemon-box.png'

export const wallpapers = [
  forest,
  city,
  desert,
  savanna,
  crag,
  volcano,
  snow,
  cave,
  beach,
  seafloor,
  river,
  sky,
  checks,
  pokecenter,
  machine,
  simple,
  space,
  backyard,
  nostalgic,
  torchic,
  trio,
  pikapika,
  legend,
  galactic,
  distortionPlatinum,
  contestPlatinum,
  nostalgicPlatinum,
  croagunkPlatinum,
  trioPlatinum,
  pikapikaPlatinum,
  legendPlatinum,
  galacticPlatinum,
]

export const largeWallpaper = pokemonBox

// Gens 1-2 and 3+ have no transfer path between them.
export const transferPathOk = (catchGen, versionGen) =>
  catchGen <= versionGen && !(catchGen <= 2 && versionGen >= 3)

// c: {gameId, gen, isolationGroup, transferGen}; version: a game_versions row.
// Isolated boxes (Let's Go, Colosseum, XD) only count catches from their own
// group. Catches from isolated games leave via transferGen (Let's Go -> 8 via
// Home) or their own gen (Colosseum/XD trade out to GBA gen 3).
export const catchSatisfiesBox = (c, version) => {
  if (version.isolationGroup) return c.isolationGroup === version.isolationGroup
  const effectiveGen = c.transferGen ?? c.gen
  return transferPathOk(effectiveGen, version.generationId)
}

export const completeRecordsForVersion = (usersBoxData, version) =>
  usersBoxData?.find(game => game.gameId === version.id)?.completeRecords ?? []

// The single definition of "shown as in-box": a valid catch AND a checked
// record. Sprite, read-mode checklist, and edit-mode checkbox all use this.
export const isShownInBox = (mon, completeRecords) =>
  Boolean(mon.isCaught) && completeRecords.includes(mon.recordKey)

// Derives the rows a version's boxes hold from the /api/all-pokemon payload:
// the version's dex slice, plus one row per required source that the version
// displays (variants always; gender/regional unless the version ignores
// them; anything else only when user-forced), each keyed and marked caught
// against this version's transfer rules.
export const filterPokemonForVersion = (allPokemon, selectedVersion) => {
  let filteredPokemon = allPokemon
  if (selectedVersion.dexLimit)
    filteredPokemon = allPokemon.slice(0, selectedVersion.dexLimit)
  else if (selectedVersion.limitedDex)
    filteredPokemon = allPokemon.filter(mon => selectedVersion.limitedDex.includes(mon.id))

  if (selectedVersion.addMeltanLine) {
    const meltan = allPokemon.find(mon => mon.id === 808)
    const melmetal = allPokemon.find(mon => mon.id === 809)
    filteredPokemon = [...filteredPokemon, meltan, melmetal]
  }

  const versionGen = selectedVersion.generationId

  const entryMakesBoxRow = entry => {
    if (entry.type === 'male' || entry.type === 'female')
      return !selectedVersion.ignoreGender
    if (entry.type === 'regional') return !selectedVersion.ignoreRegionalVariants
    if (entry.type === 'variant') return true
    // Non-standard types only appear as box rows when the user forced them.
    return entry.isOverridden
  }

  return filteredPokemon
    .map(mon => {
      let replacedDefault = false
      const newEntries = (mon.requiredSources || [])
        .filter(entryMakesBoxRow)
        .filter(entry => entry.firstGen <= versionGen)
        .map(entry => {
          if (entry.replaceDefault) replacedDefault = true
          return {
            ...mon,
            variant: entry.name,
            recordKey: `${mon.id}:${entry.sourceId}`,
            isCaught: (entry.caughtIn || []).some(c =>
              catchSatisfiesBox(c, selectedVersion)
            ),
            image:
              mon.imagesBySource.find(x => x[0] === entry.name)?.[1] || mon.defaultImage,
          }
        })

      const isCaught = (mon.usersCatches || []).some(c =>
        catchSatisfiesBox(c, selectedVersion)
      )
      const baseEntry = Object.assign({}, mon, {
        isCaught,
        recordKey: `${mon.id}`,
        image: mon.defaultImage,
      })
      return replacedDefault ? newEntries : [baseEntry, ...newEntries]
    })
    .flat()
}
