var Constants = {};
var Config = {};

Config.failHard = false;
Config.autoClick = true;
Config.autoClickGoldenCookies = true;
Config.autoClickReindeer = true;
Config.autoReset = false;
Config.autoBuy = true;
Config.autoSwitchSeasons = false;
Config.autoPledge = true;
Config.autoPopWrinklers = true;
Config.skipHalloween = false;
Config.resetLimit = 1.1;
Config.maintainCookieBank = false;
Config.clickRateForCalculations = 0;	// 0 to disable

// General purpose constants
Constants.SUPPORTED_VERSION = "2.0042";
Constants.VERSION_ERROR = "Warning: Ultimate Cookie only supports version " + Constants.SUPPORTED_VERSION + " of the game. Your mileage may vary.\n";
Constants.AUTO_BUY_MIN_INTERVAL = 1;
Constants.AUTO_BUY_MAX_INTERVAL = 1010;
Constants.AUTO_CLICK_INTERVAL = 1;
Constants.AUTO_UPDATE_INTERVAL = 1000;
Constants.CLICK_RATE_ESTIMATE_SAMPLES = 120;
Constants.SEASON_SWITCH_DELAY = 11000;			// Season changes dont register in game immediately, this stops rapid switching
Constants.CLOT_MULTIPLIER = 0.5;				// Clot halves CpS
Constants.FRENZY_MULTIPLIER = 7;				// Frenzy multiplies CpS by 7
Constants.CLICK_FRENZY_MULTIPLIER = 777;		// Click frenzies give 777x cookier per click
Constants.REINDEER_CPS_MULTIPLIER = 60;			// Reindeer provide 60 seconds of CpS
Constants.REINDEER_MIN_COOKIES = 25;			// Reindeer give at least 25 cookies
Constants.LUCKY_COOKIE_MULTIPLIER = 60 * 20;	// Lucky provides up to 20 minutes CpS based on bank
Constants.LUCKY_COOKIE_BONUS = 13;				// Lucky provides 13 additional seconds of CpS regardless
Constants.LUCKY_COOKIE_BANK_SCALE = 10;			// Bank needs 10 times the lucky cookie bonus to give full reward
Constants.COOKIE_CHAIN_MULTIPLIER = 60 * 60 * 3;// Cookie chains cap out at 3 hours of cookies
Constants.COOKIE_CHAIN_BANK_SCALE = 4;			// Bank needs 4 times the Cookie Chain limit to payout in full
Constants.RESET_PAUSE_TIME = 1000;				// Time to pause so reset can complete correctly

// Indices into the buildings arrays
Constants.CURSOR_INDEX = 0;
Constants.GRANDMA_INDEX = 1;
Constants.FARM_INDEX = 2;
Constants.MINE_INDEX = 3;
Constants.FACTORY_INDEX = 4;
Constants.BANK_INDEX = 5;
Constants.TEMPLE_INDEX = 6;
Constants.WIZARD_TOWER_INDEX = 7;
Constants.SHIPMENT_INDEX = 8;
Constants.ALCHEMY_LAB_INDEX = 9;
Constants.PORTAL_INDEX = 10;
Constants.TIME_MACHINE_INDEX = 11;
Constants.ANTIMATTER_CONDENSER_INDEX = 12;
Constants.PRISM_INDEX = 13;
Constants.CHANCEMAKER_INDEX = 14;

// Elder Wrath levels
Constants.APPEASED = 0;
Constants.AWOKEN = 1;
Constants.DISPLEASED = 2;
Constants.ANGERED = 3;

// Season names
// Constants.NO_SEASON = "";
// Constants.BUSINESS_DAY = "fools";
// Constants.CHRISTMAS = "christmas";
// Constants.EASTER = "easter";
// Constants.HALLOWEEN = "halloween";
// Constants.VALENTINES_DAY = "valentines";
// Constants.MAX_SANTA_LEVEL = 14;

// var seasons = {};
// seasons[Constants.NO_SEASON] = {
// 	name: Constants.NO_SEASON,
// 	numUpgrades: 0,
// 	wrinklersDropUpgrades: false,
// };
// seasons[Constants.BUSINESS_DAY] = {
// 	name: Constants.BUSINESS_DAY,
// 	numUpgrades: 0,
// 	wrinklersDropUpgrades: false,
// };
// seasons[Constants.CHRISTMAS] = {
// 	name: Constants.CHRISTMAS,
// 	numUpgrades: 23,
// 	wrinklersDropUpgrades: false,
// };
// seasons[Constants.EASTER] = {
// 	name: Constants.EASTER,
// 	numUpgrades: 20,
// 	wrinklersDropUpgrades: true,
// };
// seasons[Constants.HALLOWEEN] = {
// 	name: Constants.HALLOWEEN,
// 	numUpgrades: 7,
// 	wrinklersDropUpgrades: true,
// };
// seasons[Constants.VALENTINES_DAY] = {
// 	name: Constants.VALENTINES_DAY,
// 	numUpgrades: 6,
// 	wrinklersDropUpgrades: false,
// };

//
// Periodical
//
// Periodicals are functions that execute on a set frequency. They can be 
// enabled or disbled and have various timings etc.
//

class Periodical {
	constructor(name, minInterval, maxInterval, callback) {
		this.name = name;
		this.minInterval = minInterval;
		this.maxInterval = maxInterval;
		this.interval = this.minInterval;
		this.callback = callback;
		this.nextTimeMillis = 0;
	}

	check(timeMillis) {
		if (timeMillis >= nextTimeMillis) {
			if (this.callback())
				interval = this.minInterval;
			else
				interval = Math.min(this.interval * 2, this.maxInterval);
			this.nextTimeMillis = timeMillis + this.interval;
		}
	}
}
// Periodical("Auto-Clicker", 1, 1, function() { return this.click(); });
// Periodical("Auto-Buyer", 1, 1000, function() { return this.buy(); });
// Periodical("Golden Cookie Auto-Clicker", 1, 1000, function() { return this.clickGoldenCookie(); });

//
// UltimateCookie represents the app itself
//

function UltimateCookie() {
	this.autoBuyInterval = Constants.AUTO_BUY_MIN_INTERVAL;
	this.lastDeterminedPurchase = "";
	this.lastPurchaseTime = new Date().getTime();
	this.lastClickRateCheckTime = this.lastPurchaseTime;
	this.lastClickCount = Game.cookieClicks;
	this.clickRates = [100];
	this.clickRate = 100;
	this.lockSeasons = false;
	this.lockSeasonsTimer = 0;
	this.matchError = "";
	this.currentGame = new Evaluator();
	this.currentGame.syncToGame();
	this.needsResync = false;
	this.lastGameCps = Game.cookiesPs;
	this.lastGameCpc = Game.mouseCps();
	
	// Start off the automatic things
	this.autoClick(Constants.AUTO_CLICK_INTERVAL);
	this.autoUpdate(Constants.AUTO_UPDATE_INTERVAL);
	this.autoBuy(Constants.AUTO_BUY_MIN_INTERVAL);
}

UltimateCookie.prototype.autoClick = function(interval) {
	clearInterval(this.autoClicker);
	if (interval == undefined) {
		if (Config.autoClick) {
			this.click();
		}
		interval = Constants.AUTO_CLICK_INTERVAL;
	}
	var t = this;
	this.autoClicker = setTimeout(function() { t.autoClick(); }, interval);
}

UltimateCookie.prototype.autoUpdate = function(interval) {
	clearInterval(this.autoUpdater);
	if (interval == undefined) {
		this.update();
		interval = Constants.AUTO_UPDATE_INTERVAL;
	}
	var t = this;
	this.autoUpdater = setTimeout(function() { t.autoUpdate(); }, interval);
}

UltimateCookie.prototype.autoBuy = function(interval) {
	clearInterval(this.autoBuyer);

	var lp = this.lastPurchaseTime;
	if (Config.autoBuy) {
		this.buy();
	}
	if (lp != this.lastPurchaseTime) {	// Just bought something
		this.autoBuyInterval = Constants.AUTO_BUY_MIN_INTERVAL;
	} else {
		this.autoBuyInterval = Math.min(Constants.AUTO_BUY_MAX_INTERVAL, this.autoBuyInterval * 2);
	}
	interval = this.autoBuyInterval;

	var t = this;
	this.autoBuyer = setTimeout(function() { t.autoBuy(); }, interval);
}

UltimateCookie.prototype.rankPurchases = function(eval) {
	// Default to current game if no evaluator passed
	eval = eval ? eval : this.currentGame;

	var p1 = this.createPurchaseList();
	p1.sort( function(a, b) { return UltimateCookie.prototype.comparePurchases(eval, a, b); } );

	// Research booster is always higher priority than research starter. This can't be handled
	// in comparePurchases
	var booster;
	var i;
	for (i = p1.length - 1; i >= 0; --i) {
		if (booster && p1[i].isResearchStarter) {
			var tmp = p1[booster];
			p1.splice(booster, 1);	// remove booster
			p1.splice(i, 0, tmp);	// reinsert before the research starter
			booster = i;
		} else if (p1[i].isResearchBooster) {
			booster = i;
		}
	}
	return p1;
}

UltimateCookie.prototype.sortTest = function() {
	var e = new Evaluator();
	e.syncToGame();
	var p1 = this.rankPurchases(e);
	for (var p = p1.length - 1; p >= 0; --p) {
		console.log(p1[p].name + "(" + (p1[p].getValue(e) / p1[p].getCost()) + ")");
	}
	console.log("CpS diff: " + Math.round(e.getCps() - Game.cookiesPs) + ", next: " + this.lastDeterminedPurchase);
}

