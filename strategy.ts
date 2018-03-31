//
// Strategies
//
// The strategy involves any details about how the game is played, should Elder
// Pledge be used, what spells and toggles should be active etc, auto clicking,
// auto buying and so on are all part of a strategy.
//

class Strategy {
    autoAscend: boolean
    autoBuy: boolean
    autoClick: boolean
    autoClickGoldenCookies : boolean
    autoClickReindeer : boolean
    autoPledge: boolean
    unlockSeasonUpgrades: boolean

    clickRateOverride: number

    preferredSeason: string
    dragonAura1: string
    dragonAura2: string

	constructor(public name: string, {
        autoAscend = true,
        autoBuy = true,
        autoClick = true,
        autoClickGoldenCookies = true,
        autoClickReindeer = true,
        autoPledge = true,
        unlockSeasonUpgrades = true,
        clickRateOverride = -1,
        preferredSeason = "fools",
        dragonAura1 = null,
        dragonAura2 = null, 
    } = {}) {
        this.autoAscend = autoAscend;
        this.autoBuy = autoBuy;
        this.autoClick = autoClick;
        this.autoClickGoldenCookies = autoClickGoldenCookies;
        this.autoClickReindeer = autoClickReindeer;
        this.autoPledge = autoPledge;
        this.unlockSeasonUpgrades = unlockSeasonUpgrades;
        this.clickRateOverride = clickRateOverride;
        this.preferredSeason = preferredSeason;
        this.dragonAura1 = dragonAura1;
        this.dragonAura2 = dragonAura2;
    }

    static Default: Strategy = new Strategy("default");
    static Passive: Strategy = new Strategy("passive", { 
        autoAscend: false,
        autoBuy: false, 
        autoClick: false, 
        autoClickGoldenCookies: false, 
        autoClickReindeer: false, 
        autoPledge: false, 
        unlockSeasonUpgrades: false, 
        preferredSeason: ""});
}
