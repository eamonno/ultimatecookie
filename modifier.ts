//
// Modifier
//
// Modifiers are used to change some of the values in a BaseSimulation. They encapsulate the functionality
// of the games various upgrades, buildings, buffs etc. 
//

type ModifierCallback = () => void;

class LegacyModifier {
	appliers: ModifierCallback[] = []
	revokers: ModifierCallback[] = []

	constructor(public sim: BaseSimulator) {
	}

	apply(): void {
		for (let i = 0; i < this.appliers.length; ++i)
			this.appliers[i]();
	}

	revoke(): void {
		for (let i = this.revokers.length - 1; i >= 0; --i)
			this.revokers[i]();
	}

	addApplier(func: ModifierCallback): void {
		this.appliers.push(func);
	}

	addRevoker(func: ModifierCallback): void {
		this.revokers.push(func);
	}
}

class Modifier extends LegacyModifier {
	applicationCount: number = 0
	components: Modifier.Component[] = []

	constructor(sim: BaseSimulator, public isUnique?: boolean) {
		super(sim);
	}
	
	get isApplied(): boolean {
		return this.applicationCount > 0;
	}
	
	// The benefit is the exact amount of effective CpS that will be gained from applying this
	// modifier
	get benefit(): number {
		let cps: number = this.sim.effectiveCps();
		this.apply();
		cps = this.sim.effectiveCps() - cps;
		this.revoke();
		return cps;
	}

	reset(): void {
		this.applicationCount = 0;
	}

	apply(): void {
		if (!this.isUnique && this.isApplied)
			throw new Error("Attempt to reapply unique modifier.");
		for (let i = 0; i < this.components.length; ++i)
			this.components[i].apply(this.sim);
		this.applicationCount++;
		super.apply();
	}

	revoke(): void {
		if (this.applicationCount <= 0) {
			throw new Error("Attempt to revoke unapplied modifier.");
		} else {
			for (let i = this.components.length - 1; i >= 0; --i)
				this.components[i].revoke(this.sim);
			this.applicationCount--;
		}
		super.revoke();
	}

	protected addComponent(component: Modifier.Component): this {
		this.components.push(component);
		return this;
	}

	protected addScaler(field: string, scale: number): this {
		return this.addComponent(new Modifier.Scaler(field, scale));
	}

	protected addBooster(field: string, amount: number): this {
		return this.addComponent(new Modifier.Booster(field, amount));
	}