UltimateCookie.prototype.comparePurchases = function(eval, a, b) {
	// If autoPledge is active, Elder Pledge trumps all
	if (Config.autoPledge && Game.elderWrath > 0/* && (!seasons[eval.season].wrinklersDropUpgrades || eval.lockedSeasonUpgrades[eval.season] == 0)*/) {
		if (a.beginsElderPledge && !b.beginsElderPledge) {
			return -1;
		} else if (b.beginsElderPledge && !a.beginsElderPledge) {
			return 1;
		}
	}

	var eCps = eval.getEffectiveCps();
	var aCpsGain = a.getValue(eval);
	var bCpsGain = b.getValue(eval);

	// Get time to buy both starting with a
	var ta = a.getCost() / eCps + b.getCost() / (eCps + aCpsGain);
	var tb = b.getCost() / eCps + a.getCost() / (eCps + bCpsGain);

	// If times are equal (can happen late game with many order of magnitude differences in numbers)
	if (floatEqual(ta, tb)) {
		// Prioritise the higher cpsGain, if there is none sort alphabetically on name
		// so the results are consistent and repeatable and not dependant on order of a, b
		if (aCpsGain != bCpsGain) {
			return bCpsGain - aCpsGain;
		} else {
			return a.name < b.name ? -1 : (a.name > b.name ? 1 : 0);
		}
	}
	return ta - tb;
}

UltimateCookie.prototype.createPurchaseList = function() {
	var purchases = [];

	// Add the buildings
	var i;
	for (i = 0; i < Game.ObjectsById.length; ++i) {
		purchases.push(getUpgradeFunction(Game.ObjectsById[i].name));
	}
	// Add the upgrades
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		purchases.push(getUpgradeFunction(Game.UpgradesInStore[i].name));
	}
	// Add santa level
	if (Game.season == Constants.CHRISTMAS && Game.santaLevel < Constants.MAX_SANTA_LEVEL) {
		purchases.push(upgradeFunctions.santaLevel);
	}
	return purchases;
}

// Work out what the optimal next purchase is for a given evaluator
UltimateCookie.prototype.determineNextPurchase = function(eval) {
	var purchases = this.rankPurchases(eval);
	var p = 0;
	if (Config.autoSwitchSeasons == false || this.lockSeasons == true) {
		while (purchases[p].setsSeason != undefined) {
			++p;
		}
	}

	if (purchases[p].name != this.lastDeterminedPurchase) {
		this.lastDeterminedPurchase = purchases[p].name;
		console.log("Clickrate: " + this.clickRate + ", CpS margin: " + Math.round(eval.getCps() - Game.cookiesPs) + ", next: " + this.lastDeterminedPurchase);
	}
	return purchases[p];
}

UltimateCookie.prototype.click = function() {
	Game.ClickCookie();
}

UltimateCookie.prototype.buy = function() {
	// Resync if the game has changed
	if (this.lastGameCps != Game.cookiesPs || this.lastGameCpc != Game.mouseCps())
		this.needsResync = true;

	// Get an Evaluator synced to the current game
	if (this.needsResync && Game.recalculateGains == 0) {
		this.currentGame.syncToGame();
		this.needsResync = false;
		this.lastGameCps = Game.cookiesPs;
		this.lastGameCpc = Game.mouseCps();
	} 

	// If Game.recalculateGains is 1 that means we are out of sync until the next
	// update which should be within a fraction of a second, just assume that currentGame
	// is correct until then. This allows for fast purchasing without stalling until the
	// game does a full update
	if (Game.recalculateGains == 1 || this.currentGame.matchesGame()) {
		var time = new Date().getTime();

		// // If all upgrades for current season are bought, unlock season switching
		// if (time < this.lockSeasonsTimer) {
		// 	this.lockSeasons = true;
		// } else if (this.currentGame.season == Constants.CHRISTMAS) {
		// 	this.lockSeasons = (this.currentGame.santaLevel != Constants.MAX_SANTA_LEVEL);
		// } else {
		// 	this.lockSeasons = (this.currentGame.lockedSeasonUpgrades[this.currentGame.season] > 0 && this.currentGame.santaLevel > 0);
		// }

		var nextPurchase = this.determineNextPurchase(this.currentGame);
		// Shutdown if out of sync
		var cookieBank = this.currentGame.getCookieBankSize();
		// Cap cookie bank at 5% of total cookies earned
		cookieBank = Math.min(Game.cookiesEarned / 20, cookieBank);
		if (Game.cookies - cookieBank > nextPurchase.getCost()) {
			this.lastPurchaseTime = time;
			if (!nextPurchase.setsSeason || !this.lockSeasons) {
//				if ((this.currentGame.currentTime - this.currentGame.sessionStartTime) < 30000) {
//					nextPurchase.purchaseMany();
//				} else {
					nextPurchase.purchase();
					this.needsResync = true;
//				}
			}
			if (nextPurchase.setsSeason) {
				this.lockSeasonsTimer = time + Constants.SEASON_SWITCH_DELAY;
			}
		}

		if (Config.autoPopWrinklers /* && seasons[this.currentGame.season].wrinklersDropUpgrades && this.currentGame.lockedSeasonUpgrades[this.currentGame.season] != 0 */) {
			for (var w in Game.wrinklers) {
				if (Game.wrinklers[w].sucked > 0) {
					Game.wrinklers[w].hp = 0;
				}
			}
		}
	} else {
		// Fail hard option, mostly used for debugging
		console.log(this.currentGame.matchError);
		if (Config.failHard) {
			Config.autoClick = false;
			Config.autoBuy = false;
			Config.autoClickGoldenCookies = false;
			Config.autoClickReindeer = false;
		} else {
			// Resync, something has gone wrong
			this.currentGame.syncToGame();
		}
	} 
}

UltimateCookie.prototype.popShimmer = function(type)
{
	for (var i = 0; i < Game.shimmers.length; ++i) {
		if (Game.shimmers[i].type == type) {
			Game.shimmers[i].pop();
			return;		// Only pop one at a time since the pop func might alter the array
		}
	}
}

UltimateCookie.prototype.update = function() {
	var now = new Date().getTime();

	if (now - this.lastClickRateCheckTime >= 1000) {
		var newClicks = Game.cookieClicks - this.lastClickCount;
		var newRate = newClicks * 1000 / (now - this.lastClickRateCheckTime);
		this.clickRates.push(newRate);
		while (this.clickRates.length > Constants.CLICK_RATE_ESTIMATE_SAMPLES) {
			this.clickRates.shift();
		}
		var sum = 0;
		for (var i = 0; i < this.clickRates.length; ++i)
			sum += this.clickRates[i];
		this.clickRate = Math.floor(sum / this.clickRates.length);
		//console.log("Click rate - Last Second: " + Math.floor(newRate) +", Average: " + this.clickRate);
		this.lastClickCount = Game.cookieClicks;
		this.lastClickRateCheckTime = now;
		this.currentGame.clickRate = Config.clickRateForCalculations ? Config.clickRateForCalculations : this.clickRate;
	}
	if (Config.autoClickGoldenCookies) {
		this.popShimmer("golden");
		this.lastGoldenCookieTime = new Date().getTime();
	}
	if (Config.autoClickReindeer) {
		this.popShimmer("reindeer");
	}
	if (Config.autoReset) {
		// Wait until frenzy or clickFrenzyMultiplier is over to reset
		if (!Game.frenzy && !Game.clickFrenzy) {
			var hcs = Game.HowMuchPrestige(Game.cookiesReset);
			var resethcs = Game.HowMuchPrestige(Game.cookiesReset + Game.cookiesEarned);

			var scaleNow = 1 + hcs * 0.02;
			var scaleReset = 1 + resethcs * 0.02;

			if (scaleReset / scaleNow >= Config.resetLimit) {
				this.reset();
			}
		}
	}
}

UltimateCookie.prototype.reset = function() {
	var now = new Date().getTime();
	if (upgradeFunctions.chocolateEgg.isAvailableToPurchase()) {
		for (var o in Game.ObjectsById) {
			Game.ObjectsById[o].sell(Game.ObjectsById[o].amount);
		}
		upgradeFunctions.chocolateEgg.purchase();
	}
	var hcs = Game.HowMuchPrestige(Game.cookiesReset);
	var resethcs = Game.HowMuchPrestige(Game.cookiesReset + Game.cookiesEarned);

	console.log("Resetting game. HCs now: " + hcs + ", HCs after reset: " + resethcs + ", time: " + now);
	this.lastPurchaseTime = now;
	this.lastClickCount = 0;
	this.currentGame.initialize();
	this.autoBuy(Constants.RESET_PAUSE_TIME);
	this.autoClick(Constants.RESET_PAUSE_TIME);
	this.autoUpdate(Constants.RESET_PAUSE_TIME);
	Game.Reset(1, 0);
}


//
// Counts all the buildings with a scaling factor for each building type
//
function BuildingCounter() {
	// One per building type
	this.scales = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
}

BuildingCounter.prototype.getCount = function(buildings) {
	var count = 0;
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		count += this.scales[i] * buildings[i].quantity;
	}
	return count;
}

BuildingCounter.prototype.addCounter = function(counter) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		this.scales[i] += counter.scales[i];
	}
	return this;
}

BuildingCounter.prototype.addCountOne = function(index, scale=1) {
	this.scales[index] += scale;
	return this;
}

BuildingCounter.prototype.addCountAll = function(scale=1) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		this.scales[i] += amount;
	}
	return this;
}

BuildingCounter.prototype.addCountMost = function(excludes, scale=1) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		if (excludes.indexOf(i) == -1)
			this.scales[i] += scale;
	}
	return this;
}

