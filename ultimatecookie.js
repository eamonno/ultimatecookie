// To-do
// Figure out how to get AutoBuy as a member of the UltimateCookie

//
// UltimateCookie represents the app itself
//

function UltimateCookie() {
	this.AUTO_CLICK_DELAY = 1;
	this.AUTO_BUY_DELAY = 50;
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
	return Math.max(a.getCost() / cps + b.getCost() / (cps + a.getCpsGain()), this.AUTO_BUY_DELAY * 0.001);
}

UltimateCookie.prototype.createPurchaseList = function() {
	var purchases = new Array();

	// Add the buildings
	var i;
	for (i = 0; i < Game.ObjectsById.length; ++i) {
		purchases.push(new PurchasableBuilding(Game.ObjectsById[i].id));
	}

	// Add the upgrades
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		purchases.push(new PurchasableUpgrade(Game.UpgradesInStore[i].id));
	}

	return purchases;
}

// Work out what the optimal next purchase is
UltimateCookie.prototype.determineNextPurchase = function() {

/*
	var e = new Evaluator();
	e.syncToGame();
	var ecps = e.getEffectiveCps();
	this.upgradeFunction.upgradeEval(e);

//	if ((this.upgradeFunction instanceof UnknownUpgrade) == false) {
//		console.log("Upgrade: " + this.upgrade.name + ", cps: " + (e.getEffectiveCps() - ecps));
//	}
	return e.getEffectiveCps() - ecps;
*/
	var purchases = this.createPurchaseList();
	var next = purchases[0];
	var cps = this.effectiveCps();

	var i;
	for (i = 1; i < purchases.length; ++i) {
		var tba = this.timeToBuy(cps, next, purchases[i]);
		var tbb = this.timeToBuy(cps, purchases[i], next);
		if (tba > tbb || (tba == tbb && next.getCpsGain() < purchases[i].getCpsGain())) {
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

EvaluatorBuilding.prototype.clone = function() {
	var eb = new EvaluatorBuilding();
	eb.baseCost = this.baseCost;
	eb.baseCps = this.baseCps;
	eb.name = this.name;
	eb.quantity = this.quantity;
	eb.multiplier = this.multiplier;
	return eb;
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
	// Buildings
	this.buildings = new Array();
	this.buildings.push(new EvaluatorBuilding(         15,        0.1));	// Cursor
	this.buildings.push(new EvaluatorBuilding(        100,        0.5));	// Grandma
	this.buildings.push(new EvaluatorBuilding(        500,        4.0));	// Farm
	this.buildings.push(new EvaluatorBuilding(       3000,       10.0));	// Factory
	this.buildings.push(new EvaluatorBuilding(      10000,       40.0));	// Mine
	this.buildings.push(new EvaluatorBuilding(      40000,      100.0));	// Shipment
	this.buildings.push(new EvaluatorBuilding(     200000,      400.0));	// Alchemy lab
	this.buildings.push(new EvaluatorBuilding(    1666666,     6666.0));	// Portal
	this.buildings.push(new EvaluatorBuilding(  123456789,    98765.0));	// Time Machine
	this.buildings.push(new EvaluatorBuilding( 3999999999,   999999.0));	// Antimatter condenser
	this.buildings.push(new EvaluatorBuilding(75000000000, 10000000.0));	// Prism

	// Mouse click information
	this.cpcBase = 1;
	this.cpcMultiplier = 1;
	this.cpcCpsMultiplier = 0;

	// Production multiplier
	this.productionMultiplier = 0;

	// Heavenly chips
	this.heavenlyChips = 0;
	this.heavenlyUnlock = 0;

	// Milk scaling
	this.milkAmount = 0;
	this.milkMultipliers = new Array();
}

// Create a clone of an Evaluator
Evaluator.prototype.clone = function() {
	Evaluator e = new Evaluator();
	var i;
	for (i = 0; i < this.buildings.length; ++i) {
		e.buildings[i] = this.buildings[i].clone();
	}
	e.cpcBase = this.cpcBase;
	e.cpcMultiplier = this.cpcMultiplier;
	e.cpcCpsMultiplier = this.cpcCpsMultiplier;
	e.productionMultiplier = this.productionMultiplier;
	e.heavenlyChips = this.heavenlyChips;
	e.heavenlyUnlock = this.heavenlyUnlock;
	e.milkAmount = this.milkAmount;
	e.milkMultipliers = this.milkMultipliers;
	return e;
}

Evaluator.prototype.getCpc = function() {
	return this.cpcBase * this.cpcMultiplier + this.getCps() * this.cpcCpsMultiplier;
}

//
// Check that the values in the evaluator match those of the game, for debugging use
//
Evaluator.prototype.matchesGame = function() {
	// Check that Cps matches the game
	if (!floatEqual(this.getCps(), Game.cookiesPs)) {
		console.log("Evaluator Error - Predicted Cps: " + this.getCps() + ", Actual Cps: " + Game.cookiesPs);
		return false;
	}
	// Check the Cpc matches the game
	if (!floatEqual(this.getCpc(), Game.mouseCps())) {
		console.log("Evaluator Error - Predicted Cpc: " + this.getCpc() + ", Actual Cpc: " + Game.mouseCps());
		ultimateCookie.disable();
		return false;
	}
	// Check the building costs match the game
	var i;
	for (i = 0; i < this.buildings.length; ++i) {
		if (!floatEqual(this.buildings[i].getCost(), Game.ObjectsById[i].getPrice())) {
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
	var productionScale = this.productionMultiplier * 0.01;
	var heavenlyScale = this.heavenlyChips * this.heavenlyUnlock * 0.02;
	var milkScale = 1;
	for (i = 0; i < this.milkMultipliers.length; ++i) {
		milkScale *= (1 + this.milkMultipliers[i] * this.milkAmount * 0.01);
	}
	return cps * (1 + productionScale + heavenlyScale) * milkScale;
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
	this.heavenlyChips = Game.prestige['Heavenly chips'];
	this.milkAmount = Game.AchievementsOwned * 4;
}

//
// Classes to represent upgrades purely for use in Emulator calculations
//

// Upgrade representing buying one of a building type
function BuildingUpgrade(index) {
	this.index = index;
	this.upgradeEval = function(eval) {
		eval.buildings[this.index].quantity += 1;
	}
}

// Upgrades that increase the base Cps of a building by a certain amount
function BuildingBaseCpsUpgrade(index, amount) {
	this.index = index;
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.buildings[this.index].baseCps += this.amount;
	}
}

// Upgrades that double the CPS of a building type
function BuildingMultiplierUpgrade(index, scale) {
	this.index = index;
	this.scale = scale;
	this.upgradeEval = function(eval) {
		eval.buildings[this.index].multiplier *= scale;
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

// Upgrades that base CPC of clicking
function ClickCpsUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.cpcCpsMultiplier += this.amount;
	}
}

// Upgrades that increase cookie production
function ProductionUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.productionMultiplier += this.amount;
	}
}

// Upgrades that provide a bonus scaling from milk
function MilkUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.milkMultipliers.push(this.amount);
		eval.milkMultipliers.sort();
	}
}

