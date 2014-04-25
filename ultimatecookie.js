//
// TO-DO List
//
// Adjust for the AutoBuy delay in the autobuy function for very high reset regen rates
// Implement a proper click rate function
// Add a version check
//

function UltimateCookie() {
	this.AUTO_CLICK_DELAY = 1;
	this.AUTO_BUY_DELAY = 1000;
	this.DEBUG_VERIFY = true;

	this.enable();
}

UltimateCookie.prototype.enable = function() {
	this.autoClicker = setInterval(Game.ClickCookie, this.AUTO_CLICK_DELAY);
	this.autoBuyer = setInterval(AutoBuy, this.AUTO_BUY_DELAY);
}

UltimateCookie.prototype.disable = function() {
	clearInterval(this.autoClicker);
	clearInterval(this.autoBuyer);
}

UltimateCookie.prototype.timeToBuy = function(cps, a, b) {
	return a.getCost() / cps + b.getCost() / (cps + a.getCps());
}

UltimateCookie.prototype.createPurchaseList = function() {
	var purchases = new Array();

	// Add the buildings
	var i;
	for (i = 0; i < Game.ObjectsById.length; ++i) {
		purchases.push(new PurchasableBuilding(Game.ObjectsById[i]));
	}

	// Add the upgrades
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		purchases.push(new PurchasableUpgrade(Game.UpgradesInStore[i]));
	}

	return purchases;
}

UltimateCookie.prototype.determineNextPurchase = function() {

	var purchases = this.createPurchaseList();
	var next = purchases[0];
	var cps = this.effectiveCps();

	var i;
	for (i = 1; i < purchases.length; ++i) {
		if (this.timeToBuy(cps, next, purchases[i]) > this.timeToBuy(cps, purchases[i], next)) {
			next = purchases[i];
		}
	}

	if (this.lastDeterminedPurchase == undefined) {
		this.lastDeterminedPurchase == "";
	}

	if (next.toString() != this.lastDeterminedPurchase) {
		this.lastDeterminedPurchase = next.toString();
		console.log("Next purchase: " + this.lastDeterminedPurchase);
		if (this.DEBUG_VERIFY) {
			var e = new Evaluator();
			e.syncToGame();
			if (!e.matchesGame()) {
				ultimateCookie.disable();
			}
		}
	}

	return next;
}

UltimateCookie.prototype.autoBuy = function() {
	var nextPurchase = this.determineNextPurchase();

	if (Game.cookies > nextPurchase.getCost()) {
		nextPurchase.purchase();
	}
}

UltimateCookie.prototype.effectiveCps = function() {
	// Assume 250 clicks per second
	return Game.cookiesPs + this.clickRate() * Game.mouseCps();
}

UltimateCookie.prototype.clickRate = function() {
	// Assume 250 clicks per second for now
	return 250;
}

//
// Class used to represent a particular building type for the cost Evaluator
//

function EvaluatorBuilding(baseCost, baseCps, name) {
	this.baseCost = baseCost;
	this.baseCps = baseCps;
	this.name = name;
	this.quantity = 0;
	this.multiplier = 1;
}

EvaluatorBuilding.prototype.getCps = function() {
	return this.quantity * this.baseCps * this.multiplier;
}

EvaluatorBuilding.prototype.getCost = function() {
	return Math.ceil(this.baseCost * Math.pow(1.15, this.quantity));
}

//
// Cost Evaluator, used to determine upgrade paths
//

function Evaluator() {
	this.buildings = new Array();
	this.buildings.push(new EvaluatorBuilding(         15,        0.1, "Cursor"));
	this.buildings.push(new EvaluatorBuilding(        100,        0.5, "Grandma"));
	this.buildings.push(new EvaluatorBuilding(        500,        4.0, "Farm"));
	this.buildings.push(new EvaluatorBuilding(       3000,       10.0, "Factory"));
	this.buildings.push(new EvaluatorBuilding(      10000,       40.0, "Mine"));
	this.buildings.push(new EvaluatorBuilding(      40000,      100.0, "Shipment"));
	this.buildings.push(new EvaluatorBuilding(     200000,      400.0, "Alchemy lab"));
	this.buildings.push(new EvaluatorBuilding(    1666666,      666.0, "Portal"));
	this.buildings.push(new EvaluatorBuilding(  123456789,    98765.0, "Time Machine"));
	this.buildings.push(new EvaluatorBuilding( 3999999999,   999999.0, "Antimatter condenser"));
	this.buildings.push(new EvaluatorBuilding(75000000000, 10000000.0, "Prism"));

	this.cpcBase = 1;
	this.cpcMultiplier = 1;
}