BuildingCounter.prototype.subtractCounter = function(counter) {
	var i;
	for (i = 0; i < this.scales.length; ++i) {
		this.scales[i] -= counter.scales[i];
	}
	return this;
}

BuildingCounter.prototype.subtractCountOne = function(index, scale=1) {
	return this.addCountOne(index, -scale);
}

BuildingCounter.prototype.subtractCountAll = function(scale=1) {
	return this.addCountAll(-scale);
}

BuildingCounter.prototype.subtractCountMost = function(excludes, scale=1) {
	return this.addCountMost(excludes, -scale);
}


//
// Class used to represent a particular building type for the cost Evaluator
//

function EvaluatorBuilding(evaluator, name, baseCost, baseCps) {
	this.name = name;
	this.evaluator = evaluator;
	this.baseCost = baseCost;
	this.baseCps = baseCps;
	this.quantity = 0;
	this.multiplier = 1;
	this.perBuildingFlatCpcBoostCounter = new BuildingCounter();
	this.perBuildingFlatCpsBoostCounter = new BuildingCounter();
	this.buildingScaler = new BuildingCounter();
	this.scaleCounter = new BuildingCounter();
}

EvaluatorBuilding.prototype.getCps = function() {
	return this.quantity * this.getIndividualCps();
}

EvaluatorBuilding.prototype.getIndividualCps = function() {
	if (typeof this.baseCps === 'function') {
		return this.baseCps();
	}
	return this.perBuildingFlatCpsBoostCounter.getCount(this.evaluator.buildings) + this.baseCps * (1 + this.scaleCounter.getCount(this.evaluator.buildings)) * (1 + this.buildingScaler.getCount(this.evaluator.buildings)) * this.multiplier;
}

EvaluatorBuilding.prototype.getCost = function() {
	return Math.ceil(this.evaluator.buildingCostScale * this.baseCost * Math.pow(1.15, this.quantity));
}

//
// Cost Evaluator, used to determine upgrade paths
//

class Evaluator {
	constructor(uc) {
		this.initialize();
	}

	initialize() {
		// Buildings
		this.buildings = [];
		this.buildings.push(new EvaluatorBuilding(this, 'Cursor',			   	         	  15,           0.1));
		this.buildings.push(new EvaluatorBuilding(this, 'Grandma',			 	        	 100,           1.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Farm',				   		   	    1100,           8.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Mine',					      	   12000,          47.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Factory',			    	 	  130000,         260.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Bank',				   			 1400000,        1400.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Temple',				   	    20000000,        7800.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Wizard tower',			  	   330000000,       44000.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Shipment',				 	  5100000000,      260000.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Alchemy lab',				 75000000000,     1600000.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Portal',			  	   1000000000000,    10000000.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Time machine',	  	  	  14000000000000,    65000000.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Antimatter condenser',	 170000000000000,   430000000.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Prism',				2100000000000000,  2900000000.0));
		this.buildings.push(new EvaluatorBuilding(this, 'Chancemaker',		   26000000000000000, 21000000000.0));
		
		// When the session started
		this.sessionStartTime = new Date().getTime();
		this.currentTime = new Date().getTime();

		// Mouse click information
		this.clickRate = 0;
		this.cpcBase = 1;
		this.cpcMultiplier = 1;
		this.cpcBaseMultiplier = 1;
		this.cpcCpsMultiplier = 0;
		this.perBuildingFlatCpcBoostCounter = new BuildingCounter();

		// Production multiplier
		this.baseCps = 0;
		this.productionScale = 1;
		this.globalProductionMultiplier = 0;
		this.centuryProductionMultiplier = 0;

		// Heavenly chips
		this.heavenlyChips = 0;

		// Prestige
		this.prestige = 0;
		this.prestigeUnlocked = 0;

		// Milk scaling
		this.milkAmount = 0;
		this.milkMultiplier = 1;
		this.milkUnlocks = [];

		// Game status indicators
		this.clickFrenzyMultiplier = 1;

		// Golden cookie and reindeer information
		this.frenzyDuration = 77;
		this.goldenCookieTime = 300;
		this.reindeerTime = 180;
		this.reindeerMultiplier = 1;

		// Elder covenant and Grandmatriarch stuff
		this.grandmatriarchStatus = Constants.APPEASED;
		this.elderCovenant = false;	// 5% reduction in CpS
		this.wrinklerMultiplier = 1;

		// Santa level
		this.santaLevel = 0;
		this.santaPower = 0;

		// Building cost reduction
		this.buildingCostScale = 1;

		// Current season
		this.seasonStack = [""];	// Needs to be a stack so that adding seasons is reversible, only element 0 is active

		this.matchError = "";
	}

	get season() {
		return this.seasonStack[0];
	}
}

// Check that the values in the evaluator match those of the game, for debugging use
Evaluator.prototype.matchesGame = function(equalityFunction=floatEqual) {
	var errMsg = "";
	// Check that Cps matches the game
	var cps = this.getCps();
	if (!equalityFunction(cps, Game.cookiesPs)) {
		errMsg += "- CpS - Predicted: " + this.getCps() + ", Actual: " + Game.cookiesPs + "\n";
	}
	// Check the Cpc matches the game
	var cpc = this.getCpc();
	var gcpc = Game.mouseCps();
	if (!equalityFunction(cpc, gcpc)) {
		errMsg += "- CpC - Predicted: " + cpc + ", Actual: " + gcpc + "\n";
	}
	// Check the building costs match the game
	var i;
	for (i = 0; i < this.buildings.length; ++i) {
		if (this.buildings[i].name != Game.ObjectsById[i].name) {
			errMsg += "- Building Name " + this.buildings[i].name + " does not match " + Game.ObjectsById[i].name + "\n";			
		}
		if (!equalityFunction(this.buildings[i].getCost(), Game.ObjectsById[i].getPrice())) {
			errMsg += "- Building Cost " + this.buildings[i].name + " - Predicted: " + this.buildings[i].getCost() + ", Actual: " + Game.ObjectsById[i].getPrice() + "\n";
		}
		if (!equalityFunction(this.buildings[i].getIndividualCps(), Game.ObjectsById[i].cps(Game.ObjectsById[i]))) {
			errMsg += "- Building CpS " + this.buildings[i].name + " - Predicted: " + this.buildings[i].getIndividualCps() + ", Actual: " + Game.ObjectsById[i].cps(Game.ObjectsById[i]) + "\n";
		}
	}
	// Check that all buildings are supported
	if (this.buildings.length != Game.ObjectsById.length)
		errMsg += "- Building getCount " + this.buildings.length + " does not match " + Game.ObjectsById.length + "\n";

	// Check that all available upgrade costs match those of similar upgrade functions
	for (i = 0; i < Game.UpgradesInStore.length; ++i) {
		var u = Game.UpgradesInStore[i];
		var uf = getUpgradeFunction(u.name);
		if (uf.setsSeason == undefined && !equalityFunction(uf.getCost(), u.getPrice())) {
			errMsg += "- Upgrade Cost " + u.name + " - Predicted: " + uf.getCost() + ", Actual: " + u.getPrice() + "\n";
		}
	}
	if (errMsg != "") {
		errMsg = "Evaluator Mismatch:\n" + errMsg;
		for (var key in Game.buffs) {
			errMsg += "- Buff Active: " + key + "\n";
		}
	}

	this.matchError = errMsg;
	if (this.matchError) {
		this.lastError = this.matchError;
		if (Game.version != Constants.SUPPORTED_VERSION) {
			this.lastError = this.lastError + Constants.VERSION_ERROR;
		}
	} else if (!this.lastError) {
		if (Game.version != Constants.SUPPORTED_VERSION) {
			this.lastError = Constants.VERSION_ERROR;
		}
	}
	return this.matchError == "";
}

// Get the current cookies per click amount
Evaluator.prototype.getCpc = function() {
	var cpc = this.cpcBase * this.cpcBaseMultiplier;			// Base cpc
	// Add in percentage click scaling
	cpc += this.getCps() * this.cpcCpsMultiplier;
	// Multiply by total multiplier
	cpc *= this.cpcMultiplier;
	// Increase if click frenzy is active
	cpc *= this.clickFrenzyMultiplier;

	// Add the flat per building boost
	cpc += this.perBuildingFlatCpcBoostCounter.getCount(this.buildings);

	return cpc;
}
// Calculate the total Cps generated by the game in this state
Evaluator.prototype.getCps = function() {
	var i;

	var cps = this.baseCps;
	// Get the cps from buildings - start at 1, cursors generate clicks
	for (i = 0; i < this.buildings.length; ++i) {
		cps += this.buildings[i].getCps();
	}

	// Scale it for production and heavely chip multipliers
	var santaScale = (this.santaLevel + 1) * this.santaPower * 0.01;
	var prestigeScale = this.prestige * this.prestigeUnlocked * 0.01;

	var scale = this.productionScale * (1 + santaScale + prestigeScale);

	// Scale it for milk
	for (i = 0; i < this.milkUnlocks.length; ++i) {
		scale *= (1 + this.milkUnlocks[i] * this.milkAmount * this.milkMultiplier);
	}
	// Scale it for global production
	var sessionDays = Math.min(Math.floor((this.currentTime - this.sessionStartTime) / 1000 / 10) * 10 / 60 / 60 / 24, 100);
	var centuryMult = (1 - Math.pow(1 - sessionDays / 100, 3)) * this.centuryProductionMultiplier;

	scale *= (1 + (this.globalProductionMultiplier + centuryMult) * 0.01);
	scale *= this.frenzyMultiplier;

	if (this.elderCovenant) {
		scale *= 0.95;
	}

	return cps * scale;
}