// Upgrades that unlock heavenly chip potential
function HeavenlyUnlockUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.heavenlyUnlock += this.amount;
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
	this.MINE_INDEX = 4;
	this.SHIPMENT_INDEX = 5;
	this.ALCHEMY_LAB_INDEX = 6;
	this.PORTAL_INDEX = 7;
	this.TIME_MACHINE_INDEX = 8;
	this.ANTIMATTER_CONDENSER_INDEX = 9;
	this.PRISM_INDEX = 10;

	// Create the array of known Upgrade functions
	this.upgradeFunctions = {};

	// Building upgrade functions
	this.upgradeFunctions["Cursor"] = new BuildingUpgrade(this.CURSOR_INDEX);
	this.upgradeFunctions["Grandma"] = new BuildingUpgrade(this.GRANDMA_INDEX);
	this.upgradeFunctions["Farm"] = new BuildingUpgrade(this.FARM_INDEX);
	this.upgradeFunctions["Factory"] = new BuildingUpgrade(this.FACTORY_INDEX);
	this.upgradeFunctions["Mine"] = new BuildingUpgrade(this.MINE_INDEX);
	this.upgradeFunctions["Shipment"] = new BuildingUpgrade(this.SHIPMENT_INDEX);
	this.upgradeFunctions["Alchemy lab"] = new BuildingUpgrade(this.ALCHEMY_LAB_INDEX);
	this.upgradeFunctions["Portal"] = new BuildingUpgrade(this.PORTAL_INDEX);
	this.upgradeFunctions["Time machine"] = new BuildingUpgrade(this.TIME_MACHINE_INDEX);
	this.upgradeFunctions["Antimatter condenser"] = new BuildingUpgrade(this.ANTIMATTER_CONDENSER_INDEX);
	this.upgradeFunctions["Prism"] = new BuildingUpgrade(this.PRISM_INDEX);

	// Base CpS upgrades increase the base cps of a building
	this.upgradeFunctions["Forwards from grandma"] = new BuildingBaseCpsUpgrade(this.GRANDMA_INDEX, 0.3);
	this.upgradeFunctions["Cheap hoes"] = new BuildingBaseCpsUpgrade(this.FARM_INDEX, 1);
	this.upgradeFunctions["Sturdier conveyor belts"] = new BuildingBaseCpsUpgrade(this.FACTORY_INDEX, 4);
	this.upgradeFunctions["Sugar gas"] = new BuildingBaseCpsUpgrade(this.MINE_INDEX, 10);
	this.upgradeFunctions["Vanilla nebulae"] = new BuildingBaseCpsUpgrade(this.SHIPMENT_INDEX, 30);
	this.upgradeFunctions["Antimony"] = new BuildingBaseCpsUpgrade(this.ALCHEMY_LAB_INDEX, 100);
	this.upgradeFunctions["Ancient tablet"] = new BuildingBaseCpsUpgrade(this.PORTAL_INDEX, 1666);
	this.upgradeFunctions["Flux capacitors"] = new BuildingBaseCpsUpgrade(this.TIME_MACHINE_INDEX, 9876);
	this.upgradeFunctions["Sugar bosons"] = new BuildingBaseCpsUpgrade(this.ANTIMATTER_CONDENSER_INDEX, 99999);
	this.upgradeFunctions["Gem polish"] = new BuildingBaseCpsUpgrade(this.PRISM_INDEX, 1000000);

	// Doubler Upgrades are those that double the productivity of a type of building
	this.upgradeFunctions["Steel-plated rolling pins"] =
	this.upgradeFunctions["Lubricated dentures"] =
	this.upgradeFunctions["Farmer grandmas"] =
	this.upgradeFunctions["Worker grandmas"] =
	this.upgradeFunctions["Miner grandmas"] =
	this.upgradeFunctions["Cosmic grandmas"] =
	this.upgradeFunctions["Prune juice"] =
	this.upgradeFunctions["Transmuted grandmas"] =
	this.upgradeFunctions["Double-thick glasses"] =
	this.upgradeFunctions["Altered grandmas"] =
	this.upgradeFunctions["Grandmas' grandmas"] =
	this.upgradeFunctions["Antigrandmas"] =
	this.upgradeFunctions["Rainbow grandmas"] =
	this.upgradeFunctions["Aging agents"] = new BuildingMultiplierUpgrade(this.GRANDMA_INDEX, 2);
	this.upgradeFunctions["Fertilizer"] =
	this.upgradeFunctions["Cookie trees"] =
	this.upgradeFunctions["Genetically-modified cookies"] =
	this.upgradeFunctions["Gingerbread scarecrows"] = new BuildingMultiplierUpgrade(this.FARM_INDEX, 2);
	this.upgradeFunctions["Child labor"] =
	this.upgradeFunctions["Sweatshop"] =
	this.upgradeFunctions["Radium reactors"] =
	this.upgradeFunctions["Recombobulators"] = new BuildingMultiplierUpgrade(this.FACTORY_INDEX, 2);
	this.upgradeFunctions["Megadrill"] =
	this.upgradeFunctions["Ultradrill"] =
	this.upgradeFunctions["Ultimadrill"] =
	this.upgradeFunctions["H-bomb mining"] = new BuildingMultiplierUpgrade(this.MINE_INDEX, 2);
	this.upgradeFunctions["Wormholes"] =
	this.upgradeFunctions["Frequent flyer"] =
	this.upgradeFunctions["Warp drive"] =
	this.upgradeFunctions["Chocolate monoliths"] =
	this.upgradeFunctions["Generation ship"] = new BuildingMultiplierUpgrade(this.SHIPMENT_INDEX, 2);
	this.upgradeFunctions["Essence of dough"] =
	this.upgradeFunctions["True chocolate"] =
	this.upgradeFunctions["Ambrosia"] =
	this.upgradeFunctions["Aqua crustulae"] =
	this.upgradeFunctions["Origin crucible"] = new BuildingMultiplierUpgrade(this.ALCHEMY_LAB_INDEX, 2);
	this.upgradeFunctions["Insane oatling workers"] =
	this.upgradeFunctions["Soul bond"] =
	this.upgradeFunctions["Sanity dance"] =
	this.upgradeFunctions["Brane transplant"] =
	this.upgradeFunctions["Deity-sized portals"] = new BuildingMultiplierUpgrade(this.PORTAL_INDEX, 2);
	this.upgradeFunctions["Time paradox resolver"] =
	this.upgradeFunctions["Quantum conundrum"] =
	this.upgradeFunctions["Causality enforcer"] =
	this.upgradeFunctions["Yestermorrow comparators"] = new BuildingMultiplierUpgrade(this.TIME_MACHINE_INDEX, 2);
	this.upgradeFunctions["String theory"] =
	this.upgradeFunctions["Large macaron collider"] =
	this.upgradeFunctions["Big bang bake"] =
	this.upgradeFunctions["Reverse cyclotrons"] = new BuildingMultiplierUpgrade(this.ANTIMATTER_CONDENSER_INDEX, 2);
	this.upgradeFunctions["9th color"] =
	this.upgradeFunctions["Chocolate light"] =
	this.upgradeFunctions["Grainbow"] =
	this.upgradeFunctions["Pure cosmic light"] = new BuildingMultiplierUpgrade(this.PRISM_INDEX, 2);

	// Cookie production multipliers
	this.upgradeFunctions["Sugar cookies"] =
	this.upgradeFunctions["Peanut butter cookies"] =
	this.upgradeFunctions["Plain cookies"] =
	this.upgradeFunctions["Oatmeal raisin cookies"] =
	this.upgradeFunctions["Coconut cookies"] =
	this.upgradeFunctions["White chocolate cookies"] =
	this.upgradeFunctions["Macadamia nut cookies"] = new ProductionUpgrade(5);
	this.upgradeFunctions["White chocolate macadamia nut cookies"] =
	this.upgradeFunctions["Double-chip cookies"] =
	this.upgradeFunctions["All-chocolate cookies"] = new ProductionUpgrade(10);
	this.upgradeFunctions["White chocolate-coated cookies"] =
	this.upgradeFunctions["Dark chocolate-coated cookies"] =
	this.upgradeFunctions["Eclipse cookies"] =
	this.upgradeFunctions["Zebra cookies"] =
	this.upgradeFunctions["Snickerdoodles"] =
	this.upgradeFunctions["Stroopwafels"] =
	this.upgradeFunctions["Macaroons"] = new ProductionUpgrade(15);
	this.upgradeFunctions["Palets"] =
	this.upgradeFunctions["Sabl&eacute;s"] =
	this.upgradeFunctions["Madeleines"] =
	this.upgradeFunctions["Palmiers"] = new ProductionUpgrade(20);
	this.upgradeFunctions["Shortfoils"] =
	this.upgradeFunctions["Fig gluttons"] =
	this.upgradeFunctions["Loreols"] =
	this.upgradeFunctions["Jaffa cakes"] =
	this.upgradeFunctions["Grease's cups"] =
	this.upgradeFunctions["Sagalongs"] =
	this.upgradeFunctions["Win mints"] =
	this.upgradeFunctions["Caramoas"] =
	this.upgradeFunctions["Gingerbread trees"] =
	this.upgradeFunctions["Gingerbread men"] = new ProductionUpgrade(25);
	this.upgradeFunctions["Rose macarons"] =
	this.upgradeFunctions["Lemon macarons"] =
	this.upgradeFunctions["Chocolate macarons"] =
	this.upgradeFunctions["Pistachio macarons"] =
	this.upgradeFunctions["Hazelnut macarons"] =
	this.upgradeFunctions["Violet macarons"] = new ProductionUpgrade(30);

	// Research upgrade functions
	this.upgradeFunctions["Bingo center/Research facility"] = new BuildingMultiplierUpgrade(this.GRANDMA_INDEX, 4);

	// Combo upgrades, combine a couple of effects
	this.upgradeFunctions["Reinforced index finger"] = new ComboUpgrade([
		new BuildingBaseCpsUpgrade(this.CURSOR_INDEX, 0.1),
		new ClickBaseUpgrade(1)
	]);

	// Mouse and Cursor Doublers
	this.upgradeFunctions["Carpal tunnel prevention cream"] =
	this.upgradeFunctions["Ambidextrous"] = new ComboUpgrade([
		new BuildingMultiplierUpgrade(this.CURSOR_INDEX, 2),
		new ClickDoublerUpgrade()
	]);

	// Clicking gains a percent of CpS
	this.upgradeFunctions["Plastic mouse"] =
	this.upgradeFunctions["Iron mouse"] =
	this.upgradeFunctions["Titanium mouse"] =
	this.upgradeFunctions["Adamantium mouse"] =
	this.upgradeFunctions["Unobtainium mouse"] =
	this.upgradeFunctions["Eludium mouse"] =
	this.upgradeFunctions["Wishalloy mouse"] = new ClickCpsUpgrade(0.01);

	// Milk upgrades
	this.upgradeFunctions["Kitten helpers"] = new MilkUpgrade(0.05);
	this.upgradeFunctions["Kitten workers"] = new MilkUpgrade(0.1);
	this.upgradeFunctions["Kitten engineers"] =
	this.upgradeFunctions["Kitten overseers"] =
	this.upgradeFunctions["Kitten managers"] = new MilkUpgrade(0.2);

	// Heavenly chip unlocks
	this.upgradeFunctions["Heavenly chip secret"] = new HeavenlyUnlockUpgrade(0.05);
	this.upgradeFunctions["Heavenly cookie stand"] = new HeavenlyUnlockUpgrade(0.20);
	this.upgradeFunctions["Heavenly bakery"] =
	this.upgradeFunctions["Heavenly confectionery"] =
	this.upgradeFunctions["Heavenly key"] = new HeavenlyUnlockUpgrade(0.25);
}

