# Phase 3 testing


## Tags on evolution

- Evolved pokemon now keep the"shiny" tags
- Should it keep the "From home region" tag?
	- More accurately... Maybe it should count but only for those who evolve in the same gen as the base pokemon? For example, Tangrowth's "From home region" should be gen 4. A Tangela with "From home region" should lose it when evolving, because it's a gen 1 Tangela
	- On the other side, evolving a Wurmple that you caught in gen 3 to a Cascoon -> Cascoon should still have "From home region" (same region)
	- Baby pokemon from future gens should absolutely lose the "From home region" tag - Evolving Bonsly to Sudowoodo -> If Bonsly had "From home region", then Sudowoodo should not have that tag active and counting towards its own "From home region" tag. You would need another "From home region" Sudowoodo to satisfy that rule.
	- Also, by "lose the tag", I should clarify that the tag from the earlier evolution shouldn't count towards the completion of the newly evolved pokemon's row - right now, it persists the tag when evolving, but the tag is "faded" in the UI and doesn't count towards the row. No tags are ever actually "removed" from the pokemon upon evolution as far as I know.
	- So to summarize:
		- Evolving to same-gen evolution: keep the tag (Gen 3 Wurmple -> Gen 3 Cascoon)
		- Evolving to later-gen evolution: remove the tag (Gen 1 Tangela -> Gen 4 Tangrowth)
		- Evolving to previous-gen evolution: remove the tag (Gen 4 Bonsly -> Gen 2 Sudowoodo)
	- Is it maybe easier to just check the gen of the caught pokemon (the gen that it was caught in, not its origin) and see if it's the gen that the target evolved pokemon is originally from? How should this check actually be enforced?
	- There's also the idea that "region" doesn't necessarily mean "gen". If you catch a Sinnoh pokemon in Pokemon Soul Silver, is that really "From home region"? It's the same "gen", but the wrong region. So maybe there's even more logic there? This needs brainstorming, but the current implementation is incorrect
	- Evolved pokemon should keep gender tags if they have them
  	- Finneon -> Lumineon - Lumineon should inherit the gender tag of the evolved pokemon
  	- Ivysaur -> Venusaur - There's no tag to inherit, 

## Personal source overrides

- After logging a new source, personal source overrides (pills with green border) have their border removed - source calculation is still working, but you must close or reopen the drawer to see the border again.
- I'm not sure I understand the states. There's a dimmer dashed-border that I assume means "no longer required". Then there's the solid green border which I assume means "always required even though it's not in my rules". Should I not be able to cycle through all three?
- So I guess the question is... Should the app have three states (always required, never required, follow user rules) regardless of what the user's rule says? Or should it just have the option to toggle to the opposite of the rule (how it works today)?
- Either way, a change is needed. If you set a personal override, then change the rule, the old "override" still exists, but if you click on the pill, you can't get it back into that state unless you change the rule again.
- I think all three states are needed regardless of the rule
- Also, I think the green border should be a little thicker to be more obvious. Dashed-border + transparency is good, no change for that state.

## Source "flash" when opening a new pokemon row "drawer"

- Previous pokemon's sources still "flash" - it's faster after the fix, but still a flash. 
- Is this even fixable? It loads as you click the drawer, maybe just deal with it? Maybe a loading skeleton or spinner instead? 
- Maybe defer to later, recent change is still an improvement