// Calculate the CpS at a specific frenzy multiplier
Evaluator.prototype.getFrenziedCps = function(multiplier) {
	var clickFrenzyMultiplier = this.clickFrenzyMultiplier;
	var frenzyMultiplier = this.frenzyMultiplier;
	this.frenzyMultiplier = multiplier;
	this.clickFrenzyMultiplier = 1;
	var cps = this.getCps();
	this.clickFrenzyMultiplier = clickFrenzyMultiplier;
	this.frenzyMultiplier = frenzyMultiplier;
	return cps;
}

// Calculate the CpC at a specific frenzy multiplier
Evaluator.prototype.getFrenziedCpc = function(multiplier) {
	var clickFrenzyMultiplier = this.clickFrenzyMultiplier;
	var frenzyMultiplier = this.frenzyMultiplier;
	this.frenzyMultiplier = multiplier;
	this.clickFrenzyMultiplier = 1;
	var cpc = this.getCpc();
	this.clickFrenzyMultiplier = clickFrenzyMultiplier;
	this.frenzyMultiplier = frenzyMultiplier;
	return cpc;
}

Evaluator.prototype.getReindeerMax = function(frenzy) {
	return Math.max(Constants.REINDEER_MIN_COOKIES, this.getFrenziedCps(frenzy) * Constants.REINDEER_CPS_MULTIPLIER) * this.reindeerMultiplier;
}

Evaluator.prototype.getLuckyCookieMax = function(frenzy) {
	return this.getFrenziedCps(frenzy) * Constants.LUCKY_COOKIE_MULTIPLIER + Constants.LUCKY_COOKIE_BONUS;
}

Evaluator.prototype.getCookieChainMax = function(frenzy) {
	return this.getFrenziedCps(frenzy) * Constants.COOKIE_CHAIN_MULTIPLIER;
}

Evaluator.prototype.getReindeerCps = function() {
	if (this.season == Constants.CHRISTMAS) {
		var frenzycookies = this.getReindeerMax(Constants.FRENZY_MULTIPLIER);
		var normalcookies = this.getReindeerMax(1);
		var frenzyChance = this.frenzyDuration / (this.goldenCookieTime * 2);
		return (frenzycookies * frenzyChance + normalcookies * (1 - frenzyChance)) * this.reindeerMultiplier / this.reindeerTime;
	} else {
		return 0;
	}
}

// Estimate the extra CpS contribution from collecting all golden cookies
// Assumes max click rate and that golden cookies just follow the simple pattern
// of Frenzy followed by Lucky and appear at the minimum spawn time every time.
// Not 100% accurate but near enough to give a decent estimation.
Evaluator.prototype.getGoldenCookieCps = function() {
	// If we dont click them, they don't work
	if (!Config.autoClickGoldenCookies) {
		return 0;
	}
	// Add gains from a single full duration frenzy
	var totalGain = 0;
	totalGain += (this.getFrenziedCps(Constants.FRENZY_MULTIPLIER) - this.getFrenziedCps(1)) * this.frenzyDuration;
	totalGain += (this.getFrenziedCpc(Constants.FRENZY_MULTIPLIER) - this.getFrenziedCpc(1)) * this.frenzyDuration * this.clickRate;

	// Add gains from a single lucky cookie
	if (this.goldenCookieTime < this.frenzyDuration) {
		totalGain += this.getLuckyCookieMax(Constants.FRENZY_MULTIPLIER);
	} else {
		totalGain += this.getLuckyCookieMax(1);
	}

	// Divide this total by time it would take to get two golden cookies
	return totalGain / (this.goldenCookieTime * 2);
}

// Calculate the effective Cps at the current games click rate minus golden cookies
Evaluator.prototype.getCurrentCps = function() {
	return this.getCps() + this.getCpc() * this.clickRate;
}

// Calculate the effective Cps at the current games click rate
Evaluator.prototype.getEffectiveCps = function() {
	return this.getFrenziedCps(1) + this.getFrenziedCpc(1) * (this.clickRate + this.buildings[0].quantity * 0.1) + this.getGoldenCookieCps() + this.getReindeerCps();
}

// Get the current required cookie bank size, accounts for time until the
// next golden cookie appears
Evaluator.prototype.getCookieBankSize = function(timeSinceLastGoldenCookie) {
	// Don't need one if not clicking golden cookies
	if (!Config.maintainCookieBank) {
		return 0;
	}

	var bank;
	var normalTimeRemaining;
	var frenzyTimeRemaining;
	var luckyBank;
	var chainBank;

	var timeToNextCookie = Math.max(this.goldenCookieTime - Game.shimmerTypes['golden'] ? Game.shimmerTypes['golden'].time / Game.fps : 0, 0);

	// Bank size varies on whether you can get another golden cookie during frenzy
	if (this.frenzyDuration < this.goldenCookieTime) {
		luckyBank = this.getLuckyCookieMax(1) * Constants.LUCKY_COOKIE_BANK_SCALE;
		chainBank = this.getCookieChainMax(1) * Constants.COOKIE_CHAIN_BANK_SCALE;

		normalTimeRemaining = timeToNextCookie;
		frenzyTimeRemaining = 0;
	} else {
		luckyBank = this.getLuckyCookieMax(Constants.FRENZY_MULTIPLIER) * Constants.LUCKY_COOKIE_BANK_SCALE;
		chainBank = this.getCookieChainMax(Constants.FRENZY_MULTIPLIER) * Constants.COOKIE_CHAIN_BANK_SCALE;

		if (this.frenzy) {
			normalTimeRemaining = 0;
			frenzyTimeRemaining = timeToNextCookie;
		} else {
			normalTimeRemaining = timeToNextCookie;
			frenzyTimeRemaining = this.frenzyDuration;
		}
	}
	var frenzyMult = Math.min(this.frenzyMultiplier, Constants.FRENZY_MULTIPLIER);	// stop elder frenzy messing up bank
	bank = Math.max(luckyBank, chainBank);
	bank -= normalTimeRemaining * (this.getFrenziedCps(1) + this.getFrenziedCpc(1) * this.clickRate);
	bank -= frenzyTimeRemaining * (this.getFrenziedCps(frenzyMult) + this.getFrenziedCpc(frenzyMult) * this.clickRate);
	
	return Math.max(bank, 0);
}

// Sync an evaluator with the current in game store
Evaluator.prototype.syncToGame = function() {
	this.initialize();
	var i;
	for (i = 0; i < Game.ObjectsById.length && i < this.buildings.length; ++i) {
		this.buildings[i].quantity = Game.ObjectsById[i].amount;
	}
	for (i = 0; i < Game.UpgradesById.length; ++i) {
		if (Game.UpgradesById[i].bought == 1) {
			var uf = getUpgradeFunction(Game.UpgradesById[i].name);
			uf.applyTo(this);
			if (uf.season) {
				this.lockedSeasonUpgrades[uf.season]--;
			}
		} else if (Game.UpgradesById[i].unlocked == 1) {
			var uf = getUpgradeFunction(Game.UpgradesById[i].name);
			if (uf.season) {
				this.lockedSeasonUpgrades[uf.season]--;
			}
		}
	}
	this.heavenlyChips = Game.heavenlyChips;
	this.prestige = Game.prestige;
	this.milkAmount = Game.AchievementsOwned / 25;
	this.frenzyMultiplier = 1;
	this.clickFrenzyMultiplier = 1;
	if (Game.hasBuff('Frenzy'))
		this.frenzyMultiplier *= Constants.FRENZY_MULTIPLIER;
	if (Game.hasBuff('Clot'))
		this.frenzyMultiplier *= Constants.CLOT_MULTIPLIER;
	if (Game.hasBuff('Click frenzy'))
		this.clickFrenzyMultiplier *= Constants.CLICK_FRENZY_MULTIPLIER;
	
	this.santaLevel = Game.santaLevel;
	this.seasons = [Game.season];
	this.sessionStartTime = Game.startDate;
	this.currentTime = new Date().getTime();
}

//
// Some class variables and containers for holding upgrades
//

var upgradeFunctions = {}
var upgradeIndex = {}
var upgradesSupported = 0;
var upgradeBuildingsSupported = 0;

//
// Modifier.
//
// The modifier is a base class for anything that modifies a Simulation. Any
// modifier can be applied to or revoked from a Simulation.
//
var allModifiers = {};

class Modifier {
	constructor(name) {
		this.name = name;
		this.appliers = [];
		this.revokers = [];
		allModifiers[name] = this;
	}

	applyTo(sim) {
		var i;
		for (i = 0; i < this.appliers.length; ++i)
			this.appliers[i](sim);
	}

	revokeFrom(sim) {
		var i;
		for (i = 0; i < this.revokers.length; ++i)
			this.revokers[i](sim);
	}

	addApplier(func) {
		this.appliers.push(func);
	}

	addRevoker(func) {
		this.revokers.push(func);
	}

	requires(modifier) {
		var required = allModifiers[modifier];
		if (required.locks == undefined) 
			required.locks = [];
		required.locks.push(this);
	}
}

//
// Seasons
//
// Seasons are a class of modifier that make pretty big changes to the game, often enabling
// new shimmers, new buffs and a bunch of lockable items to unlock. 

var allSeasons = {};

class Season extends Modifier {
	constructor(name) {
		super(name);
		allSeasons[name] = this;
		this.addApplier(function(sim) { sim.seasonStack.unshift(name); });
		this.addRevoker(function(sim) { sim.seasonStack.shift(); });
	}
}

new Season("christmas");

