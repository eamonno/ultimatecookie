//
// Dragon related stuff
//

class DragonAura extends Purchase {
	constructor(sim: Simulator, public index: number, public name: string) {
		super(sim);
	}

	get sacrificialBuildingIndex(): BuildingIndex {
		let index: BuildingIndex = -1;
		for (let i = 0; i < BuildingIndex.NumBuildings; ++i)
			if (this.sim.buildings[i].quantity > 0)
				index = i;
		return index;
	}

	get price(): number {
		let index: BuildingIndex = this.sacrificialBuildingIndex;
		return index == -1 ? 0 : this.sim.buildings[index].nthPrice(this.sim.buildings[index].quantity - 1);
	}

	get isAvailable(): boolean {
		const firstDragonAuraLevel = 5;
		if ((this.sim.dragonAura1 && this.sim.dragonAura1.index == this.index) || (this.sim.dragonAura2 && this.sim.dragonAura2.index == this.index))
			return false;
		return this.index >= this.sim.dragon.level - firstDragonAuraLevel;
	}

	purchase(): void {
		Game.dragonAura = this.index;
		let index: BuildingIndex = this.sacrificialBuildingIndex;
		if (index != -1) {
			Game.ObjectsById[index].sacrifice(1);
			this.sim.buildings[index].quantity--;
		}
		this.apply();
	}

	get benefit(): number {
		return this.replaceBenefit(this.sim.dragonAura1);
	}

	replaceBenefit(aura: DragonAura): number {
		if (aura == null) {
			return super.benefit;
		}
		if (!this.isApplied) {
			console.log("Error: evaluating replaceBenefit for aura that isn't applied " + this.name + ", " + aura.name);
		}
		let cps: number = this.sim.effectiveCps();
		aura.revoke();
		this.apply();
		let newCps: number = this.sim.effectiveCps();
		this.revoke();
		aura.apply();
		return newCps - cps;
	}

	get value(): number {
		// Override the minor benefit default for auras
		return this.benefit;
	}

	get canBePurchased(): boolean {
		return this.index + 4 <= this.sim.dragon.level && !this.isApplied;
	}
}

class DragonLevel extends Purchase {
	constructor(public dragon: Dragon, public num: number, public name: string) {
		super(dragon.sim);
		this.addNestedBooster("dragon", "level", 1);
	}

	get isAvailable() {
		return this.sim.dragon.level == this.num;
	}

	get price(): number {
		if (this.num <= 4) {
			return 1000000 * Math.pow(2, this.num);
		} else if (this.num <= 4 + BuildingIndex.NumBuildings) {
			// Cost of 100 of a given building
			let cost: number = 0;
			let index: BuildingIndex = this.num - 4;
			for (let i = 1; i <= 100; ++i)
				cost += this.dragon.sim.buildings[index].nthPrice(this.dragon.sim.buildings[index].quantity - i);
			return cost * 0.5;	// 50% refund
		} else if (this.num == 5 + BuildingIndex.NumBuildings) {
			// 50 of each building
			let cost: number = 0;
			for (let index: BuildingIndex = 0; index < BuildingIndex.NumBuildings; ++index)
				for (let i = 1; i <= 50; ++i)
					cost += this.dragon.sim.buildings[index].nthPrice(this.dragon.sim.buildings[index].quantity - i);
			return cost * 0.5;	// 50% refund
		} else if (this.num == 6 + BuildingIndex.NumBuildings) {
			// 100 of each building 
			let cost: number = 0;
			for (let index: BuildingIndex = 0; index < BuildingIndex.NumBuildings; ++index)
				for (let i = 1; i <= 100; ++i)
					cost += this.dragon.sim.buildings[index].nthPrice(this.dragon.sim.buildings[index].quantity - i);
			return cost * 0.5;	// 50% refund
		} else {
			console.log("Invalid dragon level " + this.num + " " + this.name);
			return 0;
		}
	}

	get longName(): string {
		return "Dragon level " + this.num + " " + this.name;
	}

	purchase(): void {
		Game.specialTab = "dragon";
		Game.UpgradeDragon();
		if (this.num > 4) {
			if (this.num <= 4 + BuildingIndex.NumBuildings) {
				// Cost of 100 of a given building
				this.sim.buildings[this.num - 5].quantity -= 100;
			} else if (this.num == 5 + BuildingIndex.NumBuildings) {
				// 50 of each building 
				for (let building of this.sim.buildings)
					building.quantity -= 50;
			} else if (this.num == 6 + BuildingIndex.NumBuildings) {
				// 100 of each building 
				for (let building of this.sim.buildings)
					building.quantity -= 100;
			}
		}
		this.apply();
	}
}

class Dragon {
	level: number
	levels: DragonLevel[] = []

	constructor(public sim: Simulator) {
		this.levels = [];

		let dragon = this;
		function level(num, name) {
			let level =  new DragonLevel(dragon, num, name)
			dragon.levels[num] = level;
			return level;
		}

		// Declare all the levels
		for (let i = 0; i < 3; ++i)
			level(i, "Dragon egg");
		level(3, "Shivering dragon egg");
		for (let i = 4; i < 7; ++i)
			level(i, "Krumblor, cookie hatchling");
		for (let i = 7; i < 22; ++i)
			level(i, "Krumblor, cookie dragon");
		
		this.reset();
	}

	get canBeLeveled(): boolean {
		return Game.Has('A crumbly egg') && Game.dragonLevel <= 4;
	}

	get nextLevel(): DragonLevel {
		return this.levels[this.level];
	}

	reset() {
		this.level = 0;
	}
}
