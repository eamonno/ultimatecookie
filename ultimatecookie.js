// To-do
// Figure out how to get AutoBuy as a member of the UltimateCookie

var Constants = {};

// Interval delays for clicking and updates
Constants.CLICK_DELAY = 1;
Constants.UPDATE_DELAY = 50;

Constants.AUTO_CLICK = true;
Constants.AUTO_CLICK_GOLDEN_COOKIES = true;
Constants.AUTO_RESET = true;
Constants.AUTO_BUY = true;
Constants.AUTO_DISMISS_NOTES = true;

Constants.NOTE_DISMISS_DELAY = 10000;
Constants.RESET_LIMIT = 1.1;
Constants.DEBUG = true;

// Evaluator constants
Constants.FRENZY_MULTIPLIER = 7;			// Frenzy multiplies CpS by 7
Constants.CLICK_FRENZY_MULTIPLIER = 777;	// Click frenzies give 777x cookier per click
Constants.LUCKY_COOKIE_BANK_TIME = 1200;	// Lucky provides up to 1200 seconds of CpS based on bank
Constants.LUCKY_COOKIE_BONUS_TIME = 13;		// Lucky provides 13 additional seconds of CpS regardless

// Indices into the buildings arrays
Constants.CURSOR_INDEX = 0;
Constants.GRANDMA_INDEX = 1;
Constants.FARM_INDEX = 2;
Constants.FACTORY_INDEX = 3;
Constants.MINE_INDEX = 4;
Constants.SHIPMENT_INDEX = 5;
Constants.ALCHEMY_LAB_INDEX = 6;
Constants.PORTAL_INDEX = 7;
Constants.TIME_MACHINE_INDEX = 8;
Constants.ANTIMATTER_CONDENSER_INDEX = 9;
Constants.PRISM_INDEX = 10;

//
// UltimateCookie represents the app itself
//