//
// Upgrades. 
//
// The way these work is pretty simple, each Upgrade has a list of functions
// that are used to apply or revoke the upgrade from a CCSimulation. Creating
// an Upgrade involves declaring it by name then using the builder function to
// chain all the different things it does one after the other. Each creation
// adds an applyFunction and a revokeFunction. If both are called on a 
// Simulation the resulting simulation should be unchanged overall. 
//
// While the naming on these isn't entirely consistent (sometimes things just
// work in weird ways and it's hard to come up with a name that is specific 
// without being overly verbose) there are some words that I try to keep to a
// special meaning.
//
// Flat - A flat increase is added on its own and doesn't scale with anything.
// Base - A base increases is added to the baseline output and scales with any
//        scaling factors that also affect that.
// Boost - A boost is added to another scaling factor to increase that scaling.
// Scale - A scale is multiplied with another scaling factor to increase that
//         scaling.
// 

var allUpgrades = {};

class Upgrade extends Modifier {
	constructor(name, supported) {
		super(name);
		if (supported) {
			upgradesSupported += 1;
		}
		allUpgrades[name] = this;
	}

	get variableName() {
		var s = this.name;
		s = s.replace("9th", "ninth");
		s = s.replace("&eacute;", "e");
		s = s.replace("'", "");
		s = s.replace("\"", "");
		s = s.replace(/\W\w/g, function(s) { return s.toUpperCase(); } );
		s = s.replace(/\W+/g, "");
		s = s.replace(/^\w/g, function(s) { return s.toLowerCase(); } );
		return s;
	}

	getGameObject() {
		return Game.Upgrades[this.name];
	}
	
	//
	// Implementation of the various upgrades themselves
	//

	angersGrandmas() {
		this.addApplier(function(sim) { sim.grandmatriarchStatus++; });
		this.addRevoker(function(sim) { sim.grandmatriarchStatus--; });
		return this;
	}

	builds(index, quantity) {
		upgradesSupported -= 1;
		upgradeBuildingsSupported += 1;
		this.addApplier(function(sim) { sim.buildings[index].quantity += quantity; });
		this.addRevoker(function(sim) { sim.buildings[index].quantity -= quantity; });
		// Need to override getGameObject for buildings
		this.getGameObject = function() { return Game.ObjectsById[index]; }
		return this;
	}

	boostsClickCps(amount) {
		this.addApplier(function(sim) { sim.cpcCpsMultiplier += amount; });
		this.addRevoker(function(sim) { sim.cpcCpsMultiplier -= amount; });
		return this;
	}

	calmsGrandmas() {
		this.beginsElderPledge = true;
		return this;
	}
	
	doublesElderPledge() {
		this.getValue = function(sim) { return upgradeFunctions.elderPledge.getCost() / 3600; };
		return this;
	}

	scalesBaseClicking(scale) {
		this.addApplier(function(sim) { sim.cpcBaseMultiplier *= scale; });
		this.addRevoker(function(sim) { sim.cpcBaseMultiplier /= scale; });
		return this;
	}

	scalesBuildingCps(index, scale) {
		this.addApplier(function(sim) { sim.buildings[index].multiplier *= scale; });
		this.addRevoker(function(sim) { sim.buildings[index].multiplier /= scale; });
		return this;
	}

	scalesProduction(scale)	{
		this.addApplier(function(sim) { sim.productionScale *= scale; });
		this.addRevoker(function(sim) { sim.productionScale /= scale; });
		return this;
	}

	startsResearch() {
		// Used in sorting to make sure that research boosters are bought before research starters.
		this.isResearchStarter = true;
		return this;
	}
	
	givesBuildingPerBuildingFlatCpsBoost(receiver, excludes, amount) {
		this.addApplier(function(sim) { sim.buildings[receiver].perBuildingFlatCpsBoostCounter.addCountMost(excludes, amount); });
		this.addRevoker(function(sim) { sim.buildings[receiver].perBuildingFlatCpsBoostCounter.subtractCountMost(excludes, amount); });
		return this;
	}

	givesPerBuildingBoost(receiver, source, amount) {
		this.addApplier(function(sim) { sim.buildings[receiver].scaleCounter.addCountOne(source, amount); });
		this.addRevoker(function(sim) { sim.buildings[receiver].scaleCounter.subtractCountOne(source, amount); });
		return this;
	}

	givesPerBuildingFlatCpcBoost(excludes, amount) {
		this.addApplier(function(sim) { sim.perBuildingFlatCpcBoostCounter.addCountMost(excludes, amount); });
		this.addRevoker(function(sim) { sim.perBuildingFlatCpcBoostCounter.subtractCountMost(excludes, amount); });
		return this;
	}

	unlocksMilk(amount) {
		this.addApplier(function(sim) { sim.milkUnlocks.push(amount); sim.milkUnlocks.sort(); });
		this.addRevoker(function(sim) { sim.milkUnlocks.splice(sim.milkUnlocks.indexOf(amount), 1); });
		return this;		
	}

	unlocksPrestige(amount) {
		this.addApplier(function(sim) { sim.prestigeUnlocked += amount; });
		this.addRevoker(function(sim) { sim.prestigeUnlocked -= amount; });
		return this;		
	}
}

Upgrade.prototype.getCost = function() {
	// if (this.setsSeason == Constants.VALENTINES_DAY) {
	// 	return Math.max(upgradeFunctions.pureHeartBiscuits.getCost(), this.getGameObject().getPrice());
	// }
	// if (!Config.skipHalloween && this.setsSeason == Constants.HALLOWEEN) {
	// 	return Math.max(upgradeFunctions.skullCookies.getCost(), this.getGameObject().getPrice());
	// }
	// if (this == upgradeFunctions.santaLevel) {
	// 	return Math.pow(Game.santaLevel + 1, Game.santaLevel + 1)
	// }
	return this.getGameObject().getPrice();
}

Upgrade.prototype.isAvailableToPurchase = function() {
	if (this.buildsIndex != undefined)
		return true;
	else
		return Game.Upgrades[this.name].unlocked == 1 && Game.Upgrades[this.name].bought == 0;

}

Upgrade.prototype.purchase = function() {
	if (this == upgradeFunctions.santaLevel) {
		var mx = Game.mouseX;
		var my = Game.mouseY;
		var c = Game.Click;
		Game.mouseX = 24;
		Game.mouseY = Game.LeftBackground.canvas.height - 48;
		Game.Click = 1;
		Game.UpdateSanta();
		Game.mouseX = mx;
		Game.mouseY = my;
		Game.Click = c;
	} else {
		this.getGameObject().buy(1);
	}
}

Upgrade.prototype.purchaseMany = function() {
	if (this.buildsIndex == undefined) {
		this.purchase();
	} else {
		while (Game.cookies > this.getGameObject().getPrice()) {
			this.getGameObject().buy(1);
		}
	}
}

Upgrade.prototype.getEffectiveCps = function(eval) {
	var cps = eval.getEffectiveCps();
	this.applyTo(eval);
	cps = eval.getEffectiveCps() - cps;
	this.revokeFrom(eval);
	return cps;
}

Upgrade.prototype.getValue = function(eval) {
	var val = this.getEffectiveCps(eval);
	if (this.valueFromTotalCps)
		val += eval.getEffectiveCps() * this.valueFromTotalCps;
	// if (this.setsSeason == Constants.VALENTINES_DAY && eval.lockedSeasonUpgrades[Constants.VALENTINES_DAY] > 0) {
	// 	val = upgradeFunctions.pureHeartBiscuits.getValue(eval);
	// }
	// if (this.setsSeason == Constants.EASTER && eval.lockedSeasonUpgrades[Constants.EASTER] > 0) {
	// 	if (eval.grandmatriarchStatus >= Constants.AWOKEN) {
	// 		val = upgradeFunctions.chickenEgg.getValue(eval);
	// 	}
	// }
	// if (this.setsSeason == Constants.HALLOWEEN && eval.lockedSeasonUpgrades[Constants.HALLOWEEN] > 0) {
	// 	if (eval.grandmatriarchStatus >= Constants.AWOKEN && !Config.skipHalloween) {
	// 		val = upgradeFunctions.skullCookies.getValue(eval);
	// 	}
	// }
	return val;
}

// Upgrade.prototype.applyUpgrade = function(eval) {
// 	if (this.globalProductionBoost != undefined)
// 		eval.globalProductionMultiplier += this.globalProductionBoost;
// 	if (this.goldenCookieDelayScale != undefined)
// 		eval.goldenCookieTime *= this.goldenCookieDelayScale;
// 	if (this.goldenCookieDurationScale != undefined)
// 		eval.frenzyDuration *= this.goldenCookieDurationScale;
// 	if (this.enablesElderCovenant != undefined)
// 		eval.elderCovenant = true;
// 	if (this.disablesElderCovenant != undefined)
// 		eval.elderCovenant = false;
// 	if (this.clickBoost != undefined)
// 		eval.cpcBase += this.clickBoost;
// 	if (this.givesTotalBuildingBonusTo != undefined)
// 		eval.buildings[this.givesTotalBuildingBonusTo].buildingScaler.addCountMost(this.givesTotalBuildingBonusExcluding, this.givesTotalBuildingBonusAmount);
// 	if (this.buildingCostScale != undefined)
// 		eval.buildingCostScale *= this.buildingCostScale;
// 	if (this.totalClickScale != undefined)
// 		eval.cpcMultiplier *= this.totalClickScale;
// 	if (this.santaPowerBoost != undefined)
// 		eval.santaPower += this.santaPowerBoost;
// 	if (this.milkScale != undefined)
// 		eval.milkMultiplier *= this.milkScale;
// 	if (this.increasesSantaLevel != undefined)
// 		++eval.santaLevel;
// 	if (this.reindeerFrequencyScale != undefined)
// 		eval.reindeerTime /= this.reindeerFrequencyScale;
// 	if (this.reindeerScale != undefined)
// 		eval.reindeerMultiplier *= this.reindeerScale;
// 	if (this.setsSeason != undefined) {
// 		this.restoreSeason = eval.season;
// 		eval.season = this.setsSeason;
// 	}
// 	if (this.baseCpsBoost != undefined)
// 		eval.baseCps += this.baseCpsBoost;
// 	if (this.centuryProductionBoost != undefined)
// 		eval.centuryProductionMultiplier += this.centuryProductionBoost;
// 	if (this.wrinklerScale != undefined)
// 		eval.wrinklerMultiplier *= this.wrinklerScale;
// }

