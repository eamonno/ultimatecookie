//
// Modifier
//
// Modifiers are used to change some of the values in a BaseSimulation. They encapsulate the functionality
// of the games various upgrades, buildings, buffs etc. 
//

class NewModifier {
	applicationCount: number = 0

	constructor(public sim: BaseSimulator, public components: NewModifier.Component[], public readonly isUnique = false) {}
	
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
	}

	revoke(): void {
		if (this.applicationCount <= 0) {
			throw new Error("Attempt to revoke unapplied modifier.");
		} else {
			for (let i = this.components.length - 1; i >= 0; --i)
				this.components[i].revoke(this.sim);
			this.applicationCount--;
		}
	}
}

module NewModifier {
	//
	// Each modifier consists of zero or more Components
	//
	export interface Component {
		apply(sim: BaseSimulator): void;
		revoke(sim: BaseSimulator): void;
	}
	
	//
	// Scaler components multiply a BaseSimulator field by a given value when applied
	//
	export class Scaler implements Component {
		constructor(public field: string, public scale: number) {}
	
		apply(sim: BaseSimulator): void		{ sim[this.field] *= this.scale; }
		revoke(sim: BaseSimulator): void	{ sim[this.field] /= this.scale; }
	}
	
	//
	// Booster components add a value to a given BaseSimulator field when applied
	//
	export class Booster implements Component {
		constructor(public field: string, public amount: number = 1) {}
	
		apply(sim: BaseSimulator): void		{ sim[this.field] += this.amount; }
		revoke(sim: BaseSimulator): void	{ sim[this.field] -= this.amount; }
	}
}

//
// Helper functions, shorthand for creating the varions ModifierComponents, allows for a more 
// readable and expressive way of declaring a bunch of components.
//

function scales(field: string, scale: number): NewModifier.Scaler {
	return new NewModifier.Scaler(field, scale);
}

function boosts(field: string, amount: number = 1): NewModifier.Booster {
	return new NewModifier.Booster(field, amount);
}

prestige("Lucky digit"					).requires("Heavenly luck").scalesPrestige(1.01).scalesGoldenCookieDuration(1.01).scalesGoldenCookieEffectDuration(1.01);

Upgrade("Lucky digit", [scales("prestigeScale", 1.01), scales("goldenCookieDurationScale", 1.01), scales("goldenCookieEffectDurationScale", 1.01)]);

class OldModifier {

	// Value is slightly different to benefit. It lets items that might not provide any direct
	// benefit still be included in the purchase rankings and also provides a slight boost to
	// the purchase order of things like discounts etc. Basically if a measurable benefit is 
	// available it is used, if not, just treat it as a lump of coal.
	get value(): number {
		let ben: number = this.benefit;
		if (ben > 0 || this.name == "Chocolate egg") 
			return ben;
		let cps: number = this.sim.effectiveCps();
		this.sim.productionScale *= 1.01;
		cps = this.sim.effectiveCps() - cps;
		this.sim.productionScale /= 1.01;
		return cps;
	}

	//
	// Modification functions
	//

	isUnsupported(): void {
		this.unsupported = true;
	}

	requires(name: string): this { 
		// Just a documentation thing really for now, does nothing
		return this; 
	}

	scalesBuildingPrice(scale: number): this {
		this.addApplier(() => this.sim.buildingPriceScale *= scale);
		this.addRevoker(() => this.sim.buildingPriceScale /= scale);
		return this;
	}

	scalesBuildingRefundRate(scale: number): this {
		this.addApplier(() => this.sim.buildingRefundRate *= scale);
		this.addRevoker(() => this.sim.buildingRefundRate /= scale);
		return this;
	}

	scalesClicking(scale: number): this {
		this.addApplier(() => this.sim.cpcMultiplier *= scale);
		this.addRevoker(() => this.sim.cpcMultiplier /= scale);
		return this;
	}

	scalesGoldenCookieEffectDuration(scale: number): this {
		this.addApplier(() => this.sim.goldenCookieEffectDurationMultiplier *= scale);
		this.addRevoker(() => this.sim.goldenCookieEffectDurationMultiplier /= scale);
		return this;
	}

	scalesGoldenCookieFrequency(scale: number): this {
		this.addApplier(() => this.sim.goldenCookieTime /= scale);
		this.addRevoker(() => this.sim.goldenCookieTime *= scale);
		return this;
	}

	scalesMilk(scale: number): this {
		this.addApplier(() => this.sim.milkMultiplier *= scale);
		this.addRevoker(() => this.sim.milkMultiplier /= scale);
		return this;
	}	
	
	scalesPrestige(scale: number): this {
		this.addApplier(() => this.sim.prestigeScale *= scale);
		this.addRevoker(() => this.sim.prestigeScale /= scale);
		return this;
	}

	scalesProduction(scale: number): this {
		this.addApplier(() => this.sim.productionScale *= scale);
		this.addRevoker(() => this.sim.productionScale /= scale);
		return this;
	}

	scalesUpgradePrice(scale: number): this {
		this.addApplier(() => this.sim.upgradePriceScale *= scale);
		this.addRevoker(() => this.sim.upgradePriceScale /= scale);
		return this;
	}
}
