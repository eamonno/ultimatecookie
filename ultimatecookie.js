// To-do
// Figure out how to get AutoBuy as a member of the UltimateCookie

//
// UltimateCookie represents the app itself
//

function UltimateCookie() {
	this.AUTO_CLICK_GOLDEN_COOKIES = true;
	this.AUTO_CLICK_DELAY = 1;
	this.AUTO_BUY_DELAY = 100;
	this.DEBUG_VERIFY = true;

	this.enableAutoBuy();
	this.enableAutoClick();
}

UltimateCookie.prototype.enableAutoBuy = function() {
	var t = this;
	this.autoBuyer = setInterval(function() { t.autoBuy(); }, this.AUTO_BUY_DELAY);
}

UltimateCookie.prototype.enableAutoClick = function() {
	var t = this;
	this.autoClicker = setInterval(function() { t.autoClick(); }, this.AUTO_CLICK_DELAY);
}

UltimateCookie.prototype.disableAutoBuy = function() {
	clearInterval(this.autoBuyer);
}

UltimateCookie.prototype.disableAutoClick = function() {
	clearInterval(this.autoClicker);
}

// Work out how long it would take to purchase a given array of upgrades
UltimateCookie.prototype.timeToBuy = function(evaluator, upgrades) {
	// Create a clone of the evaluator to avoid modifying the base
	var e = evaluator.clone();

	var timeTaken = 0;
	var i;
	for (i = 0; i < upgrades.length; ++i) {
		timeTaken += Math.max(upgrades[i].getCost() / e.getEffectiveCps(), this.AUTO_BUY_DELAY * 0.001);
		upgrades[i].upgradeFunction.upgradeEval(e);
	}
	return timeTaken;
}

// Work out how long it would take for a purchase to return on its cost
UltimateCookie.prototype.timeToBreakEven = function(evaluator, upgrade) {
	// Create a clone of the evaluator to avoid modifying the base
	var e = evaluator.clone();

	cps1 = e.getEffectiveCps();
	upgrade.upgradeFunction.upgradeEval(e);
	cps2 = e.getEffectiveCps();
	return upgrade.getCost() / (cps2 - cps1) + upgrade.getCost() / cps1;
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
	// Get a list of the current available purchases
	var purchases = this.createPurchaseList();

	// Get an Evaluator synced to the current game
	var currentGame = new Evaluator();
	currentGame.syncToGame();

	// Shutdown if out of sync
	if (this.DEBUG_VERIFY) {
		if (!currentGame.matchesGame()) {
			ultimateCookie.disableAutoBuy();
			console.log("Evaluator error: autoBuy disabled.");
		}
	}

	var next = purchases[0];
	var nextTime = this.timeToBreakEven(currentGame, next);

	for (i = 1; i < purchases.length; ++i) {
		var tp = this.timeToBreakEven(currentGame, purchases[i]);
		if (tp < nextTime) {
			nextTime = tp;
			next = purchases[i];
		}
	}

//	var cps = this.effectiveCps();
/*
	var i;
	for (i = 1; i < purchases.length; ++i) {
		var tba = this.timeToBuy(currentGame, [next, purchases[i]]);
		var tbb = this.timeToBuy(currentGame, [purchases[i], next]);
		if (tba > tbb) {
			next = purchases[i];
		}
	}
*/

	if (this.lastDeterminedPurchase == undefined) {
		this.lastDeterminedPurchase == "";
	}

	if (next.toString() != this.lastDeterminedPurchase) {
		this.lastDeterminedPurchase = next.toString();
		console.log("Next purchase: " + this.lastDeterminedPurchase);
	}

	return next;
}

