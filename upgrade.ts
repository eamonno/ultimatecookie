// class NewUpgrade {
// 	readonly modifier: NewModifier

// 	constructor(public sim: BaseSimulator, public name: string, components: NewModifier.Component[]) {
// 		this.modifier = new NewModifier(sim, components, name, true);
// 	}
// }

enum UpgradeFlags {
    Unlocked        = 0x001,
    Unsupported     = 0x002,
    Egg             = 0x004,
    SantaReward     = 0x008,
    GoldenSwitch    = 0x010,
    SeasonChanger   = 0x020,
    RareEgg         = 0x040,
    Cookie          = 0x080,
    Synergy         = 0x100,
    Toggle          = 0x200,
    HeartCookie     = 0x400,
    Prestige        = 0x800,
}

class Upgrade extends Purchase {
	constructor(sim: Simulator, name: string, private flags: UpgradeFlags = 0) {
		super(sim, name);

		let gameUpgrade = Game.Upgrades[name];
		if (gameUpgrade) {
			this.basePrice = gameUpgrade.basePrice;
		} else {
			console.log("Upgrade not found: " + name);
        }
        
        if (this.flags & (UpgradeFlags.Egg | UpgradeFlags.RareEgg))
            this.boostsEggCount();
        if (this.flags & UpgradeFlags.HeartCookie)
            this.boostsHeartCookieCount();
	}

	get isAvailable(): boolean      { return this.isUnlocked && !this.isUnsupported && !this.isApplied; }
    get isCookie(): boolean         { return (this.flags & UpgradeFlags.Cookie) > 0; }
    get isEgg(): boolean            { return (this.flags & UpgradeFlags.Egg) > 0; }
    get isGoldenSwitch(): boolean   { return (this.flags & UpgradeFlags.GoldenSwitch) > 0; }
    get isHeartCookie(): boolean    { return (this.flags & UpgradeFlags.HeartCookie) > 0; }
    get isPrestige(): boolean       { return (this.flags & UpgradeFlags.Prestige) > 0; }
    get isRareEgg(): boolean        { return (this.flags & UpgradeFlags.RareEgg) > 0; }
    get isSantaReward(): boolean    { return (this.flags & UpgradeFlags.SantaReward) > 0; }
    get isSeasonChanger(): boolean  { return (this.flags & UpgradeFlags.SeasonChanger) > 0; }
    get isSynergy(): boolean        { return (this.flags & UpgradeFlags.Synergy) > 0; }
    get isToggle(): boolean         { return (this.flags & UpgradeFlags.Toggle) > 0; }
    get isUnlocked(): boolean       { return (this.flags & UpgradeFlags.Unlocked) > 0; }
    get isUnsupported(): boolean    { return (this.flags & UpgradeFlags.Unsupported) > 0; }

    set isUnlocked(flag: boolean) {
        if (flag) {
            this.flags |= UpgradeFlags.Unlocked;
        } else {
            this.flags &= ~UpgradeFlags.Unlocked;
        }
    }

    reset(): void {
        this.isUnlocked = false;
        super.reset();
    }

    requiresSeason(name: string): this {
		let season: Season = this.sim.seasons[name];
		if (!season) {
			console.log("Missing season for " + this.name + ": " + name);
		} else {
			season.addLock(this);
		}
		return this;
	}

	get price(): number {
		let p: number = this.basePrice;
		if (this.name == "Elder Pledge")
			p = Math.pow(8, Math.min(Game.pledges + 2, 14));
		else if (this.isSantaReward)
			p = this.sim.santa.randomRewardCost(this.sim.santa.level);
		else if (this.isRareEgg)
			p = Math.pow(3, this.sim.eggCount) * 999;
		else if (this.isEgg)
			p = Math.pow(2, this.sim.eggCount) * 999;
		else if (this.isSeasonChanger)
			p = this.basePrice * Math.pow(2, this.sim.seasonChanges);
		else if (this.isGoldenSwitch)
			p = this.sim.cps * 60 * 60;
		if (this.isCookie)
			p *= this.sim.cookieUpgradePriceMultiplier;
		if (this.isSynergy)
			p *= this.sim.synergyUpgradePriceMultiplier;
		return Math.ceil(p * this.sim.upgradePriceScale * this.sim.upgradePriceCursorScale);
	}

	get matchErrors(): string[] {
		if (!this.unsupported) {
			let gameObj = Game.Upgrades[this.name];
			if (!gameObj)
				return ["Upgrade Name " + this.name + " has no corresponding match in store."];
			if (!floatEqual(this.price, gameObj.getPrice()))
				return ["Upgrade Cost " + this.name + " - Predicted: " + this.price + ", Actual: " + gameObj.getPrice()];
			if (this.isApplied && gameObj.bought == 0)
				return ["Upgrade " + this.name + " bought in sim but not bought in game."];
			if (!this.isApplied && gameObj.bought == 1)
				return ["Upgrade " + this.name + " not bought in sim but bought in game."];
			if (this.isUnlocked && gameObj.unlocked == 0)
				return ["Upgrade " + this.name + " unlocked but not unlocked in game."];
			if (!this.isUnlocked && gameObj.unlocked == 1)
				return ["Upgrade " + this.name + " locked but not locked in game."];
		}
		return [];
	}

	purchase(): void {
		Game.Upgrades[this.name].buy(1);
		this.apply();
	}
}