Evaluator.prototype.getCpc = function() {
	return this.cpcBase * this.cpcMultiplier;
}

//
// Check that the values in the evaluator match those of the game, for debugging use
//
Evaluator.prototype.matchesGame = function() {
	// Check that Cps matches the game
	if (this.getCps() != Game.cookiesPs) {
		console.log("Evaluator Error - Predicted Cps: " + this.getCps() + ", Actual Cps: " + Game.cookiesPs);
		return false;
	}
	// Check the Cpc matches the game
	if (this.getCpc() != Game.mouseCps()) {
		console.log("Evaluator Error - Predicted Cpc: " + this.getCpc() + ", Actual Cpc: " + Game.mouseCps());
		ultimateCookie.disable();
		return false;
	}
	// Check the building costs match the game
	var i;
	for (i = 0; i < this.buildings.length; ++i) {
		if (this.buildings[i].getCost() != Game.ObjectsById[i].getPrice()) {
			console.log("Evaluator Error - Predicted Building Cost: " + this.buildings[i].getCost() + ", Actual Cost: " + Game.ObjectsById[i].getPrice());
			ultimateCookie.disable();
			return false;
		}
	}
	// Default all is fine
	return true;
}

//
// Calculate the total Cps generated by the game in this state
//
Evaluator.prototype.getCps = function() {
	var i;
	var cps = 0;
	for (i = 0; i < this.buildings.length; ++i) {
		cps += this.buildings[i].getCps();
	}
	return cps;
}

//
// Calculate the effective Cps at the current games click rate
//
Evaluator.prototype.getEffectiveCps = function() {
	return this.getCps() + this.getCpc() * ultimateCookie.clickRate();
}

//
// Sync an evaluator with the current in game store
//
Evaluator.prototype.syncToGame = function() {
	var i;
	for (i = 0; i < Game.ObjectsById.length && i < this.buildings.length; ++i) {
		this.buildings[i].quantity = Game.ObjectsById[i].amount;
	}
	for (i = 0; i < Game.UpgradesById.length; ++i) {
		if (Game.UpgradesById[i].bought == 1) {
			upgradeInfo.getUpgradeFunction(Game.UpgradesById[i]).upgradeEval(this);
		}
	}
}

//
// Class to represent buildings for cost and buy order evaluation
//

function PurchasableBuilding(building) {
	this.building = building;
}

PurchasableBuilding.prototype.toString = function() {
	return "Building: " + this.building.displayName + " " + (this.building.amount + 1);
}

PurchasableBuilding.prototype.getCost = function() {
	return this.building.getPrice();
}

PurchasableBuilding.prototype.getCps = function() {
	return this.building.cps();
}

PurchasableBuilding.prototype.purchase = function() {
	this.building.buy(1);
}

//
// Class to represent upgrades for cost and buy order evaluation
//

function BuildingBaseCpsUpgrade(index, amount) {
	this.index = index;
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.buildings[this.index].baseCps += this.amount;
	}
}

// Upgrades that double the CPS of a building type
function BuildingDoublerUpgrade(index) {
	this.index = index;
	this.upgradeEval = function(eval) {
		eval.buildings[this.index].multiplier *= 2;
	}
}

// Upgrades that double the CPS of clicking
function ClickDoublerUpgrade() {
	this.upgradeEval = function(eval) {
		eval.cpcMultiplier = eval.cpcMultiplier * 2;
	}
}

// Upgrades that base CPC of clicking
function ClickBaseUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.cpcBase += this.amount;
	}
}