UpgradeInfo.prototype.getUpgradeFunction = function(upgrade) {
	if (this.upgradeFunctions[upgrade.name] == undefined) {
		this.upgradeFunctions[upgrade.name] = new UnknownUpgrade(upgrade.name);
	}
	return this.upgradeFunctions[upgrade.name];
}

//
// Classes to represent upgrades and tie them to game purchases
//

// Building purchase
function PurchasableBuilding(index) {
	this.index = index;
	this.upgradeFunction = upgradeInfo.getUpgradeFunction(Game.ObjectsById[this.index].name);
}

PurchasableBuilding.prototype.toString = function() {
	return "Building: " + Game.ObjectsById[this.index].name + " " + (Game.ObjectsById[this.index].amount + 1);
}

PurchasableBuilding.prototype.getCost = function() {
	return Game.ObjectsById[this.index].getPrice();
}

PurchasableBuilding.prototype.purchase = function() {
	Game.ObjectsById[this.index].buy(1);
}

// Upgrade purchase
function PurchasableUpgrade(index) {
	this.index = index;
	this.upgradeFunction = upgradeInfo.getUpgradeFunction(Game.UpgradesById[this.index].name);
}

PurchasableUpgrade.prototype.toString = function() {
	return "Upgrade: " + Game.UpgradesById[this.index].name;
}

PurchasableUpgrade.prototype.getCost = function() {
	return Game.UpgradesById[this.index].getPrice();
}

PurchasableUpgrade.prototype.purchase = function() {
	Game.UpgradesById[this.index].buy(0);
}

//
// Utility stuff and starting the app off
//

// Compare floats with an epsilon value
function floatEqual(a, b) {
	var eps = Math.abs(a - b) * 100000000.0;
	return eps <= Math.abs(a) && eps <= Math.abs(b);
}

// Autobuy call back, should be part of the UltimateCookie class
// but not that important at present
function AutoBuy() { ultimateCookie.autoBuy(); }

// Create the upgradeInfo and Ultimate Cookie instances
var upgradeInfo = new UpgradeInfo();
var ultimateCookie = new UltimateCookie();