	angersGrandmas(): this									{ return this.addBooster("grandmatriarchLevel", 1); }
	boostsBaseCps(amount: number): this 					{ return this.addBooster("baseCps", amount); }
	boostsClickCps(amount: number): this					{ return this.addBooster("cpcCpsMultiplier", amount); }
	boostsEggCount(amount: number = 1): this				{ return this.addBooster("eggCount", amount); }
	boostsHeartCookieCount(amount: number = 1): this		{ return this.addBooster("heartCookieCount", amount); }
	boostsMaxWrinklers(amount: number): this				{ return this.addBooster("maxWrinklers", amount); }
	boostsSantaPower(amount: number): this					{ return this.addComponent(new Modifier.SantaPowerBooster(amount)); }
	calmsGrandmas(): this 									{ return this; }
	cursesFinger(): this									{ return this.addBooster("cursedFingerCount", 1); }
	enablesUpgradePriceCursorScale(): this					{ return this.addBooster("upgradePriceCursorScaleEnables", 1); }
	scalesBaseClicking(scale: number): this 				{ return this.addScaler("cpcBaseMultiplier", scale); }
	scalesBuildingPrice(scale: number): this				{ return this.addScaler("buildingPriceScale", scale); }
	scalesBuildingRefundRate(scale: number): this			{ return this.addScaler("buildingRefundRate", scale); }
	scalesCenturyMultiplier(scale: number): this 			{ return this.addScaler("centuryMultiplier", scale); }
	scalesClickFrenzyMultiplier(scale: number): this		{ return this.addScaler("clickFrenzyMultiplier", scale); }
	scalesClicking(scale: number): this						{ return this.addScaler("cpcMultiplier", scale); }
	scalesCookieUpgradePrice(scale: number): this 			{ return this.addScaler("cookieUpgradePriceMultiplier", scale); }
	scalesElderPledgeDuration(scale: number): this			{ return this.addScaler("elderPledgeDurationScale", scale); }
	scalesFrenzyMultiplier(scale: number): this				{ return this.addScaler("frenzyMultiplier", scale); }
	scalesGoldenCookieDuration(scale: number): this			{ return this.addScaler("goldenCookieDuration", scale); }
	scalesHeartCookies(scale: number): this					{ return this.addScaler("heartCookieScale", scale); }
	scalesGoldenCookieEffectDuration(scale: number): this 	{ return this.addScaler("goldenCookieEffectDurationMultiplier", scale); }
	scalesGoldenCookieFrequency(scale: number): this 		{ return this.addScaler("goldenCookieTime", 1 / scale); }
	scalesMilk(scale: number): this 						{ return this.addScaler("milkMultiplier", scale); }
	scalesPrestige(scale: number): this 					{ return this.addScaler("prestigeScale", scale); }
	scalesProduction(scale: number): this 					{ return this.addScaler("productionScale", scale); }
	scalesRandomDropFrequency(scale: number): this			{ return this; }
	scalesReindeer(scale: number): this 					{ return this.addScaler("reindeerMultiplier", scale); }
	scalesReindeerBuffMultiplier(scale: number): this		{ return this.addScaler("reindeerBuffMultiplier", scale); }
	scalesReindeerDuration(scale: number): this				{ return this.addScaler("reindeerDuration", scale); }
	scalesReindeerFrequency(scale: number): this			{ return this.addScaler("reindeerTime", scale); }
	scalesSynergyUpgradePrice(scale: number): this 			{ return this.addScaler("synergyUpgradePriceMultiplier", scale); }
	scalesUpgradePrice(scale: number): this					{ return this.addScaler("upgradePriceScale", scale); }
	setsSeason(name: string): this							{ return this.addComponent(new Modifier.SeasonChanger(name)); }
	unlocksMilk(amount: number, tier: number = 0): this 	{ return this.addComponent(new Modifier.MilkScaler(amount, tier)); }
	unlocksPrestige(amount: number): this					{ return this.addBooster("prestigeUnlocked", amount); }

	givesBuildingPerBuildingFlatCpsBoost(receiver: BuildingIndex, source: BuildingIndex, amount: number): this {
		return this.addComponent(new Modifier.BuildingCountBooster(receiver, "perBuildingFlatCpsBoostCounter", BuildingCounter.ForMost(source, amount)));
	}
	
	givesBuildingPerBuildingBoost(receiver: BuildingIndex, source: BuildingIndex, amount: number): this {
		return this.addComponent(new Modifier.BuildingCountBooster(receiver, "scaleCounter", BuildingCounter.ForMost(source, amount)));
	}

	givesPerBuildingFlatCpcBoost(source: BuildingIndex, amount: number): this {
		return this.addComponent(new Modifier.BuildingCountBooster(null, "perBuildingFlatCpcBoostCounter", BuildingCounter.ForOne(source, amount)));
	}

	scalesBuildingCps(index: BuildingIndex, scale: number): this {
		return this.addComponent(new Modifier.BuildingCpsScaler(index, scale)); 
	}

	scalesSeasonalGoldenCookieFrequency(season: string, scale: number): this {
		return this.addComponent(new Modifier.SeasonScaler(season, "goldenCookieFrequencyScale", scale));
	}