// Upgrade.prototype.revokeUpgrade = function(eval) {
// 	if (this.globalProductionBoost != undefined)
// 		eval.globalProductionMultiplier -= this.globalProductionBoost;
// 	if (this.goldenCookieDelayScale != undefined)
// 		eval.goldenCookieTime /= this.goldenCookieDelayScale;
// 	if (this.goldenCookieDurationScale != undefined)
// 		eval.frenzyDuration /= this.goldenCookieDurationScale;
// 	if (this.enablesElderCovenant != undefined)
// 		eval.elderCovenant = false;
// 	if (this.disablesElderCovenant != undefined)
// 		eval.elderCovenant = true;
// 	if (this.clickBoost != undefined)
// 		eval.cpcBase -= this.clickBoost;
// 	if (this.givesTotalBuildingBonusTo != undefined)
// 		eval.buildings[this.givesTotalBuildingBonusTo].buildingScaler.subtractCountMost(this.givesTotalBuildingBonusExcluding, this.givesTotalBuildingBonusAmount);
// 	if (this.buildingCostScale != undefined)
// 		eval.buildingCostScale /= this.buildingCostScale;
// 	if (this.totalClickScale != undefined)
// 		eval.cpcMultiplier /= this.totalClickScale;
// 	if (this.santaPowerBoost != undefined)
// 		eval.santaPower -= this.santaPowerBoost;
// 	if (this.milkScale != undefined)
// 		eval.milkMultiplier /= this.milkScale;
// 	if (this.increasesSantaLevel != undefined)
// 		--eval.santaLevel;
// 	if (this.reindeerFrequencyScale != undefined)
// 		eval.reindeerTime *= this.reindeerFrequencyScale;
// 	if (this.reindeerScale != undefined)
// 		eval.reindeerMultiplier /= this.reindeerScale;
// 	if (this.restoreSeason != undefined) {
// 		eval.season = this.restoreSeason;
// 		this.restoreSeason = null;
// 	}
// 	if (this.baseCpsBoost != undefined)
// 		eval.baseCps -= this.baseCpsBoost;
// 	if (this.centuryProductionBoost != undefined)
// 		eval.centuryProductionMultiplier -= this.centuryProductionBoost;
// 	if (this.wrinklerScale != undefined)
// 		eval.wrinklerMultiplier /= this.wrinklerScale;
// }

// Upgrade.prototype.boostsGlobalProduction = function(amount) {
// 	this.globalProductionBoost = amount;
// 	return this;
// }

// Upgrade.prototype.scalesGoldenCookieDelay = function(scale) {
// 	this.goldenCookieDelayScale = scale;
// 	return this;
// }

// Upgrade.prototype.scalesGoldenCookieDuration = function(scale) {
// 	this.goldenCookieDurationScale = scale;
// 	return this;
// }

// Upgrade.prototype.boostsResearch = function() {
// 	this.isResearchBooster = true;
// 	return this;
// }

// Upgrade.prototype.startsElderCovenant = function() {
// 	this.enablesElderCovenant = true;
// 	return this;
// }

// Upgrade.prototype.endsElderCovenant = function() {
// 	this.disablesElderCovenant = true;
// 	return this;
// }

// Upgrade.prototype.givesTotalBuildingBonus = function(receiver, exclude, amount) {
// 	this.givesTotalBuildingBonusTo = receiver;
// 	this.givesTotalBuildingBonusExcluding = exclude;
// 	this.givesTotalBuildingBonusAmount = amount;
// 	return this;
// }

// Upgrade.prototype.boostsClicking = function(amount) {
// 	this.clickBoost = amount;
// 	return this;
// }

// Upgrade.prototype.unlocksSantaLevels = function() {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.01;
// 	return this;
// }

// Upgrade.prototype.scalesBuildingCpsCost = function(scale) {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + (1 - scale);
// 	this.buildingCostScale = scale;
// 	return this;
// }

// Upgrade.prototype.scalesUpgradeCost = function(scale) {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.01 * (1 - scale);
// 	return this;
// }

// Upgrade.prototype.increasesRandomDropChance = function(amount) {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001 * amount;
// 	return this;
// }

// Upgrade.prototype.scalesTotalClicking = function(scale) {
// 	this.totalClickScale = scale;
// 	return this;
// }

// Upgrade.prototype.boostsSantaPower = function(amount) {
// 	this.santaPowerBoost = amount;
// 	return this;
// }

// Upgrade.prototype.increasesSantasLevel = function() {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.005;
// 	this.increasesSantaLevel = true;
// 	return this;
// }

// Upgrade.prototype.scalesMilk = function(scale) {
// 	this.milkScale = scale;
// 	return this;
// }

// Upgrade.prototype.slowsReindeer = function(scale) {
// 	// Set a tiny percentage CPS value just to buy it
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001;
// 	return this;
// }

// Upgrade.prototype.scalesReindeerFrequency = function(scale) {
// 	this.reindeerFrequencyScale = scale;
// 	return this;
// }

// Upgrade.prototype.scalesReindeer = function(scale) {
// 	this.reindeerScale = scale;
// 	return this;
// }

// Upgrade.prototype.unlocksSeasonSwitching = function() {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.05;
// 	this.unlocksSeasons = true;
// 	return this;
// }

// Upgrade.prototype.changesSeason = function(season) {
// 	this.setsSeason = season;
// 	return this;
// }

// Upgrade.prototype.forSeason = function(season) {
// 	this.season = season;
// 	return this;
// }

// Upgrade.prototype.boostsBaseCps = function(amount) {
// 	this.baseCpsBoost = amount;
// 	return this;
// }

// Upgrade.prototype.boostsCenturyProduction = function(amount) {
// 	this.centuryProductionBoost = amount;
// 	return this;
// }

// Upgrade.prototype.scalesWrinklers = function(scale) {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.05;
// 	this.wrinklerScale = scale;
// 	return this;
// }

// Upgrade.prototype.increasesEggDropChance = function(amount) {
// 	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001 * amount;
// 	return this;
// }

// Upgrade.prototype.scalesCookieBank = function(scale) {
// 	return this;
// }

upgrade = function(name, supported=1) {
	var u = new Upgrade(name, supported);
	upgradeIndex[name] = u;
	upgradeFunctions[u.variableName] = u;
	return u;
}

// Upgrades for the basic building types
upgrade("Cursor"				).builds(Constants.CURSOR_INDEX, 1);
upgrade("Grandma"				).builds(Constants.GRANDMA_INDEX, 1);
upgrade("Farm"					).builds(Constants.FARM_INDEX, 1);
upgrade("Mine"					).builds(Constants.MINE_INDEX, 1);
upgrade("Factory"				).builds(Constants.FACTORY_INDEX, 1);
upgrade("Bank"					).builds(Constants.BANK_INDEX, 1);
upgrade("Temple"				).builds(Constants.TEMPLE_INDEX, 1);
upgrade("Wizard tower"			).builds(Constants.WIZARD_TOWER_INDEX, 1);
upgrade("Shipment"				).builds(Constants.SHIPMENT_INDEX, 1);
upgrade("Alchemy lab"			).builds(Constants.ALCHEMY_LAB_INDEX, 1);
upgrade("Portal"				).builds(Constants.PORTAL_INDEX, 1);
upgrade("Time machine"			).builds(Constants.TIME_MACHINE_INDEX, 1);
upgrade("Antimatter condenser"	).builds(Constants.ANTIMATTER_CONDENSER_INDEX, 1);
upgrade("Prism"					).builds(Constants.PRISM_INDEX, 1);
upgrade("Chancemaker"			).builds(Constants.CHANCEMAKER_INDEX, 1);