UltimateCookie.prototype.autoClick = function() {
	if (this.AUTO_CLICK_GOLDEN_COOKIES) {
		if (Game.goldenCookie.life > 0 && Game.goldenCookie.toDie == 0) {
			Game.goldenCookie.click();
		}
	}
	Game.ClickCookie();
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

function EvaluatorBuilding(evaluator, baseCost, baseCps) {
	this.evaluator = evaluator;
	this.baseCost = baseCost;
	this.baseCps = baseCps;
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
	// Buildings
	this.buildings = new Array();
	this.buildings.push(new EvaluatorBuilding(this,         15,        0.1));	// Cursor
	this.buildings.push(new EvaluatorBuilding(this,        100,        0.5));	// Grandma
	this.buildings.push(new EvaluatorBuilding(this,        500,        4.0));	// Farm
	this.buildings.push(new EvaluatorBuilding(this,       3000,       10.0));	// Factory
	this.buildings.push(new EvaluatorBuilding(this,      10000,       40.0));	// Mine
	this.buildings.push(new EvaluatorBuilding(this,      40000,      100.0));	// Shipment
	this.buildings.push(new EvaluatorBuilding(this,     200000,      400.0));	// Alchemy lab
	this.buildings.push(new EvaluatorBuilding(this,    1666666,     6666.0));	// Portal
	this.buildings.push(new EvaluatorBuilding(this,  123456789,    98765.0));	// Time Machine
	this.buildings.push(new EvaluatorBuilding(this, 3999999999,   999999.0));	// Antimatter condenser
	this.buildings.push(new EvaluatorBuilding(this,75000000000, 10000000.0));	// Prism

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

	// Game status indicators
	this.frenzy = 0
	this.frenzyPower = 7;
	this.clickFrenzy = 0;
	this.clickFrenzyMultiplier = 777;
}

// Create a clone of an Evaluator
Evaluator.prototype.clone = function() {
	var e = new Evaluator();
	var i;
	// Clone buildings making sure to set the evaluator reference to the clone
	for (i = 0; i < this.buildings.length; ++i) {
		e.buildings[i] = new EvaluatorBuilding();
		e.buildings[i].evaluator = e;
		e.buildings[i].baseCost = this.buildings[i].baseCost;
		e.buildings[i].baseCps = this.buildings[i].baseCps;
		e.buildings[i].quantity = this.buildings[i].quantity;
		e.buildings[i].multiplier = this.buildings[i].multiplier;
	}
	e.cpcBase = this.cpcBase;
	e.cpcMultiplier = this.cpcMultiplier;
	e.cpcCpsMultiplier = this.cpcCpsMultiplier;
	e.productionMultiplier = this.productionMultiplier;
	e.heavenlyChips = this.heavenlyChips;
	e.heavenlyUnlock = this.heavenlyUnlock;
	e.milkAmount = this.milkAmount;
	e.milkMultipliers = this.milkMultipliers;
	e.frenzy = this.frenzy;
	e.frenzyMultiplier = this.frenzyMultiplier;
	e.clickFrenzy = this.clickFrenzy;
	e.clickFrenzyMultiplier = this.clickFrenzyMultiplier;
	return e;
}

// Check that the values in the evaluator match those of the game, for debugging use
Evaluator.prototype.matchesGame = function() {

	// Check that Cps matches the game
	if (!floatEqual(this.getCps(), Game.cookiesPs)) {
		console.log("Evaluator Error - Predicted Cps: " + this.getCps() + ", Actual Cps: " + Game.cookiesPs);
		return false;
	}
	// Check the Cpc matches the game
	if (!floatEqual(this.getCpc(), Game.mouseCps())) {
		console.log("Evaluator Error - Predicted Cpc: " + this.getCpc() + ", Actual Cpc: " + Game.mouseCps());
		return false;
	}
	// Check the building costs match the game
	var i;
	for (i = 0; i < this.buildings.length; ++i) {
		if (!floatEqual(this.buildings[i].getCost(), Game.ObjectsById[i].getPrice())) {
			console.log("Evaluator Error - Predicted Building Cost: " + this.buildings[i].getCost() + ", Actual Cost: " + Game.ObjectsById[i].getPrice());
			return false;
		}
	}
	// Default all is fine
	return true;
}

// Get the current cookies per click amount
Evaluator.prototype.getCpc = function() {
	var cpc = this.cpcBase * this.cpcMultiplier;	// Base cpc
	cpc += this.getCps() * this.cpcCpsMultiplier;	// Add in percentage click scaling
	if (this.clickFrenzy) {	// Increase if click frenzy is active
		cpc *= this.clickFrenzyMultiplier;
	}
	return cpc;
}

// Calculate the total Cps generated by the game in this state
Evaluator.prototype.getCps = function() {
	var i;
	// Get the cps from buildings
	var cps = 0;
	for (i = 0; i < this.buildings.length; ++i) {
		cps += this.buildings[i].getCps();
	}
	// Scale it for production and heavely chip multipliers
	var productionScale = this.productionMultiplier * 0.01;
	var heavenlyScale = this.heavenlyChips * this.heavenlyUnlock * 0.02;
	cps *= (1 + productionScale + heavenlyScale);
	// Scale it for milk
	var milkScale = 1;
	for (i = 0; i < this.milkMultipliers.length; ++i) {
		milkScale *= (1 + this.milkMultipliers[i] * this.milkAmount * 0.01);
	}
	cps *= milkScale;
	// Scale it for frenzy
	if (this.frenzy) {
		cps *= this.frenzyMultiplier;
	}
	return cps;
}

// Estimate the extra CpS contribution from collecting all golden cookies
// Assumes max click rate and that golden cookies just follow the simple pattern
// of Frenzy followed by Lucky. Not 100% accurate but near enough to give a decent
// estimation.
Evaluator.prototype.getGoldenCookieCps = function() {
	return 0;
}

// Calculate the effective Cps at the current games click rate
Evaluator.prototype.getEffectiveCps = function() {
	return this.getCps() + this.getCpc() * ultimateCookie.clickRate();
}

// Sync an evaluator with the current in game store
Evaluator.prototype.syncToGame = function() {
	var i;
	for (i = 0; i < Game.ObjectsById.length && i < this.buildings.length; ++i) {
		this.buildings[i].quantity = Game.ObjectsById[i].amount;
	}
	for (i = 0; i < Game.UpgradesById.length; ++i) {
		if (Game.UpgradesById[i].bought == 1) {
			upgradeInfo.getUpgradeFunction(Game.UpgradesById[i].name).upgradeEval(this);
		}
	}
	this.heavenlyChips = Game.prestige['Heavenly chips'];
	this.milkAmount = Game.AchievementsOwned * 4;
	this.frenzy = Game.frenzy;
	this.frenzyMultiplier = Game.frenzyPower;
	this.clickFrenzy = Game.clickFrenzy;
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

// Golden cookie upgrades
function GoldenCookieUpgrade(frequencyScale, durationScale) {
	this.frequencyScale = frequencyScale;
	this.durationScale = durationScale;
	this.upgradeEval = function(eval) {
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
	this.name = name;
	console.log("Unknown upgrade: " + name);
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
	this.upgradeFunctions["Gingerbread scarecrows"] =
	this.upgradeFunctions["Pulsar sprinklers"] = new BuildingMultiplierUpgrade(this.FARM_INDEX, 2);
	this.upgradeFunctions["Child labor"] =
	this.upgradeFunctions["Sweatshop"] =
	this.upgradeFunctions["Radium reactors"] =
	this.upgradeFunctions["Recombobulators"] =
	this.upgradeFunctions["Deep-bake process"] = new BuildingMultiplierUpgrade(this.FACTORY_INDEX, 2);
	this.upgradeFunctions["Megadrill"] =
	this.upgradeFunctions["Ultradrill"] =
	this.upgradeFunctions["Ultimadrill"] =
	this.upgradeFunctions["H-bomb mining"] =
	this.upgradeFunctions["Coreforge"] = new BuildingMultiplierUpgrade(this.MINE_INDEX, 2);
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
	//this.upgradeFunctions["Far future enactment"] - Should be last time machine upgrade, not working at present
	this.upgradeFunctions["String theory"] =
	this.upgradeFunctions["Large macaron collider"] =
	this.upgradeFunctions["Big bang bake"] =
	this.upgradeFunctions["Reverse cyclotrons"] =
	this.upgradeFunctions["Nanocosmics"] = new BuildingMultiplierUpgrade(this.ANTIMATTER_CONDENSER_INDEX, 2);
	this.upgradeFunctions["9th color"] =
	this.upgradeFunctions["Chocolate light"] =
	this.upgradeFunctions["Grainbow"] =
	this.upgradeFunctions["Pure cosmic light"] =
	this.upgradeFunctions["Glow-in-the-dark"] = new BuildingMultiplierUpgrade(this.PRISM_INDEX, 2);

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
	this.upgradeFunctions["Empire biscuits"] =
	this.upgradeFunctions["Macaroons"] =
	this.upgradeFunctions["British tea biscuits"] =
	this.upgradeFunctions["Chocolate british tea biscuits"] =
	this.upgradeFunctions["Round british tea biscuits"] =
	this.upgradeFunctions["Round chocolate british tea biscuits"] =
	this.upgradeFunctions["Round british tea biscuits with heart motif"] =
	this.upgradeFunctions["Round chocolate british tea biscuits with heart motif"] = new ProductionUpgrade(15);
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

	// Golden cookie upgrade functions
	this.upgradeFunctions["Lucky day"] =
	this.upgradeFunctions["Serendipity"] = new GoldenCookieUpgrade(2, 2);
	this.upgradeFunctions["Get lucky"] = new GoldenCookieUpgrade(1, 2);

	// Research upgrade functions
	this.upgradeFunctions["Bingo center/Research facility"] = new BuildingMultiplierUpgrade(this.GRANDMA_INDEX, 4);
	// this.upgradeFunctions["Persistent memory"] research speed upgrade
	this.upgradeFunctions["Specialized chocolate chips"] = new ProductionUpgrade(1);
	this.upgradeFunctions["Designer cocoa beans"] = new ProductionUpgrade(2);
	this.upgradeFunctions["Ritual rolling pins"] = new BuildingMultiplierUpgrade(this.GRANDMA_INDEX, 2);
	this.upgradeFunctions["Underworld ovens"] = new ProductionUpgrade(3);

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

UpgradeInfo.prototype.getUpgradeFunction = function(name) {
	if (this.upgradeFunctions[name] == undefined) {
		this.upgradeFunctions[name] = new UnknownUpgrade(name);
	}
	return this.upgradeFunctions[name];
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

// Create the upgradeInfo and Ultimate Cookie instances
var upgradeInfo = new UpgradeInfo();
var ultimateCookie = new UltimateCookie();