	givesSynergy(receiver: BuildingIndex, giver: BuildingIndex, amount: number, reverse: number = 0): this {
		this.addComponent(new Modifier.Synergy(receiver, giver, amount));
		if (reverse != 0)
			this.addComponent(new Modifier.Synergy(giver, receiver, reverse));
		return this;
	}

}

module Modifier {
	// Each modifier consists of zero or more Components
	export interface Component {
		apply(sim: BaseSimulator): void;
		revoke(sim: BaseSimulator): void;
	}
	
	// Booster components add a value to a given BaseSimulator field.
	export class Booster implements Component {
		constructor(public field: string, public amount: number = 1) {}
	
		apply(sim: BaseSimulator): void		{ sim[this.field] += this.amount; }
		revoke(sim: BaseSimulator): void	{ sim[this.field] -= this.amount; }
	}

	// Add to a building counter
	export class BuildingCountBooster implements Component {
		constructor(public building: BuildingIndex | null, public field: string, public counter: BuildingCounter) {}

		apply(sim: BaseSimulator): void	{ 
			if (this.building != null) 
				sim.buildings[this.building][this.field].add(this.counter);
			else 
				sim[this.field].add(this.counter);
		}
	
		revoke(sim: BaseSimulator): void {
			if (this.building != null) 
				sim.buildings[this.building][this.field].add(this.counter);
			else 
				sim[this.field].subtract(this.counter);
		}
	}

	// Increase a buildings cps
	export class BuildingCpsScaler implements Component {
		constructor(public index: BuildingIndex, public scale: number) {}

		apply(sim: BaseSimulator): void		{ sim.buildings[this.index].multiplier *= this.scale; }
		revoke(sim: BaseSimulator): void	{ sim.buildings[this.index].multiplier /= this.scale; }
	}

	// Increase milk
	export class MilkScaler implements Component {
		constructor(public amount: number, public tier: number) {}

		apply(sim: BaseSimulator): void		{ sim.milkUnlocks[this.tier].push(this.amount); sim.milkUnlocks[this.tier].sort(); }
		revoke(sim: BaseSimulator): void	{ sim.milkUnlocks[this.tier].splice(sim.milkUnlocks[this.tier].indexOf(this.amount), 1); }
	}

	// Increase the santa level of the simulator
	export class SantaPowerBooster implements Component {
		constructor(public amount: number) {}
		apply(sim: BaseSimulator): void		{ sim.santa.power += this.amount; }
		revoke(sim: BaseSimulator): void	{ sim.santa.power -= this.amount; }
	}

	// Scaler components multiply a BaseSimulator field by a given value.
	export class Scaler implements Component {
		constructor(public field: string, public scale: number) {}
	
		apply(sim: BaseSimulator): void		{ sim[this.field] *= this.scale; }
		revoke(sim: BaseSimulator): void	{ sim[this.field] /= this.scale; }
	}

	// Scaler a field of a season by an amount
	export class SeasonScaler implements Component {
		constructor(public season: string, public field: string, public scale: number) {}
	
		apply(sim: BaseSimulator): void		{ sim.seasons[this.season][this.field] *= this.scale; }
		revoke(sim: BaseSimulator): void	{ sim.seasons[this.season][this.field] /= this.scale; }
	}

	// SeasonChanger component sets the season
	export class SeasonChanger implements Component {
		constructor(public name: string) {}

		apply(sim: BaseSimulator): void		{ sim.seasonStack.push(name); sim.seasonChanges++; }
		revoke(sim: BaseSimulator): void	{ sim.seasonStack.pop(); sim.seasonChanges--; }
	}

	// Synergies give buildings boosts based on the count of another building
	export class Synergy implements Component {
		constructor(public receiver: BuildingIndex, public giver: BuildingIndex, public amount: number) {}

		apply(sim: BaseSimulator): void		{ sim.buildings[this.receiver].addSynergy(this.giver, this.amount); }
		revoke(sim: BaseSimulator): void	{ sim.buildings[this.receiver].removeSynergy(this.giver, this.amount); }
	}
}
