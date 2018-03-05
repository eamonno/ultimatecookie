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

	constructor(public sim: BaseSimulator, public isUnique: boolean = false) {
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

	//
	// Modification functions
	//

	enablesUpgradePriceCursorScale(): this {
		this.addApplier(() => { this.sim.upgradePriceCursorScaleEnabled = true; this.sim.recalculateUpgradePriceCursorScale(); })
		this.addRevoker(() => { this.sim.upgradePriceCursorScaleEnabled = false; this.sim.recalculateUpgradePriceCursorScale(); })
		return this;
	}

	scalesBuildingCps(index: number, scale: number): this {
		this.addApplier(() => { this.sim.buildings[index].multiplier *= scale; });
		this.addRevoker(() => { this.sim.buildings[index].multiplier /= scale; });
		return this;
	}

	scalesProductionByAge(scale: number): this {
		const GoldenCookieBirthday = new Date(2013, 7, 8).getTime();
		let age = Math.floor((Date.now() - GoldenCookieBirthday) / (365 * 24 * 60 * 60 * 1000));
		this.addApplier(() => { this.sim.productionScale *= (1 + scale * age); });
		this.addRevoker(() => { this.sim.productionScale /= (1 + scale * age); });
		return this;
	}

	scalesRandomDropFrequency(scale: number): this {
		return this;
	}

	scalesSeasonalGoldenCookieFrequency(season: string, scale: number): this {
		this.addApplier(() => { this.sim.seasons[season].goldenCookieFrequencyScale *= scale; });
		this.addRevoker(() => { this.sim.seasons[season].goldenCookieFrequencyScale /= scale; });
		return this;
	}

	setsSeason(name: string): this {
		this.addApplier(() => {
			this.sim.pushSeason(this.sim.seasons[name]);
			this.sim.seasonChanges++; 
		});
		this.addRevoker(() => {
			this.sim.popSeason();
			this.sim.seasonChanges--; 
		});
		return this;
	}

	givesBuildingPerBuildingFlatCpsBoost(receiver: BuildingIndex, excludes: BuildingIndex[], amount: number): this {
		this.addApplier(() => { this.sim.buildings[receiver].perBuildingFlatCpsBoostCounter.addCountMost(excludes, amount); });
		this.addRevoker(() => { this.sim.buildings[receiver].perBuildingFlatCpsBoostCounter.subtractCountMost(excludes, amount); });
		return this;
	}

	givesSynergy(receiver: BuildingIndex, from: BuildingIndex, amount: number, reverse: number = 0): this {
		this.addApplier(() => { this.sim.buildings[receiver].addSynergy(from, amount); });
		this.addRevoker(() => { this.sim.buildings[receiver].removeSynergy(from, amount); });
		if (reverse) {
			this.addApplier(() => { this.sim.buildings[from].addSynergy(receiver, reverse); });
			this.addRevoker(() => { this.sim.buildings[from].removeSynergy(receiver, reverse); });				
		}
		return this;		
	}

	givesPerBuildingBoost(receiver: BuildingIndex, source: BuildingIndex, amount: number): this {
		this.addApplier(() => { this.sim.buildings[receiver].scaleCounter.addCountOne(source, amount); });
		this.addRevoker(() => { this.sim.buildings[receiver].scaleCounter.subtractCountOne(source, amount); });
		return this;
	}

	givesPerBuildingFlatCpcBoost(excludes: BuildingIndex[], amount: number): this {
		this.addApplier(() => { this.sim.perBuildingFlatCpcBoostCounter.addCountMost(excludes, amount); });
		this.addRevoker(() => { this.sim.perBuildingFlatCpcBoostCounter.subtractCountMost(excludes, amount); });
		return this;
	}

	unlocksMilk(amount: number, tier: number = 0): this {
		this.addApplier(() => { this.sim.milkUnlocks[tier].push(amount); this.sim.milkUnlocks[tier].sort(); });
		this.addRevoker(() => { this.sim.milkUnlocks[tier].splice(this.sim.milkUnlocks[tier].indexOf(amount), 1); });
		return this;		
	}
}