function UltimateCookie() {
	var t = this;
	this.autoClicker = setInterval(function() { t.click(); }, Constants.CLICK_DELAY);
	this.autoUpdater = setInterval(function() { t.update(); }, Constants.UPDATE_DELAY);
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
	var purchases = [];

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

// Work out what the optimal next purchase is for a given evaluator
UltimateCookie.prototype.determineNextPurchase = function(eval) {
	// Get a list of the current available purchases
	var purchases = this.createPurchaseList();

	var next = purchases[0];
	var nextTime = this.timeToBreakEven(eval, next);

	for (i = 1; i < purchases.length; ++i) {
		var tp = this.timeToBreakEven(eval, purchases[i]);
		if (tp < nextTime) {
			nextTime = tp;
			next = purchases[i];
		}
	}

	// Autobuy the research speed upgrade before the first research item
	if (next.getName() == "Specialized chocolate chips") {
		for (i = 0; i < purchases.length; ++i) {
			if (purchases[i].getName() == "Persistent memory") {
				next = purchases[i];
			}
		}
	}

	// Nasty Elder Pledge hack for short term
	for (i = 0; i < purchases.length; ++i) {
		if (purchases[i].getName() == "Elder Pledge") {
			next = purchases[i];
		}
	}
	// Similarly nasty Sacrificial rolling pins autobuy
	for (i = 0; i < purchases.length; ++i) {
		if (purchases[i].getName() == "Sacrificial rolling pins") {
			next = purchases[i];
		}
	}

	if (this.lastDeterminedPurchase == undefined) {
		this.lastDeterminedPurchase == "";
	}

	if (next.toString() != this.lastDeterminedPurchase) {
		this.lastDeterminedPurchase = next.toString();
		//console.log("Next purchase: " + this.lastDeterminedPurchase);
	}

	return next;
}

UltimateCookie.prototype.click = function() {
	if (Constants.AUTO_CLICK) {
		Game.ClickCookie();
	}
}

UltimateCookie.prototype.update = function() {
	// Auto dismiss notes
	if (!Game.recalculateGains && Constants.AUTO_DISMISS_NOTES) {
		if (Game.Notes.length > 0) {
			if (new Date() - Game.Notes[0].date > Constants.NOTE_DISMISS_DELAY) {
				Game.CloseNote(Game.Notes[0].id);
			}
		}
	}
	// Auto click golden cookies
	if (!Game.recalculateGains && Constants.AUTO_CLICK_GOLDEN_COOKIES) {
		if (Game.goldenCookie.life > 0 && Game.goldenCookie.toDie == 0) {
			Game.goldenCookie.click();
		}
	}
	// Auto buy
	if (!Game.recalculateGains && Constants.AUTO_BUY) {
		// Get an Evaluator synced to the current game
		var currentGame = new Evaluator();
		currentGame.syncToGame();

		// Shutdown if out of sync
		if (this.DEBUG) {
			if (!currentGame.matchesGame()) {
				ultimateCookie.disableAutoBuy();
				console.log("Evaluator error: autoBuy disabled.");
				return;
			}
		}
		var nextPurchase = this.determineNextPurchase(currentGame);
		var cookieBank = currentGame.getCookieBankSize(Game.goldenCookie.time / Game.fps, Game.frenzy / Game.fps);
		// Cap cookie bank at 5% of total cookies earned
		cookieBank = Math.min(Game.cookiesEarned / 20, cookieBank);
		if (Game.cookies - cookieBank > nextPurchase.getCost()) {
			nextPurchase.purchase();
		}
	}
	// Auto reset
	if (!Game.recalculateGains && Constants.AUTO_RESET) {
		// Wait until frenzy or clickFrenzy is over to reset
		if (!Game.frenzy && !Game.clickFrenzy) {
			var hcs = Game.HowMuchPrestige(Game.cookiesReset);
			var resethcs = Game.HowMuchPrestige(Game.cookiesReset + Game.cookiesEarned);

			var scaleNow = 1 + hcs * 0.02;
			var scaleReset = 1 + resethcs * 0.02;

			if (scaleReset / scaleNow > Constants.AUTO_RESET_LIMIT) {
				console.log("Resetting game. HCs now: " + hcs + ", HCs after reset: " + resethcs + ", time: " + new Date());
				Game.Reset(1, 0);
			}
		}
	}
}

UltimateCookie.prototype.clickRate = function() {
	// Assume 175 clicks per second for now
	return 175;
}

//
// Class used for the X gains Y per building of type Z upgrades
//
function BuildingScaler() {
	// One per building type
	this.scales = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

BuildingScaler.prototype.getScale = function(buildings) {
	var scale = 0;
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		scale += this.scales[i] * buildings[i].quantity;
	}
	return scale;
}

BuildingScaler.prototype.clone = function() {
	var i;
	var bs = new BuildingScaler();
	for (i = 0; i < this.scales.length; ++i) {
		bs.scales[i] = this.scales[i];
	}
	return bs;
}

BuildingScaler.prototype.scaleAll = function(amount) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		this.scales[i] += amount;
	}
}

BuildingScaler.prototype.scaleOne = function(index, amount) {
	this.scales[index] += amount;
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
	this.buildingScaler = new BuildingScaler();
}

EvaluatorBuilding.prototype.getCps = function() {
	return this.quantity * (this.baseCps + this.buildingScaler.getScale(this.evaluator.buildings)) * this.multiplier;
}

EvaluatorBuilding.prototype.getCost = function() {
	return Math.ceil(this.baseCost * Math.pow(1.15, this.quantity));
}

//
// Cost Evaluator, used to determine upgrade paths
//

