//
// Strategies
//
// The strategy involves any details about how the game is played, should Elder Pledge be used, what
// spells and toggles should be active etc, auto clicking, auto buying and so on are all part of a 
// strategy.
//

class Strategy {
    name: string

    autoBuy: boolean = true
    autoClick: boolean = true
    autoClickGoldenCookies : boolean = true
    autoClickReindeer : boolean = true
    autoPledge: boolean = true

    clickRateOverride: number = -1;

    unlockSeasonUpgrades: boolean = true
    preferredSeason: string = "fools"

    dragonAura1: string = null
    dragonAura2: string = null

	constructor(name : string) {
		this.name = name;
	}
}
