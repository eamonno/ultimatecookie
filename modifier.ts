//
// Modifier
//
// Modifiers are used to change some of the values in a BaseSimulation. They encapsulate the functionality
// of the games various upgrades, buildings, buffs etc. 
//

type ModifierCallback = () => void;

class LegacyModifier {
	applicationCount: number = 0
	unsupported: boolean
	appliers: ModifierCallback[] = []
	revokers: ModifierCallback[] = []

	constructor(public sim: BaseSimulator, public name: string, public isUnique: boolean = false) {
	}

	get isApplied(): boolean {
		return this.applicationCount > 0;
	}

	apply(): void {
		for (let i = 0; i < this.appliers.length; ++i)
			this.appliers[i]();
	}

	reset(): void {
		this.applicationCount = 0;
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

	// The benefit is the exact amount of effective CpS that will be gained from applying this
	// modifier
	get benefit(): number {
		let cps: number = this.sim.effectiveCps();
		this.apply();
		cps = this.sim.effectiveCps() - cps;
		this.revoke();
		return cps;
	}

	// A longer name that can contain extra information about the modifier used for logging etc.
	get longName(): string {
		return this.name;
	}

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
}

class Modifier extends LegacyModifier {
	applicationCount: number = 0
	components: Modifier.Component[] = []

	constructor(sim: BaseSimulator, name: string) {
		super(sim, name);
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

	scalesBuildingPrice(scale: number): this				{ return this.addScaler("buildingPriceScale", scale); }
	scalesBuildingRefundRate(scale: number): this			{ return this.addScaler("buildingRefundRate", scale); }
	scalesClicking(scale: number): this						{ return this.addScaler("cpcMultiplier", scale); }
	scalesGoldenCookieEffectDuration(scale: number): this 	{ return this.addScaler("goldenCookieEffectDurationMultiplier", scale); }
	scalesGoldenCookieFrequency(scale: number): this 		{ return this.addScaler("goldenCookieTime", 1 / scale); }
	scalesMilk(scale: number): this 						{ return this.addScaler("milkMultiplier", scale); }
	scalesPrestige(scale: number): this 					{ return this.addScaler("prestigeScale", scale); }
	scalesProduction(scale: number): this 					{ return this.addScaler("productionScale", scale); }
	scalesUpgradePrice(scale: number): this					{ return this.addScaler("upgradePriceScale", scale); }
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
}