// Upgrades that combine the effects of two or more other upgrade types
function ComboUpgrade(upgrades) {
	this.upgrades = upgrades;
	this.upgradeEval = function(eval) {
		var i;
		for (i = 0; i < this.upgrades.length; ++i) {
			this.upgrades[i].upgradeEval(eval);
		}
	}
}

// Unhandled upgrade type, set to 0 cps so basically never bought automatically
function UnknownUpgrade(name) {
	console.log("Unknown Upgrade: " + name);
	this.upgradeEval = function(eval) {
	}
}

function UpgradeInfo() {
	// Index into the Game.ObjectsByID array
	this.CURSOR_INDEX = 0;
	this.GRANDMA_INDEX = 1;
	this.FARM_INDEX = 2;
	this.FACTORY_INDEX = 3;

//	this.buildingMultipliers = new Array(Game.ObjectsById.length);

	// Base CPS upgrades are those that adjust the base CPS of a building
//	this.baseCpsUpgrades = new Array();
//	this.baseCpsUpgrades.push([this.GRANDMA_INDEX, 0.3, "Forwards from grandma"]);
//	this.baseCpsUpgrades.push([this.FARM_INDEX, 1.0, ]);
//	this.baseCpsUpgrades.push([this.FACTORY_INDEX, 4.0, "Sturdier conveyor belts"]);

	// Create the array of known Upgrade functions
	this.upgradeFunctions = {};

//	// Base CpS upgrades increase the base cps of a building
//	this.upgradeFunctions["Cheap hoes"] = new BaseCpsUpgrade(this.FARM_INDEX, 4, 1);

	// Doubler Upgrades are those that double the productivity of a type of building
//	this.upgradeFunctions["Steel-plated rolling pins"] = new DoublerUpgrade(this.GRANDMA_INDEX);
//	this.upgradeFunctions["Lubricated dentures"] = new DoublerUpgrade(this.GRANDMA_INDEX);
//	this.upgradeFunctions["Fertilizer"] = new DoublerUpgrade(this.FARM_INDEX);

	// Combo upgrades, combine a couple of effects
	this.upgradeFunctions["Reinforced index finger"] = new ComboUpgrade([
		new BuildingBaseCpsUpgrade(this.CURSOR_INDEX, 0.1),
		new ClickBaseUpgrade(1)
	]);
	this.upgradeFunctions["Carpal tunnel prevention cream"] = new ComboUpgrade([
		new BuildingDoublerUpgrade(this.CURSOR_INDEX),
		new ClickDoublerUpgrade()
	]);
//	this.upgradeFunctions["Ambidextrous"] = new ComboUpgrade([
//		new DoublerUpgrade(this.CURSOR_INDEX),
//		new ClickDoublerUpgrade()
//	]);
}

UpgradeInfo.prototype.getUpgradeFunction = function(upgrade) {
	if (this.upgradeFunctions[upgrade.name] == undefined) {
		this.upgradeFunctions[upgrade.name] = new UnknownUpgrade(upgrade.name);
	}
	return this.upgradeFunctions[upgrade.name];
}

//
// Class to represent an individual purchasable upgrade
//

function PurchasableUpgrade(upgrade) {
	this.upgrade = upgrade;
	this.upgradeFunction = upgradeInfo.getUpgradeFunction(upgrade);
}

PurchasableUpgrade.prototype.toString = function() {
	return "Upgrade: " + this.upgrade.name;
}

PurchasableUpgrade.prototype.getCost = function() {
	return this.upgrade.getPrice();
}

PurchasableUpgrade.prototype.purchase = function() {
	this.upgrade.buy(0);
}

PurchasableUpgrade.prototype.getCps = function() {
	var e = new Evaluator();
	e.syncToGame();
	var ecps = e.getEffectiveCps();
	this.upgradeFunction.upgradeEval(e);

	if (!this.upgradeFunction instanceof UnknownUpgrade) {
		console.log("Upgrade: " + this.upgrade.name + ", cps: " + (e.getEffectiveCps() - ecps));
	}
	return e.getEffectiveCps() - ecps;
}

var upgradeInfo = new UpgradeInfo();
var ultimateCookie = new UltimateCookie();

function AutoBuy() { ultimateCookie.autoBuy(); }
