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
	scales: number[] = new Array(BuildingIndex.NumBuildings).fill(0)

	clear() { 
		this.scales.fill(0);
	}

	getCount(buildings: Building[]): number {
		let count = 0;
		for (let i = 0; i < this.scales.length; ++i) {
			count += this.scales[i] * buildings[i].quantity;
		}
		return count;
	}

	addCounter(counter: BuildingCounter): BuildingCounter {
		for (let i = 0; i < this.scales.length; ++i) {
			this.scales[i] += counter.scales[i];
		}
		return this;
	}
	
	addCountOne(index: BuildingIndex, scale: number = 1): BuildingCounter {
		this.scales[index] += scale;
		return this;
	}
	
	addCountMost(excludes: BuildingIndex[], scale: number = 1): BuildingCounter {
		for (let i = 0; i < this.scales.length; ++i) {
			if (excludes.indexOf(i) == -1)
				this.scales[i] += scale;
		}
		return this;
	}
	
	subtractCounter(counter: BuildingCounter): BuildingCounter {
		for (let i = 0; i < this.scales.length; ++i) {
			this.scales[i] -= counter.scales[i];
		}
		return this;
	}
	
	subtractCountOne(index: BuildingIndex, scale: number = 1): BuildingCounter {
		return this.addCountOne(index, -scale);
	}
	
	subtractCountMost(excludes: BuildingIndex[], scale: number = 1): BuildingCounter {
		return this.addCountMost(excludes, -scale);
	}	
}
