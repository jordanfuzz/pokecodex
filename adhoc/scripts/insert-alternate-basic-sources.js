import pgPool from '../pg-pool.js'
import { randomUUID } from 'crypto'

const startersByGeneration = [
  [1, 4, 7],
  [152, 155, 158],
  [252, 255, 258],
  [387, 390, 393],
  [495, 498, 501],
  [650, 653, 656],
  [722, 725, 728],
  [810, 813, 816],
]

const virgins = [
  144, 145, 146, 150, 151, 201, 243, 244, 245, 249, 250, 251, 377, 378, 379, 380, 381,
  382, 383, 384, 385, 386, 480, 481, 482, 483, 484, 485, 486, 487, 488, 491, 492, 493,
  494, 638, 639, 640, 641, 642, 643, 644, 645, 646, 647, 648, 649, 716, 717, 718, 719,
  720, 721, 772, 773, 785, 786, 787, 788, 789, 790, 791, 792, 793, 794, 795, 796, 797,
  798, 799, 800, 801, 802, 803, 804, 805, 806, 807, 808, 809, 880, 881, 882, 883, 888,
  889, 890, 891, 892, 893, 894, 895, 896, 897, 898, 905, 984, 985, 986, 987, 988, 989,
  990, 991, 992, 993, 994, 995, 999, 1000, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008,
  1009, 1010, 1014, 1015, 1016, 1017,
]

let basicSources = []

for (let i = 1; i <= 898; i++) {
  const hatchSource = {
    id: randomUUID(),
    pokemonId: i,
    name: 'Hatch',
    gen: 0,
    source: 'hatch',
  }

  const starterGeneration = startersByGeneration.findIndex(x => x.includes(i)) + 1
  const starterSource = {
    id: randomUUID(),
    pokemonId: i,
    name: 'Starter',
    gen: startersByGeneration.findIndex(x => x.includes(i)) + 1,
    source: 'starter',
  }

  if (!virgins.includes(i)) basicSources.push(hatchSource)
  if (starterGeneration > 0) basicSources.push(starterSource)
}

async function insertSources() {
  for await (const basicSource of basicSources) {
    const { id, pokemonId, name, gen, source } = basicSource

    pgPool.query(
      `insert into sources (id, pokemon_id, name, gen, source)
    values ($1, $2, $3, $4, $5);`,
      [id, pokemonId, name, gen, source]
    )
  }
}

insertSources()
