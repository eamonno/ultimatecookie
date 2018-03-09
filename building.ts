/// <reference path="purchase.ts" />

// Indices into the buildings arrays
enum BuildingIndex {
	Cursor = 0,
	Grandma = 1,
	Farm = 2,
	Mine = 3,
	Factory = 4,
	Bank = 5,
	Temple = 6,
	WizardTower = 7,
	Shipment = 8,
	AlchemyLab = 9,
	Portal = 10,
	TimeMachine = 11,
	AntimatterCondenser = 12,
	Prism = 13,
	Chancemaker = 14,
	NumBuildings = 15
}

//
// BuildingCounter
//
// Many upgrades work on various counts of buildings, add for each building of a type,
// add for every building excluding a type etc. This class is used to encapsulate that
// sort of logic and generate a count based on whatever the appropriate rules.
//

class BuildingCounter {
	static ForOne(index: BuildingIndex, scale: number = 1): BuildingCounter {
		let bc = new BuildingCounter();
		bc.scales[index] = scale;
		return bc;
	}

	static ForMost(index: BuildingIndex, scale: number = 1): BuildingCounter {
		let bc = new BuildingCounter();
		bc.scales.fill(scale);
		bc.scales[index] = 0;
		return bc;
	}

	scales: number[] = new Array(BuildingIndex.NumBuildings).fill(0)

	clear() { 
		this.scales.fill(0);
	}

	count(buildings: Building[]): number {
		let count = 0;
		for (let i = 0; i < this.scales.length; ++i) {
			count += this.scales[i] * buildings[i].quantity;
		}
		return count;
	}

	add(bc: BuildingCounter): BuildingCounter {
		for (let i = 0; i < BuildingIndex.NumBuildings; ++i)
			this.scales[i] += bc.scales[i];
		return this;
	}
	
	subtract(bc: BuildingCounter): BuildingCounter {
		for (let i = 0; i < BuildingIndex.NumBuildings; ++i)
			this.scales[i] -= bc.scales[i];
		return this;
	}
}

//
// Building.
//
// Represents one of the building types in the game.
//

interface BuildingSynergy {
	index: BuildingIndex
	scale: number
}

class Building extends Purchase {
	quantity: number
	level: number
	free: number
	multiplier: number
	synergies: BuildingSynergy[]
	perBuildingFlatCpcBoostCounter: BuildingCounter = new BuildingCounter();
	perBuildingFlatCpsBoostCounter: BuildingCounter = new BuildingCounter();
	buildingScaler: BuildingCounter = new BuildingCounter();
	scaleCounter: BuildingCounter = new BuildingCounter();

	constructor(sim: Simulator, public index: BuildingIndex, public name: string, public basePrice: number, public baseCps: number) {
		super(sim);
		this.reset();
	}

	get isAvailable(): boolean { return true; }

	purchase(): void {
		Game.ObjectsById[this.index].buy(1);
		this.apply();
	}

	apply() {
		this.sim.buildings[this.index].quantity++;
		if (this.index == BuildingIndex.Cursor) {
			this.sim.recalculateUpgradePriceCursorScale(); 
		}
	}

	revoke() {
		this.sim.buildings[this.index].quantity--;
		if (this.index == BuildingIndex.Cursor) {
			this.sim.recalculateUpgradePriceCursorScale(); 
		}
	}

	reset(): void {
		this.quantity = 0;
		this.level = 0;
		this.free = 0;
		this.multiplier = 1;
		this.synergies = [];
		this.perBuildingFlatCpcBoostCounter.clear();
		this.perBuildingFlatCpsBoostCounter.clear();
		this.buildingScaler.clear();
		this.scaleCounter.clear();
	}

	nthPrice(n: number): number {
		return Math.ceil(this.sim.buildingPriceScale * this.basePrice * Math.pow(1.15, Math.max(0, n - this.free)));
	}

	get price(): number {
		return this.nthPrice(this.quantity);
	}
	
	get cps(): number {
		// Level multiplier only gets added to total buildings, adding it to the individual cps will cause a mismatch
		return this.quantity * this.individualCps * this.levelMultiplier;
	}

	get individualCps(): number {
		return this.perBuildingFlatCpsBoostCounter.count(this.sim.buildings) + this.baseCps * (1 + this.scaleCounter.count(this.sim.buildings)) * this.synergyMultiplier * (1 + this.buildingScaler.count(this.sim.buildings)) * this.multiplier;
	}

	get levelMultiplier(): number {
		return 1 + (this.level * 0.01);
	}

	get longName(): string {
		return this.name + " " + (this.quantity + 1);
	}

	get synergyMultiplier(): number {
		let scale = 1;
		for (let i = 0; i < this.synergies.length; ++i) {
			scale *= 1 + this.sim.buildings[this.synergies[i].index].quantity * this.synergies[i].scale;
		}
		return scale;
	}

	addSynergy(index, scale): void {
		this.synergies.push({ index, scale });
	}

	removeSynergy(index, scale): void {
		for (let i = this.synergies.length - 1; i >= 0; --i) {
			if (this.synergies[i].index == index && this.synergies[i].scale == scale) {
				this.synergies.splice(i, 1);
				return;
			}
		}
	}

	refundValue(index?: number): number {
		function refundAmount(n: number): number { 
			return Math.floor(this.nthPrice(n) * this.sim.buildingRefundRate); 
		}
	
		if (index) {
			return refundAmount(index);
		}
		let total: number = 0;
		for (let i = 0; i < this.quantity; ++i) 
			total += refundAmount(i);
		return total;
	}

	get matchErrors(): string[] {
		let errors: string[] = [];

		let gameObj = Game.ObjectsById[this.index];
		if (gameObj) {
			if (this.name != gameObj.name)
				errors.push("Building Name " + this.name + " does not match " + gameObj.name);			
			if (this.level != gameObj.level)
				errors.push("Building Level " + this.level + " does not match " + gameObj.level);
			if (!floatEqual(this.price, gameObj.getPrice()))
				errors.push("Building Cost " + this.name + " - Predicted: " + this.price + ", Actual: " + gameObj.getPrice());
			if (!floatEqual(this.individualCps, gameObj.cps(gameObj)))
				errors.push("Building CpS " + this.name + " - Predicted: " + this.individualCps + ", Actual: " + gameObj.cps(gameObj));
		} else {
			errors.push("Building Index " + this.index + " doesn't match any building.");
		}
		return errors;
	}
}