function Evaluator() {
	// Buildings
	this.buildings = [];
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
	this.cpcBuildingScaler = new BuildingScaler();

	// Production multiplier
	this.productionMultiplier = 0;

	// Heavenly chips
	this.heavenlyChips = 0;
	this.heavenlyUnlock = 0;

	// Milk scaling
	this.milkAmount = 0;
	this.milkMultipliers = [];

	// Game status indicators
	this.frenzy = 0
	this.clickFrenzy = 0;

	// Golden cookie information - only used in estimating value of golden cookie
	// frequency upgrades
	this.frenzyDuration = 77;
	this.goldenCookieTime = 300;
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
		e.buildings[i].buildingScaler = this.buildings[i].buildingScaler.clone();
	}
	e.cpcBase = this.cpcBase;
	e.cpcMultiplier = this.cpcMultiplier;
	e.cpcCpsMultiplier = this.cpcCpsMultiplier;
	e.cpcBuildingScaler = this.cpcBuildingScaler.clone();
	e.productionMultiplier = this.productionMultiplier;
	e.heavenlyChips = this.heavenlyChips;
	e.heavenlyUnlock = this.heavenlyUnlock;
	e.milkAmount = this.milkAmount;
	e.milkMultipliers = this.milkMultipliers;
	e.frenzy = this.frenzy;
	e.clickFrenzy = this.clickFrenzy;
	e.frenzyDuration = this.frenzyDuration;
	e.goldenCookieTime = this.goldenCookieTime;

	if (Constants.DEBUG) {
		// Make sure the cloning worked
		if (this.getEffectiveCps() != e.getEffectiveCps()) {
			console.log("Error cloning Evaluator");
		}
	}
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
	var cpc = (this.cpcBase + this.cpcBuildingScaler.getScale(this.buildings)) * this.cpcMultiplier;	// Base cpc
	cpc += this.getCps() * this.cpcCpsMultiplier;	// Add in percentage click scaling
	if (this.clickFrenzy) {	// Increase if click frenzy is active
		cpc *= Constants.CLICK_FRENZY_MULTIPLIER;
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
		cps *= Constants.FRENZY_MULTIPLIER;
	}
	return cps;
}

// Calculate the CpS during frenzy
Evaluator.prototype.getFrenziedCps = function() {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	this.frenzy = 1;
	this.clickFrenzy = 0;
	var cps = this.getCps();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	return cps;
}

// Calculate the CpC during frenzy
Evaluator.prototype.getFrenziedCpc = function() {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	this.frenzy = 1;
	this.clickFrenzy = 0;
	var cpc = this.getCpc();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	return cpc;
}

// Calculate the CpS without frenzy
Evaluator.prototype.getUnfrenziedCps = function() {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	this.frenzy = 0;
	this.clickFrenzy = 0;
	var cps = this.getCps();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	return cps;
}

// Calculate the CpC without frenzy
Evaluator.prototype.getUnfrenziedCpc = function() {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	this.frenzy = 0;
	this.clickFrenzy = 0;
	var cpc = this.getCpc();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	return cpc;
}

// Estimate the extra CpS contribution from collecting all golden cookies
// Assumes max click rate and that golden cookies just follow the simple pattern
// of Frenzy followed by Lucky and appear at the minimum spawn time every time.
// Not 100% accurate but near enough to give a decent estimation.
Evaluator.prototype.getGoldenCookieCps = function() {
	// Add gains from a single full duration frenzy
	var totalGain = 0;
	totalGain += (this.getFrenziedCps() - this.getUnfrenziedCps()) * this.frenzyDuration;
	totalGain += (this.getFrenziedCpc() - this.getUnfrenziedCpc()) * this.frenzyDuration * ultimateCookie.clickRate();

	// Add gains from a single lucky cookie
	if (this.goldenCookieTime < this.frenzyDuration) {
		totalGain += this.getFrenziedCps() * (Constants.LUCKY_COOKIE_BANK_TIME + Constants.LUCKY_COOKIE_BONUS_TIME);
	} else {
		totalGain += this.getUnfrenziedCps() * (Constants.LUCKY_COOKIE_BANK_TIME + Constants.LUCKY_COOKIE_BONUS_TIME);
	}

	// Divide this total by time it would take to get two golden cookies
	return totalGain / (this.goldenCookieTime * 2);
}

// Calculate the effective Cps at the current games click rate
Evaluator.prototype.getEffectiveCps = function() {
	return this.getCps() + this.getCpc() * ultimateCookie.clickRate() + this.getGoldenCookieCps();
}