// Upgrades that double the productivity of a type of building
upgrade("Forwards from grandma"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Steel-plated rolling pins"		).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Lubricated dentures"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Double-thick glasses"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Prune juice"					).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Aging agents"					).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Xtreme walkers"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("The Unbridling"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Reverse dementia"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Farmer grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.FARM_INDEX, Constants.GRANDMA_INDEX, 0.01);
upgrade("Miner grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.MINE_INDEX, Constants.GRANDMA_INDEX, 0.01 / 2);
upgrade("Worker grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.FACTORY_INDEX, Constants.GRANDMA_INDEX, 0.01 / 3);
upgrade("Banker grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.BANK_INDEX, Constants.GRANDMA_INDEX, 0.01 / 4);
upgrade("Priestess grandmas"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.TEMPLE_INDEX, Constants.GRANDMA_INDEX, 0.01 / 5);
upgrade("Witch grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.WIZARD_TOWER_INDEX, Constants.GRANDMA_INDEX, 0.01 / 6);
upgrade("Cosmic grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.SHIPMENT_INDEX, Constants.GRANDMA_INDEX, 0.01 / 7);
upgrade("Transmuted grandmas"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.ALCHEMY_LAB_INDEX, Constants.GRANDMA_INDEX, 0.01 / 8);
upgrade("Altered grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.PORTAL_INDEX, Constants.GRANDMA_INDEX, 0.01 / 9);
upgrade("Grandmas' grandmas"			).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.TIME_MACHINE_INDEX, Constants.GRANDMA_INDEX, 0.01 / 10);
upgrade("Antigrandmas"					).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.ANTIMATTER_CONDENSER_INDEX, Constants.GRANDMA_INDEX, 0.01 / 11);
upgrade("Rainbow grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.PRISM_INDEX, Constants.GRANDMA_INDEX, 0.01 / 12);
upgrade("Lucky grandmas"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.CHANCEMAKER_INDEX, Constants.GRANDMA_INDEX, 0.01 / 13);
upgrade("Cheap hoes"					).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Fertilizer"					).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Cookie trees"					).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Genetically-modified cookies"	).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Gingerbread scarecrows"		).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Pulsar sprinklers"				).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Fudge fungus"					).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Wheat triffids"				).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Humane pesticides"				).scalesBuildingCps(Constants.FARM_INDEX, 2);
upgrade("Sugar gas"						).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Megadrill"						).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Ultradrill"					).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Ultimadrill"					).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("H-bomb mining"					).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Coreforge"						).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Planetsplitters"				).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Canola oil wells"				).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Mole people"					).scalesBuildingCps(Constants.MINE_INDEX, 2);
upgrade("Sturdier conveyor belts"		).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Child labor"					).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Sweatshop"						).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Radium reactors"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Recombobulators"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Deep-bake process"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Cyborg workforce"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("78-hour days"					).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Machine learning"				).scalesBuildingCps(Constants.FACTORY_INDEX, 2);
upgrade("Taller tellers"				).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Scissor-resistant credit cards").scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Acid-proof vaults"				).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Chocolate coins"				).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Exponential interest rates"	).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Financial zen"					).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Way of the wallet"				).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("The stuff rationale"			).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Edible money"					).scalesBuildingCps(Constants.BANK_INDEX, 2);
upgrade("Golden idols"					).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Sacrifices"					).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Delicious blessing"			).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Sun festival"					).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Enlarged pantheon"				).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Great Baker in the sky"		).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Creation myth"					).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Theocracy"						).scalesBuildingCps(Constants.TEMPLE_INDEX, 2);
upgrade("Pointier hats"					).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Beardlier beards"				).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Ancient grimoires"				).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Kitchen curses"				).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("School of sorcery"				).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Dark formulas"					).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Cookiemancy"					).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Rabbit trick"					).scalesBuildingCps(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Vanilla nebulae"				).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Wormholes"						).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Frequent flyer"				).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Warp drive"					).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Chocolate monoliths"			).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Generation ship"				).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Dyson sphere"					).scalesBuildingCps(Constants.SHIPMENT_INDEX, 2);
upgrade("Antimony"						).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Essence of dough"				).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("True chocolate"				).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Ambrosia"						).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Aqua crustulae"				).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Origin crucible"				).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Theory of atomic fluidity"		).scalesBuildingCps(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Ancient tablet"				).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Insane oatling workers"		).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Soul bond"						).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Sanity dance"					).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Brane transplant"				).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Deity-sized portals"			).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("End of times back-up plan"		).scalesBuildingCps(Constants.PORTAL_INDEX, 2);
upgrade("Flux capacitors"				).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Time paradox resolver"			).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Quantum conundrum"				).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Causality enforcer"			).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Yestermorrow comparators"		).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Far future enactment"			).scalesBuildingCps(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Sugar bosons"					).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("String theory"					).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Large macaron collider"		).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Big bang bake"					).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Reverse cyclotrons"			).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Nanocosmics"					).scalesBuildingCps(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Gem polish"					).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("9th color"						).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Chocolate light"				).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Grainbow"						).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Pure cosmic light"				).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Glow-in-the-dark"				).scalesBuildingCps(Constants.PRISM_INDEX, 2);
upgrade("Your lucky cookie"				).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);
upgrade('"All Bets Are Off" magic coin' ).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);
upgrade("Winning lottery ticket" 		).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);
upgrade("Four-leaf clover field" 		).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);
upgrade("A recipe book about books"		).scalesBuildingCps(Constants.CHANCEMAKER_INDEX, 2);

// Upgrades that increase cookie production
upgrade("Plain cookies"											).scalesProduction(1.01);
upgrade("Sugar cookies"											).scalesProduction(1.01);
upgrade("Oatmeal raisin cookies"								).scalesProduction(1.01);
upgrade("Peanut butter cookies"									).scalesProduction(1.01);
upgrade("Coconut cookies"										).scalesProduction(1.01);
upgrade("White chocolate cookies"								).scalesProduction(1.02);
upgrade("Macadamia nut cookies"									).scalesProduction(1.02);
upgrade("Double-chip cookies"									).scalesProduction(1.02);
upgrade("White chocolate macadamia nut cookies"					).scalesProduction(1.02);
upgrade("All-chocolate cookies"									).scalesProduction(1.02);
upgrade("Dark chocolate-coated cookies"							).scalesProduction(1.04);
upgrade("White chocolate-coated cookies"						).scalesProduction(1.04);
upgrade("Eclipse cookies"										).scalesProduction(1.02);
upgrade("Zebra cookies"											).scalesProduction(1.02);
upgrade("Snickerdoodles"										).scalesProduction(1.02);
upgrade("Stroopwafels"											).scalesProduction(1.02);
upgrade("Macaroons"												).scalesProduction(1.02);
upgrade("Empire biscuits"										).scalesProduction(1.02);
upgrade("Madeleines"											).scalesProduction(1.02);
upgrade("Palmiers"												).scalesProduction(1.02);
upgrade("Palets"												).scalesProduction(1.02);
upgrade("Sabl&eacute;s"											).scalesProduction(1.02);
upgrade("Gingerbread men"										).scalesProduction(1.02);
upgrade("Gingerbread trees"										).scalesProduction(1.02);
upgrade("Pure black chocolate cookies"							).scalesProduction(1.04);
upgrade("Pure white chocolate cookies"							).scalesProduction(1.04);
upgrade("Ladyfingers"											).scalesProduction(1.03);
upgrade("Tuiles"												).scalesProduction(1.03);
upgrade("Chocolate-stuffed biscuits"							).scalesProduction(1.03);
upgrade("Checker cookies"										).scalesProduction(1.03);
upgrade("Butter cookies"										).scalesProduction(1.03);
upgrade("Cream cookies"											).scalesProduction(1.03);
upgrade("Gingersnaps"											).scalesProduction(1.04);
upgrade("Cinnamon cookies"										).scalesProduction(1.04);
upgrade("Vanity cookies"										).scalesProduction(1.04);
upgrade("Cigars"												).scalesProduction(1.04);
upgrade("Pinwheel cookies"										).scalesProduction(1.04);
upgrade("Fudge squares"											).scalesProduction(1.04);
upgrade("Shortbread biscuits"									).scalesProduction(1.04);
upgrade("Millionaires' shortbreads"								).scalesProduction(1.04);
upgrade("Caramel cookies"										).scalesProduction(1.04);
upgrade("Pecan sandies"											).scalesProduction(1.04);
upgrade("Moravian spice cookies"								).scalesProduction(1.04);
upgrade("Milk chocolate butter biscuit"							).scalesProduction(1.10);
upgrade("Anzac biscuits"										).scalesProduction(1.04);
upgrade("Buttercakes"											).scalesProduction(1.04);
upgrade("Ice cream sandwiches"									).scalesProduction(1.04);
// upgrade("British tea biscuits"									).scalesProduction(15);
// upgrade("Chocolate british tea biscuits"						).scalesProduction(15);
// upgrade("Round british tea biscuits"							).scalesProduction(15);
// upgrade("Round chocolate british tea biscuits"					).scalesProduction(15);
// upgrade("Round british tea biscuits with heart motif"			).scalesProduction(15);
// upgrade("Round chocolate british tea biscuits with heart motif"	).scalesProduction(15);
// upgrade("Shortfoils"											).scalesProduction(25);
// upgrade("Fig gluttons"											).scalesProduction(25);
// upgrade("Loreols"												).scalesProduction(25);
// upgrade("Jaffa cakes"											).scalesProduction(25);
// upgrade("Grease's cups"											).scalesProduction(25);
// upgrade("Sagalongs"												).scalesProduction(25);
// upgrade("Win mints"												).scalesProduction(25);
// upgrade("Caramoas"												).scalesProduction(25);
// upgrade("Rose macarons"											).scalesProduction(30);
// upgrade("Lemon macarons"										).scalesProduction(30);
// upgrade("Chocolate macarons"									).scalesProduction(30);
// upgrade("Pistachio macarons"									).scalesProduction(30);
// upgrade("Hazelnut macarons"										).scalesProduction(30);
// upgrade("Violet macarons"										).scalesProduction(30);
// upgrade("Caramel macarons"										).scalesProduction(30);
// upgrade("Licorice macarons"										).scalesProduction(30);

// Golden cookie upgrade functions
// upgrade("Lucky day"		).scalesGoldenCookieDelay(0.5);
// upgrade("Serendipity"	).scalesGoldenCookieDelay(0.5);
// upgrade("Get lucky"		).scalesGoldenCookieDuration(2);

// Research centre related upgrades
upgrade("Bingo center/Research facility").startsResearch().scalesBuildingCps(Constants.GRANDMA_INDEX, 4);
upgrade("Specialized chocolate chips"	).startsResearch().scalesProduction(1.01);
upgrade("Designer cocoa beans"			).startsResearch().scalesProduction(1.02);
upgrade("Ritual rolling pins"			).startsResearch().scalesBuildingCps(Constants.GRANDMA_INDEX, 2);
upgrade("Underworld ovens"				).startsResearch().scalesProduction(1.03);
upgrade("One mind"						).startsResearch().givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02).angersGrandmas();
upgrade("Exotic nuts"					).startsResearch().scalesProduction(1.04);
upgrade("Communal brainsweep"			).startsResearch().givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02).angersGrandmas();
upgrade("Arcane sugar"					).startsResearch().scalesProduction(1.05);
upgrade("Elder Pact"					).givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.PORTAL_INDEX, 0.05).angersGrandmas();
// upgrade("Persistent memory"				).boostsResearch();

