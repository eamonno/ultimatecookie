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

	protected addComponent(component: NewModifier.Component): this {
		this.components.push(component);
		return this;
	}

	scalesBuildingPrice(scale: number): this				{ return this.addComponent(new NewModifier.Scaler("buildingPriceScale", scale)); }
	scalesBuildingRefundRate(scale: number): this			{ return this.addComponent(new NewModifier.Scaler("buildingRefundRate", scale)); }
	scalesClicking(scale: number): this						{ return this.addComponent(new NewModifier.Scaler("cpcMultiplier", scale)); }
	scalesGoldenCookieEffectDuration(scale: number): this 	{ return this.addComponent(new NewModifier.Scaler("goldenCookieEffectDurationMultiplier", scale)); }
	scalesGoldenCookieFrequency(scale: number): this 		{ return this.addComponent(new NewModifier.Scaler("goldenCookieTime", 1 / scale)); }
	scalesMilk(scale: number): this 						{ return this.addComponent(new NewModifier.Scaler("milkMultiplier", scale)); }
	scalesPrestige(scale: number): this 					{ return this.addComponent(new NewModifier.Scaler("prestigeScale", scale)); }
	scalesProduction(scale: number): this 					{ return this.addComponent(new NewModifier.Scaler("productionScale", scale)); }
	scalesUpgradePrice(scale: number): this					{ return this.addComponent(new NewModifier.Scaler("upgradePriceScale", scale)); }
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

class OldModifier {

	isUnsupported(): void {
		this.unsupported = true;
	}

	requires(name: string): this { 
		// Just a documentation thing really for now, does nothing
		return this; 
	}
}