// Get the current required cookie bank size, accounts for time until the
// next golden cookie appears
Evaluator.prototype.getCookieBankSize = function(timeSinceLastGoldenCookie, frenzyTimeRemaining) {
	var totalCookieBankRequired = this.getUnfrenziedCps() * Constants.LUCKY_COOKIE_BANK_TIME * 10;
	var timeRemaining = Math.max(this.goldenCookieTime - timeSinceLastGoldenCookie, 0);
	var frenziedCps = this.getFrenziedCps() + this.getFrenziedCpc() * ultimateCookie.clickRate();
	var unfrenziedCps = this.getUnfrenziedCps() + this.getUnfrenziedCpc() * ultimateCookie.clickRate();

	totalCookieBankRequired -= Math.min(timeRemaining, frenzyTimeRemaining) * frenziedCps;
	totalCookieBankRequired -= Math.max(timeRemaining - frenzyTimeRemaining, 0) * unfrenziedCps;

	return totalCookieBankRequired;
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

// Upgrade that makes Golden Cookies appear more often
function GoldenCookieFrequencyUpgrade(frequencyScale) {
	this.frequencyScale = frequencyScale;
	this.upgradeEval = function(eval) {
		eval.goldenCookieTime /= frequencyScale;
	}
}

// Upgrade that makes Golden Cookie effects last twice as long
function GoldenCookieDurationUpgrade() {
	this.upgradeEval = function(eval) {
		eval.frenzyDuration *= 2;
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

// Upgrades that increase cursor and mouse cps based on number of buildings owned
function MultifingerUpgrade(amount) {
	this.amount = amount;
	this.upgradeEval = function(eval) {
		// Scale up all except the excluded type
		eval.buildings[Constants.CURSOR_INDEX].buildingScaler.scaleAll(this.amount);
		eval.buildings[Constants.CURSOR_INDEX].buildingScaler.scaleOne(Constants.CURSOR_INDEX, -this.amount);
		eval.cpcBuildingScaler.scaleAll(this.amount);
		eval.cpcBuildingScaler.scaleOne(Constants.CURSOR_INDEX, -this.amount);
	}
}

// Upgrade that increases cps based on a given building type
function PerBuildingScalerUpgrade(beneficiary, target, amount) {
	this.beneficiary = beneficiary;
	this.target = target;
	this.amount = amount;
	this.upgradeEval = function(eval) {
		eval.buildings[this.beneficiary].buildingScaler.scaleOne(this.target, this.amount);
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

// Upgrade with no affect on cookie production
function NonProductionUpgrade() {
	this.upgradeEval = function(eval) {
	}
}

function UpgradeInfo() {
	// Create the array of known Upgrade functions
	this.upgradeFunctions = {};

	// Building upgrade functions
	this.upgradeFunctions["Cursor"] = new BuildingUpgrade(Constants.CURSOR_INDEX);
	this.upgradeFunctions["Grandma"] = new BuildingUpgrade(Constants.GRANDMA_INDEX);
	this.upgradeFunctions["Farm"] = new BuildingUpgrade(Constants.FARM_INDEX);
	this.upgradeFunctions["Factory"] = new BuildingUpgrade(Constants.FACTORY_INDEX);
	this.upgradeFunctions["Mine"] = new BuildingUpgrade(Constants.MINE_INDEX);
	this.upgradeFunctions["Shipment"] = new BuildingUpgrade(Constants.SHIPMENT_INDEX);
	this.upgradeFunctions["Alchemy lab"] = new BuildingUpgrade(Constants.ALCHEMY_LAB_INDEX);
	this.upgradeFunctions["Portal"] = new BuildingUpgrade(Constants.PORTAL_INDEX);
	this.upgradeFunctions["Time machine"] = new BuildingUpgrade(Constants.TIME_MACHINE_INDEX);
	this.upgradeFunctions["Antimatter condenser"] = new BuildingUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX);
	this.upgradeFunctions["Prism"] = new BuildingUpgrade(Constants.PRISM_INDEX);

	// Base CpS upgrades increase the base cps of a building
	this.upgradeFunctions["Forwards from grandma"] = new BuildingBaseCpsUpgrade(Constants.GRANDMA_INDEX, 0.3);
	this.upgradeFunctions["Cheap hoes"] = new BuildingBaseCpsUpgrade(Constants.FARM_INDEX, 1);
	this.upgradeFunctions["Sturdier conveyor belts"] = new BuildingBaseCpsUpgrade(Constants.FACTORY_INDEX, 4);
	this.upgradeFunctions["Sugar gas"] = new BuildingBaseCpsUpgrade(Constants.MINE_INDEX, 10);
	this.upgradeFunctions["Vanilla nebulae"] = new BuildingBaseCpsUpgrade(Constants.SHIPMENT_INDEX, 30);
	this.upgradeFunctions["Antimony"] = new BuildingBaseCpsUpgrade(Constants.ALCHEMY_LAB_INDEX, 100);
	this.upgradeFunctions["Ancient tablet"] = new BuildingBaseCpsUpgrade(Constants.PORTAL_INDEX, 1666);
	this.upgradeFunctions["Flux capacitors"] = new BuildingBaseCpsUpgrade(Constants.TIME_MACHINE_INDEX, 9876);
	this.upgradeFunctions["Sugar bosons"] = new BuildingBaseCpsUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX, 99999);
	this.upgradeFunctions["Gem polish"] = new BuildingBaseCpsUpgrade(Constants.PRISM_INDEX, 1000000);

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
	this.upgradeFunctions["Aging agents"] = new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2);
	this.upgradeFunctions["Fertilizer"] =
	this.upgradeFunctions["Cookie trees"] =
	this.upgradeFunctions["Genetically-modified cookies"] =
	this.upgradeFunctions["Gingerbread scarecrows"] =
	this.upgradeFunctions["Pulsar sprinklers"] = new BuildingMultiplierUpgrade(Constants.FARM_INDEX, 2);
	this.upgradeFunctions["Child labor"] =
	this.upgradeFunctions["Sweatshop"] =
	this.upgradeFunctions["Radium reactors"] =
	this.upgradeFunctions["Recombobulators"] =
	this.upgradeFunctions["Deep-bake process"] = new BuildingMultiplierUpgrade(Constants.FACTORY_INDEX, 2);
	this.upgradeFunctions["Megadrill"] =
	this.upgradeFunctions["Ultradrill"] =
	this.upgradeFunctions["Ultimadrill"] =
	this.upgradeFunctions["H-bomb mining"] =
	this.upgradeFunctions["Coreforge"] = new BuildingMultiplierUpgrade(Constants.MINE_INDEX, 2);
	this.upgradeFunctions["Wormholes"] =
	this.upgradeFunctions["Frequent flyer"] =
	this.upgradeFunctions["Warp drive"] =
	this.upgradeFunctions["Chocolate monoliths"] =
	this.upgradeFunctions["Generation ship"] = new BuildingMultiplierUpgrade(Constants.SHIPMENT_INDEX, 2);
	this.upgradeFunctions["Essence of dough"] =
	this.upgradeFunctions["True chocolate"] =
	this.upgradeFunctions["Ambrosia"] =
	this.upgradeFunctions["Aqua crustulae"] =
	this.upgradeFunctions["Origin crucible"] = new BuildingMultiplierUpgrade(Constants.ALCHEMY_LAB_INDEX, 2);
	this.upgradeFunctions["Insane oatling workers"] =
	this.upgradeFunctions["Soul bond"] =
	this.upgradeFunctions["Sanity dance"] =
	this.upgradeFunctions["Brane transplant"] =
	this.upgradeFunctions["Deity-sized portals"] = new BuildingMultiplierUpgrade(Constants.PORTAL_INDEX, 2);
	this.upgradeFunctions["Time paradox resolver"] =
	this.upgradeFunctions["Quantum conundrum"] =
	this.upgradeFunctions["Causality enforcer"] =
	this.upgradeFunctions["Yestermorrow comparators"] = new BuildingMultiplierUpgrade(Constants.TIME_MACHINE_INDEX, 2);
	this.upgradeFunctions["Far future enactment"] = new NonProductionUpgrade();	// Bugged - does nothing
	this.upgradeFunctions["String theory"] =
	this.upgradeFunctions["Large macaron collider"] =
	this.upgradeFunctions["Big bang bake"] =
	this.upgradeFunctions["Reverse cyclotrons"] =
	this.upgradeFunctions["Nanocosmics"] = new BuildingMultiplierUpgrade(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
	this.upgradeFunctions["9th color"] =
	this.upgradeFunctions["Chocolate light"] =
	this.upgradeFunctions["Grainbow"] =
	this.upgradeFunctions["Pure cosmic light"] =
	this.upgradeFunctions["Glow-in-the-dark"] = new BuildingMultiplierUpgrade(Constants.PRISM_INDEX, 2);

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
	this.upgradeFunctions["Serendipity"] = new GoldenCookieFrequencyUpgrade(2);
	this.upgradeFunctions["Get lucky"] = new GoldenCookieDurationUpgrade();

	// Research upgrade functions
	this.upgradeFunctions["Bingo center/Research facility"] = new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 4);
	this.upgradeFunctions["Persistent memory"] = new NonProductionUpgrade();
	this.upgradeFunctions["Specialized chocolate chips"] = new ProductionUpgrade(1);
	this.upgradeFunctions["Designer cocoa beans"] = new ProductionUpgrade(2);
	this.upgradeFunctions["Ritual rolling pins"] = new BuildingMultiplierUpgrade(Constants.GRANDMA_INDEX, 2);
	this.upgradeFunctions["Underworld ovens"] = new ProductionUpgrade(3);
	this.upgradeFunctions["One mind"] = new PerBuildingScalerUpgrade(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02);
	this.upgradeFunctions["Exotic nuts"] = new ProductionUpgrade(4);
	this.upgradeFunctions["Communal brainsweep"] = new PerBuildingScalerUpgrade(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02);
	this.upgradeFunctions["Arcane sugar"] = new ProductionUpgrade(4);
	this.upgradeFunctions["Elder Pact"] = new PerBuildingScalerUpgrade(Constants.GRANDMA_INDEX, Constants.PORTAL_INDEX, 0.05);
	this.upgradeFunctions["Sacrificial rolling pins"] = new NonProductionUpgrade();

	// Combo upgrades, combine a couple of effects
	this.upgradeFunctions["Reinforced index finger"] = new ComboUpgrade([
		new BuildingBaseCpsUpgrade(Constants.CURSOR_INDEX, 0.1),
		new ClickBaseUpgrade(1)
	]);

	// Mouse and Cursor Doublers
	this.upgradeFunctions["Carpal tunnel prevention cream"] =
	this.upgradeFunctions["Ambidextrous"] = new ComboUpgrade([
		new BuildingMultiplierUpgrade(Constants.CURSOR_INDEX, 2),
		new ClickDoublerUpgrade()
	]);

	// Clicking and Cursors scale with buildings owned
	this.upgradeFunctions["Thousand fingers"] = new MultifingerUpgrade(0.1);
	this.upgradeFunctions["Million fingers"] = new MultifingerUpgrade(0.5);
	this.upgradeFunctions["Billion fingers"] = new MultifingerUpgrade(2);
	this.upgradeFunctions["Trillion fingers"] = new MultifingerUpgrade(10);
	this.upgradeFunctions["Quadrillion fingers"] = new MultifingerUpgrade(20);
	this.upgradeFunctions["Quintillion fingers"] = new MultifingerUpgrade(100);
	this.upgradeFunctions["Sextillion fingers"] = new MultifingerUpgrade(200);
	this.upgradeFunctions["Septillion fingers"] = new MultifingerUpgrade(400);
	this.upgradeFunctions["Octillion fingers"] = new MultifingerUpgrade(800);

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
		this.upgradeFunctions[name] = new NonProductionUpgrade();
		console.log("Unknown upgrade: " + name);
	}
	return this.upgradeFunctions[name];
}

//
// Classes to represent upgrades and tie them to game purchases
//

// Building purchase
function PurchasableBuilding(index) {
	this.index = index;
	this.upgradeFunction = upgradeInfo.getUpgradeFunction(this.getName());
}

PurchasableBuilding.prototype.getName = function() {
	return Game.ObjectsById[this.index].name;
}

PurchasableBuilding.prototype.toString = function() {
	return "Building: " + this.getName() + " " + (Game.ObjectsById[this.index].amount + 1);
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
	this.upgradeFunction = upgradeInfo.getUpgradeFunction(this.getName());
}

PurchasableUpgrade.prototype.getName = function() {
	return Game.UpgradesById[this.index].name;
}

PurchasableUpgrade.prototype.toString = function() {
	return "Upgrade: " + this.getName();
}

PurchasableUpgrade.prototype.getCost = function() {
	return Game.UpgradesById[this.index].getPrice();
}

PurchasableUpgrade.prototype.purchase = function() {
	Game.UpgradesById[this.index].buy(1);
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