class Modifier extends LegacyModifier {
	applicationCount: number = 0
	components: Modifier.Component[] = []

	constructor(sim: BaseSimulator) {
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

	protected addCustom(applier: Modifier.CustomComponentCallback, revoker: Modifier.CustomComponentCallback): this {
		return this.addComponent(new Modifier.Custom(applier, revoker));
	}

	// Simple Modifier functions
	angersGrandmas(): this									{ return this.addBooster("grandmatriarchLevel", 1); }
	boostsBaseCps(amount: number): this 					{ return this.addBooster("baseCps", amount); }
	boostsClickCps(amount: number): this					{ return this.addBooster("cpcCpsMultiplier", amount); }
	boostsEggCount(amount: number = 1): this				{ return this.addBooster("eggCount", amount); }
	boostsHeartCookieCount(amount: number = 1): this		{ return this.addBooster("heartCookieCount", amount); }
	boostsMaxWrinklers(amount: number): this				{ return this.addBooster("maxWrinklers", amount); }
	calmsGrandmas(): this 									{ return this; }
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
	scalesReindeer(scale: number): this 					{ return this.addScaler("reindeerMultiplier", scale); }
	scalesReindeerBuffMultiplier(scale: number): this		{ return this.addScaler("reindeerBuffMultiplier", scale); }
	scalesReindeerDuration(scale: number): this				{ return this.addScaler("reindeerDuration", scale); }
	scalesReindeerFrequency(scale: number): this			{ return this.addScaler("reindeerTime", scale); }
	scalesSynergyUpgradePrice(scale: number): this 			{ return this.addScaler("synergyUpgradePriceMultiplier", scale); }
	scalesUpgradePrice(scale: number): this					{ return this.addScaler("upgradePriceScale", scale); }
	unlocksPrestige(amount: number): this					{ return this.addBooster("prestigeUnlocked", amount); }

	// Custom Modifier functions
	boostsSantaPower(amount: number): this { 
		return this.addCustom(
			(sim: BaseSimulator) => { sim.santa.power += amount; },
			(sim: BaseSimulator) => { sim.santa.power -= amount; }
		);
	}
}

module Modifier {
	//
	// Each modifier consists of zero or more Components
	//
	export interface Component {
		apply(sim: BaseSimulator): void;
		revoke(sim: BaseSimulator): void;
	}
	
	//
	// Booster components add a value to a given BaseSimulator field.
	//
	export class Booster implements Component {
		constructor(public field: string, public amount: number = 1) {}
	
		apply(sim: BaseSimulator): void		{ sim[this.field] += this.amount; }
		revoke(sim: BaseSimulator): void	{ sim[this.field] -= this.amount; }
	}

	//
	// Pusher components push a value to a given BaseSimulator array.
	//
	export class Pusher implements Component {
		constructor(public field: string, public value: string | number) {}
	
		apply(sim: BaseSimulator): void		{ sim[this.field].push(this.value); }
		revoke(sim: BaseSimulator): void	{ 
			if (sim[this.field].length == 0)
				throw new Error("Can't pop " + this.field + " as length is 0.");
			if (sim[this.field][0] != this.value)
				throw new Error("Popping " + this.field + " expected " + this.value + " got " + sim[this.field][0] + ".");
			sim[this.field].pop(); 
		}
	}	

	//
	// Scaler components multiply a BaseSimulator field by a given value.
	//
	export class Scaler implements Component {
		constructor(public field: string, public scale: number) {}
	
		apply(sim: BaseSimulator): void		{ sim[this.field] *= this.scale; }
		revoke(sim: BaseSimulator): void	{ sim[this.field] /= this.scale; }
	}

	//
	// Custom components take a custom apply and revoke functions
	//
	export type CustomComponentCallback = (sim: BaseSimulator) => void;
	export class Custom implements Component {
		constructor(public apply: CustomComponentCallback, public revoke: CustomComponentCallback) {}
	}
}