// Elder pledge
upgrade("Elder Pledge", false			).calmsGrandmas();		// The false means this isn't one of the listed upgrades on the stats page
upgrade("Sacrificial rolling pins"		).doublesElderPledge();
// upgrade("Elder Covenant"			).startsElderCovenant();
// upgrade("Revoke Elder Covenant"		).endsElderCovenant();

// Assorted cursor / clicking upgrades
upgrade("Reinforced index finger"		).scalesBaseClicking(2).scalesBuildingCps(Constants.CURSOR_INDEX, 2);
upgrade("Carpal tunnel prevention cream").scalesBaseClicking(2).scalesBuildingCps(Constants.CURSOR_INDEX, 2);
upgrade("Ambidextrous"					).scalesBaseClicking(2).scalesBuildingCps(Constants.CURSOR_INDEX, 2);
upgrade("Thousand fingers"				).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 0.1).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 0.1);
upgrade("Million fingers"				).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 0.5).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 0.5);
upgrade("Billion fingers"				).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 5).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 5);
upgrade("Trillion fingers"				).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 50).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 50);
upgrade("Quadrillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 500).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 500);
upgrade("Quintillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 5000).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 5000);
upgrade("Sextillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 50000).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 50000);
upgrade("Septillion fingers"			).givesBuildingPerBuildingFlatCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 500000).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 500000);
// upgrade("Octillion fingers"				).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 800);
upgrade("Plastic mouse"					).boostsClickCps(0.01);
upgrade("Iron mouse"					).boostsClickCps(0.01);
upgrade("Titanium mouse"				).boostsClickCps(0.01);
upgrade("Adamantium mouse"				).boostsClickCps(0.01);
upgrade("Unobtainium mouse"				).boostsClickCps(0.01);
upgrade("Eludium mouse"					).boostsClickCps(0.01);
upgrade("Wishalloy mouse"				).boostsClickCps(0.01);
upgrade("Fantasteel mouse"				).boostsClickCps(0.01);
upgrade("Nevercrack mouse"				).boostsClickCps(0.01);
upgrade("Armythril mouse"				).boostsClickCps(0.01);

// Milk increases
upgrade("Kitten helpers"		).unlocksMilk(0.1);
upgrade("Kitten workers"		).unlocksMilk(0.125);
upgrade("Kitten engineers"		).unlocksMilk(0.15);
upgrade("Kitten overseers"		).unlocksMilk(0.175);
upgrade("Kitten managers"		).unlocksMilk(0.2);
upgrade("Kitten accountants"	).unlocksMilk(0.2);
upgrade("Kitten specialists"	).unlocksMilk(0.2);
upgrade("Kitten experts"		).unlocksMilk(0.2);

// Prestige power unlocks
upgrade("Heavenly chip secret"	).unlocksPrestige(0.05);
upgrade("Heavenly cookie stand"	).unlocksPrestige(0.20);
upgrade("Heavenly bakery"		).unlocksPrestige(0.25);
upgrade("Heavenly confectionery").unlocksPrestige(0.25);
upgrade("Heavenly key"			).unlocksPrestige(0.25);

// Season switcher and season changers
// upgrade("Season switcher"	).unlocksSeasonSwitching();
// upgrade("Lovesick biscuit"	).changesSeason(Constants.VALENTINES_DAY);
// upgrade("Ghostly biscuit"	).changesSeason(Constants.HALLOWEEN);
// upgrade("Festive biscuit"	).changesSeason(Constants.CHRISTMAS);
// upgrade("Fool's biscuit"	).changesSeason(Constants.BUSINESS_DAY);
// upgrade("Bunny biscuit"		).changesSeason(Constants.EASTER);

// Valentines day season upgrades
// upgrade("Pure heart biscuits"	).scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Ardent heart biscuits"	).scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Sour heart biscuits"	).scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Weeping heart biscuits").scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Golden heart biscuits"	).scalesProduction(25).forSeason(Constants.VALENTINES_DAY);
// upgrade("Eternal heart biscuits").scalesProduction(25).forSeason(Constants.VALENTINES_DAY);

// Halloween season upgrades
// upgrade("Skull cookies"		).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Ghost cookies"		).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Bat cookies"		).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Slime cookies"		).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Pumpkin cookies"	).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Eyeball cookies"	).scalesProduction(20).forSeason(Constants.HALLOWEEN);
// upgrade("Spider cookies"	).scalesProduction(20).forSeason(Constants.HALLOWEEN);

// Christmas season
upgrade("Santa Level"				);	// Incomplete definition, temporary bug workaround
// upgrade("A festive hat"				).unlocksSantaLevels().forSeason(Constants.CHRISTMAS);
// upgrade("Santa Level"				).increasesSantasLevel().forSeason(Constants.CHRISTMAS);
// upgrade("Weighted sleighs"			).slowsReindeer(2).forSeason(Constants.CHRISTMAS);
// upgrade("Reindeer baking grounds"	).scalesReindeerFrequency(2).forSeason(Constants.CHRISTMAS);
// upgrade("Ho ho ho-flavored frosting").scalesReindeer(2).forSeason(Constants.CHRISTMAS);
// upgrade("Season savings"			).scalesBuildingCpsCost(0.99).forSeason(Constants.CHRISTMAS);
// upgrade("Toy workshop"				).scalesUpgradeCost(0.95).forSeason(Constants.CHRISTMAS);
// upgrade("Santa's bottomless bag"	).increasesRandomDropChance(10).forSeason(Constants.CHRISTMAS);
// upgrade("Santa's helpers"			).scalesTotalClicking(1.1).forSeason(Constants.CHRISTMAS);
// upgrade("Santa's legacy"			).boostsSantaPower(10).forSeason(Constants.CHRISTMAS);
// upgrade("Santa's milk and cookies"	).scalesMilk(1.05).forSeason(Constants.CHRISTMAS);
// upgrade("A lump of coal"			).scalesProduction(1).forSeason(Constants.CHRISTMAS);
// upgrade("An itchy sweater"			).scalesProduction(1).forSeason(Constants.CHRISTMAS);
// upgrade("Improved jolliness"		).scalesProduction(15).forSeason(Constants.CHRISTMAS);
// upgrade("Increased merriness"		).scalesProduction(15).forSeason(Constants.CHRISTMAS);
upgrade("Christmas tree biscuits"	).scalesProduction(1.02).requires("christmas");
upgrade("Snowflake biscuits"		).scalesProduction(1.02).requires("christmas");
upgrade("Snowman biscuits"			).scalesProduction(1.02).requires("christmas");
upgrade("Holly biscuits"			).scalesProduction(1.02).requires("christmas");
upgrade("Candy cane biscuits"		).scalesProduction(1.02).requires("christmas");
upgrade("Bell biscuits"				).scalesProduction(1.02).requires("christmas");
upgrade("Present biscuits"			).scalesProduction(1.02).requires("christmas");
// upgrade("Santa's dominion"			).scalesProduction(50).scalesBuildingCpsCost(0.99).scalesUpgradeCost(0.98).forSeason(Constants.CHRISTMAS);
// upgrade("Naughty list"				).scalesBuildingCps(Constants.GRANDMA_INDEX, 2).forSeason(Constants.CHRISTMAS);

// Easter season
// upgrade("Ant larva"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Cassowary egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Chicken egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Duck egg"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Frogspawn"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Ostrich egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Quail egg"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Robin egg"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Salmon roe"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Shark egg"					).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Turkey egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Turtle egg"				).boostsGlobalProduction(1).forSeason(Constants.EASTER);
// upgrade("Golden goose egg"			).scalesGoldenCookieDelay(0.95).forSeason(Constants.EASTER);
// upgrade("\"egg\""					).boostsBaseCps(9).forSeason(Constants.EASTER);
// upgrade("Cookie egg"				).scalesTotalClicking(1.1).forSeason(Constants.EASTER);
// upgrade("Century egg"				).boostsCenturyProduction(10).forSeason(Constants.EASTER);
// upgrade("Wrinklerspawn"				).scalesWrinklers(1.05).forSeason(Constants.EASTER);
// upgrade("Omelette"					).increasesEggDropChance(10).forSeason(Constants.EASTER);
// upgrade("Faberge egg"				).scalesUpgradeCost(0.99).scalesBuildingCpsCost(0.99).forSeason(Constants.EASTER);
// upgrade("Chocolate egg"				).scalesCookieBank(1.05).forSeason(Constants.EASTER);

getUpgradeFunction = function(name) {
	if (upgradeIndex[name] == undefined) {
		upgrade(name, 0);
		console.log("Unknown upgrade: " + name);
	}
	return upgradeIndex[name];
}

//
// Utility stuff and starting the app off
//

// Compare floats with an epsilon value
function floatEqual(a, b) {
	var eps = Math.abs(a - b) * 1000000000000.0;
	return eps <= Math.abs(a) && eps <= Math.abs(b);
}

console.log("Ultimate Cookie starting at " + new Date() + " supporting " + upgradesSupported + " upgrades and " + upgradeBuildingsSupported + " buildings.");

// Create the upgradeInfo and Ultimate Cookie instances
var ultimateCookie = new UltimateCookie();
