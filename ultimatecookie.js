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

// General purpose constants
Constants.SUPPORTED_VERSION = "2.0042";
Constants.VERSION_ERROR = "Warning: Ultimate Cookie only supports version " + Constants.SUPPORTED_VERSION + " of the game. Your mileage may vary.\n";
Constants.AUTO_BUY_MIN_INTERVAL = 1;
Constants.AUTO_BUY_MAX_INTERVAL = 1010;
Constants.AUTO_CLICK_INTERVAL = 1;
Constants.AUTO_UPDATE_INTERVAL = 1000;
Constants.CLICK_RATE_ESTIMATE_SAMPLES = 120;
Constants.SEASON_SWITCH_DELAY = 11000;			// Season changes dont register in game immediately, this stops rapid switching
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
Constants.NO_SEASON = "";
Constants.BUSINESS_DAY = "fools";
Constants.CHRISTMAS = "christmas";
Constants.EASTER = "easter";
Constants.HALLOWEEN = "halloween";
Constants.VALENTINES_DAY = "valentines";
Constants.MAX_SANTA_LEVEL = 14;

var seasons = {};
seasons[Constants.NO_SEASON] = {
	name: Constants.NO_SEASON,
	numUpgrades: 0,
	wrinklersDropUpgrades: false,
};
seasons[Constants.BUSINESS_DAY] = {
	name: Constants.BUSINESS_DAY,
	numUpgrades: 0,
	wrinklersDropUpgrades: false,
};
seasons[Constants.CHRISTMAS] = {
	name: Constants.CHRISTMAS,
	numUpgrades: 23,
	wrinklersDropUpgrades: false,
};
seasons[Constants.EASTER] = {
	name: Constants.EASTER,
	numUpgrades: 20,
	wrinklersDropUpgrades: true,
};
seasons[Constants.HALLOWEEN] = {
	name: Constants.HALLOWEEN,
	numUpgrades: 7,
	wrinklersDropUpgrades: true,
};
seasons[Constants.VALENTINES_DAY] = {
	name: Constants.VALENTINES_DAY,
	numUpgrades: 6,
	wrinklersDropUpgrades: false,
};

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
	if (Config.autoPledge && (!seasons[eval.season].wrinklersDropUpgrades || eval.lockedSeasonUpgrades[eval.season] == 0)) {
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
		console.log("CpS margin: " + Math.round(eval.getCps() - Game.cookiesPs) + ", next: " + this.lastDeterminedPurchase);
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

		// If all upgrades for current season are bought, unlock season switching
		if (time < this.lockSeasonsTimer) {
			this.lockSeasons = true;
		} else if (this.currentGame.season == Constants.CHRISTMAS) {
			this.lockSeasons = (this.currentGame.santaLevel != Constants.MAX_SANTA_LEVEL);
		} else {
			this.lockSeasons = (this.currentGame.lockedSeasonUpgrades[this.currentGame.season] > 0 && this.currentGame.santaLevel > 0);
		}

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

		if (Config.autoPopWrinklers && seasons[this.currentGame.season].wrinklersDropUpgrades && this.currentGame.lockedSeasonUpgrades[this.currentGame.season] != 0) {
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
		this.currentGame.clickRate = this.clickRate;
	}
	if (Config.autoClickGoldenCookies) {
		this.popShimmer("golden");
		this.lastGoldenCookieTime = new Date().getTime();
	}
	if (Config.autoClickReindeer) {
		this.popShimmer("reindeer");
	}
	if (Config.autoReset) {
		// Wait until frenzy or clickFrenzy is over to reset
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
	this.perBuildingBaseCpsBoost = new BuildingCounter();
	this.buildingScaler = new BuildingCounter();
	this.buildingBaseScaler = new BuildingCounter();
}

EvaluatorBuilding.prototype.getCps = function() {
	return this.quantity * this.getIndividualCps();
}

EvaluatorBuilding.prototype.getIndividualCps = function() {
	if (typeof this.baseCps === 'function') {
		return this.baseCps();
	}
	return this.perBuildingBaseCpsBoost.getCount(this.evaluator.buildings) + this.baseCps * this.multiplier * (1 + this.buildingBaseScaler.getCount(this.evaluator.buildings)) * (1 + this.buildingScaler.getCount(this.evaluator.buildings));
}

EvaluatorBuilding.prototype.getCost = function() {
	return Math.ceil(this.evaluator.buildingCostScale * this.baseCost * Math.pow(1.15, this.quantity));
}

//
// Cost Evaluator, used to determine upgrade paths
//

function Evaluator() {
	this.initialize();
}

Evaluator.prototype.resetLockedUpgrades = function() {
	for (var i in seasons) {
		this.lockedSeasonUpgrades[seasons[i].name] = seasons[i].numUpgrades;
	}
}

// Check that the values in the evaluator match those of the game, for debugging use
Evaluator.prototype.matchesGame = function() {
	var errMsg = "";
	// Check that Cps matches the game
	var cps = this.getCps();
	if (!floatEqual(cps, Game.cookiesPs)) {
		errMsg += "- CpS - Predicted: " + this.getCps() + ", Actual: " + Game.cookiesPs + "\n";
	}
	// Check the Cpc matches the game
	var cpc = this.getCpc();
	var gcpc = Game.mouseCps();
	if (!floatEqual(cpc, gcpc)) {
		errMsg += "- CpC - Predicted: " + cpc + ", Actual: " + gcpc + "\n";
	}
	// Check the building costs match the game
	var i;
	for (i = 0; i < this.buildings.length; ++i) {
		if (this.buildings[i].name != Game.ObjectsById[i].name) {
			errMsg += "- Building Name " + this.buildings[i].name + " does not match " + Game.ObjectsById[i].name + "\n";			
		}
		if (!floatEqual(this.buildings[i].getCost(), Game.ObjectsById[i].getPrice())) {
			errMsg += "- Building Cost " + this.buildings[i].name + " - Predicted: " + this.buildings[i].getCost() + ", Actual: " + Game.ObjectsById[i].getPrice() + "\n";
		}
		if (!floatEqual(this.buildings[i].getIndividualCps(), Game.ObjectsById[i].cps(Game.ObjectsById[i]))) {
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
		if (uf.setsSeason == undefined && !floatEqual(uf.getCost(), u.getPrice())) {
			errMsg += "- Upgrade Cost " + u.name + " - Predicted: " + uf.getCost() + ", Actual: " + u.getPrice() + "\n";
		}
	}
	if (errMsg != "")
		errMsg = "Evaluator Mismatch:\n" + errMsg;

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
	if (this.clickFrenzy) {
		cpc *= Constants.CLICK_FRENZY_MULTIPLIER;
	}
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
	var heavenlyScale = this.heavenlyChips * this.heavenlyPower * 0.02;

	var scale = this.productionScale * (1 + santaScale + heavenlyScale);

	// Scale it for milk
	for (i = 0; i < this.milkUnlocks.length; ++i) {
		scale *= (1 + this.milkUnlocks[i] * this.milkAmount * this.milkMultiplier);
	}
	// Scale it for global production
	var sessionDays = Math.min(Math.floor((this.currentTime - this.sessionStartTime) / 1000 / 10) * 10 / 60 / 60 / 24, 100);
	var centuryMult = (1 - Math.pow(1 - sessionDays / 100, 3)) * this.centuryProductionMultiplier;

	scale *= (1 + (this.globalProductionMultiplier + centuryMult) * 0.01);

	// Scale it for frenzy
	if (this.frenzy) {
		scale *= this.frenzyMultiplier;
	}

	if (this.elderCovenant) {
		scale *= 0.95;
	}

	return cps * scale;
}

// Calculate the CpS at a specific frenzy multiplier
Evaluator.prototype.getFrenziedCps = function(multiplier) {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	var frenzyMultiplier = this.frenzyMultiplier;
	this.frenzy = 1;
	this.frenzyMultiplier = multiplier;
	this.clickFrenzy = 0;
	var cps = this.getCps();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
	this.frenzyMultiplier = frenzyMultiplier;
	return cps;
}

// Calculate the CpC at a specific frenzy multiplier
Evaluator.prototype.getFrenziedCpc = function(multiplier) {
	var frenzy = this.frenzy;
	var clickFrenzy = this.clickFrenzy;
	var frenzyMultiplier = this.frenzyMultiplier;
	this.frenzy = 1;
	this.frenzyMultiplier = multiplier;
	this.clickFrenzy = 0;
	var cpc = this.getCpc();
	this.frenzy = frenzy;
	this.clickFrenzy = clickFrenzy;
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

Evaluator.prototype.initialize = function(uc) {
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
	this.heavenlyPower = 0;

	// Milk scaling
	this.milkAmount = 0;
	this.milkMultiplier = 1;
	this.milkUnlocks = [];

	// Game status indicators
	this.frenzy = 0
	this.frenzyPower = 1;
	this.clickFrenzy = 0;

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
	this.season = Constants.NO_SEASON;
	this.lockedSeasonUpgrades = {};
	this.resetLockedUpgrades();

	this.matchError = "";
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
			uf.applyUpgrade(this);
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
	this.milkAmount = Game.AchievementsOwned / 25;
	this.frenzy = Game.hasBuff('Frenzy') ? 1 : 0;
	this.frenzyMultiplier = Game.hasBuff('Frenzy') ? Constants.FRENZY_MULTIPLIER : 1;
	this.clickFrenzy = Game.clickFrenzy;
	this.santaLevel = Game.santaLevel;
	this.season = Game.season;
	this.sessionStartTime = Game.startDate;
	this.currentTime = new Date().getTime();
}

//
// Classes to represent upgrades
//

var upgradeFunctions = {}
var upgradeIndex = {}
var upgradesSupported = 0;
var buildingsSupported = 0;

Upgrade = function(name, supported) {
	this.name = name;
	if (supported) {
		upgradesSupported += 1;
	}
}

Upgrade.prototype.applyUpgrade = function(eval) {
	if (this.buildsIndex != undefined)
		eval.buildings[this.buildsIndex].quantity += this.buildsQuantity;
	if (this.boostsBuildingIndex != undefined)
		eval.buildings[this.boostsBuildingIndex].baseCps += this.boostsBuildingAmount;
	if (this.scalesBuildingIndex != undefined)
		eval.buildings[this.scalesBuildingIndex].multiplier *= this.scalesBuildingScale;
	if (this.productionScale != undefined)
		eval.productionScale *= this.productionScale;
	if (this.globalProductionBoost != undefined)
		eval.globalProductionMultiplier += this.globalProductionBoost;
	if (this.goldenCookieDelayScale != undefined)
		eval.goldenCookieTime *= this.goldenCookieDelayScale;
	if (this.goldenCookieDurationScale != undefined)
		eval.frenzyDuration *= this.goldenCookieDurationScale;
	if (this.givesPerBuildingBoostTo != undefined)
		eval.buildings[this.givesPerBuildingBoostTo].buildingBaseScaler.addCountOne(this.givesPerBuildingBoostFrom, this.givesPerBuildingBoostAmount);
	if (this.givesBuildingPerBuildingBaseCpsBoostTo != undefined)
		eval.buildings[this.givesBuildingPerBuildingBaseCpsBoostTo].perBuildingBaseCpsBoost.addCounter(this.givesBuildingPerBuildingBaseCpsBoostCounter);
	if (this.givesPerBuildingFlatCpcBoostCounter != undefined)
		eval.perBuildingFlatCpcBoostCounter.addCounter(this.givesPerBuildingFlatCpcBoostCounter);
	if (this.enablesElderCovenant != undefined)
		eval.elderCovenant = true;
	if (this.disablesElderCovenant != undefined)
		eval.elderCovenant = false;
	if (this.clickBoost != undefined)
		eval.cpcBase += this.clickBoost;
	if (this.baseClickScale != undefined)
		eval.cpcBaseMultiplier *= this.baseClickScale;
	if (this.givesTotalBuildingBonusTo != undefined)
		eval.buildings[this.givesTotalBuildingBonusTo].buildingScaler.addCountMost(this.givesTotalBuildingBonusExcluding, this.givesTotalBuildingBonusAmount);
	if (this.makesGrandmasAngry)
		eval.grandmatriarchStatus++;
	if (this.clickCpsBoost != undefined)
		eval.cpcCpsMultiplier += this.clickCpsBoost;
	if (this.milkUnlock != undefined) {
		eval.milkUnlocks.push(this.milkUnlock);
		eval.milkUnlocks.sort();
	}
	if (this.heavenlyPowerBoost != undefined)
		eval.heavenlyPower += this.heavenlyPowerBoost;
	if (this.buildingCostScale != undefined)
		eval.buildingCostScale *= this.buildingCostScale;
	if (this.totalClickScale != undefined)
		eval.cpcMultiplier *= this.totalClickScale;
	if (this.santaPowerBoost != undefined)
		eval.santaPower += this.santaPowerBoost;
	if (this.milkScale != undefined)
		eval.milkMultiplier *= this.milkScale;
	if (this.increasesSantaLevel != undefined)
		++eval.santaLevel;
	if (this.reindeerFrequencyScale != undefined)
		eval.reindeerTime /= this.reindeerFrequencyScale;
	if (this.reindeerScale != undefined)
		eval.reindeerMultiplier *= this.reindeerScale;
	if (this.setsSeason != undefined) {
		this.restoreSeason = eval.season;
		eval.season = this.setsSeason;
	}
	if (this.baseCpsBoost != undefined)
		eval.baseCps += this.baseCpsBoost;
	if (this.centuryProductionBoost != undefined)
		eval.centuryProductionMultiplier += this.centuryProductionBoost;
	if (this.wrinklerScale != undefined)
		eval.wrinklerMultiplier *= this.wrinklerScale;
}

Upgrade.prototype.revokeUpgrade = function(eval) {
	if (this.buildsIndex != undefined)
		eval.buildings[this.buildsIndex].quantity -= this.buildsQuantity;
	if (this.boostsBuildingIndex != undefined)
		eval.buildings[this.boostsBuildingIndex].baseCps -= this.boostsBuildingAmount;
	if (this.scalesBuildingIndex != undefined)
		eval.buildings[this.scalesBuildingIndex].multiplier /= this.scalesBuildingScale;
	if (this.productionScale != undefined)
		eval.productionScale /= this.productionScale;
	if (this.globalProductionBoost != undefined)
		eval.globalProductionMultiplier -= this.globalProductionBoost;
	if (this.goldenCookieDelayScale != undefined)
		eval.goldenCookieTime /= this.goldenCookieDelayScale;
	if (this.goldenCookieDurationScale != undefined)
		eval.frenzyDuration /= this.goldenCookieDurationScale;
	if (this.givesPerBuildingBoostTo != undefined)
		eval.buildings[this.givesPerBuildingBoostTo].buildingBaseScaler.subtractCountOne(this.givesPerBuildingBoostFrom, this.givesPerBuildingBoostAmount);
	if (this.givesBuildingPerBuildingBaseCpsBoostTo != undefined)
		eval.buildings[this.givesBuildingPerBuildingBaseCpsBoostTo].perBuildingBaseCpsBoost.subtractCounter(this.givesBuildingPerBuildingBaseCpsBoostCounter);
	if (this.givesPerBuildingFlatCpcBoostCounter != undefined)
		eval.perBuildingFlatCpcBoostCounter.subtractCounter(this.givesPerBuildingFlatCpcBoostCounter);
	if (this.enablesElderCovenant != undefined)
		eval.elderCovenant = false;
	if (this.disablesElderCovenant != undefined)
		eval.elderCovenant = true;
	if (this.clickBoost != undefined)
		eval.cpcBase -= this.clickBoost;
	if (this.baseClickScale != undefined)
		eval.cpcBaseMultiplier /= this.baseClickScale;
	if (this.givesTotalBuildingBonusTo != undefined)
		eval.buildings[this.givesTotalBuildingBonusTo].buildingScaler.subtractCountMost(this.givesTotalBuildingBonusExcluding, this.givesTotalBuildingBonusAmount);
	if (this.makesGrandmasAngry)
		eval.grandmatriarchStatus--;
	if (this.clickCpsBoost != undefined)
		eval.cpcCpsMultiplier -= this.clickCpsBoost;
	if (this.milkUnlock != undefined)
		eval.milkUnlocks.splice(eval.milkUnlocks.indexOf(this.milkUnlock), 1);
	if (this.heavenlyPowerBoost != undefined)
		eval.heavenlyPower -= this.heavenlyPowerBoost;
	if (this.buildingCostScale != undefined)
		eval.buildingCostScale /= this.buildingCostScale;
	if (this.totalClickScale != undefined)
		eval.cpcMultiplier /= this.totalClickScale;
	if (this.santaPowerBoost != undefined)
		eval.santaPower -= this.santaPowerBoost;
	if (this.milkScale != undefined)
		eval.milkMultiplier /= this.milkScale;
	if (this.increasesSantaLevel != undefined)
		--eval.santaLevel;
	if (this.reindeerFrequencyScale != undefined)
		eval.reindeerTime *= this.reindeerFrequencyScale;
	if (this.reindeerScale != undefined)
		eval.reindeerMultiplier /= this.reindeerScale;
	if (this.restoreSeason != undefined) {
		eval.season = this.restoreSeason;
		this.restoreSeason = null;
	}
	if (this.baseCpsBoost != undefined)
		eval.baseCps -= this.baseCpsBoost;
	if (this.centuryProductionBoost != undefined)
		eval.centuryProductionMultiplier -= this.centuryProductionBoost;
	if (this.wrinklerScale != undefined)
		eval.wrinklerMultiplier /= this.wrinklerScale;
}

Upgrade.prototype.getVariableName = function() {
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

Upgrade.prototype.getGameObject = function() {
	if (this.buildsIndex != undefined)
		return Game.ObjectsById[this.buildsIndex];
	else
		return Game.Upgrades[this.name];
}

Upgrade.prototype.getCost = function() {
	if (this.setsSeason == Constants.VALENTINES_DAY) {
		return Math.max(upgradeFunctions.pureHeartBiscuits.getCost(), this.getGameObject().getPrice());
	}
	if (!Config.skipHalloween && this.setsSeason == Constants.HALLOWEEN) {
		return Math.max(upgradeFunctions.skullCookies.getCost(), this.getGameObject().getPrice());
	}
	if (this == upgradeFunctions.santaLevel) {
		return Math.pow(Game.santaLevel + 1, Game.santaLevel + 1)
	}
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
	this.applyUpgrade(eval);
	cps = eval.getEffectiveCps() - cps;
	this.revokeUpgrade(eval);
	return cps;
}

Upgrade.prototype.getValue = function(eval) {
	var val = this.getEffectiveCps(eval);
	if (this.valueFromTotalCps)
		val += eval.getEffectiveCps() * this.valueFromTotalCps;
	if (this.doublesElderPledgeDuration) {
		val += upgradeFunctions.elderPledge.getCost() / 3600;
	}
	if (this.setsSeason == Constants.VALENTINES_DAY && eval.lockedSeasonUpgrades[Constants.VALENTINES_DAY] > 0) {
		val = upgradeFunctions.pureHeartBiscuits.getValue(eval);
	}
	if (this.setsSeason == Constants.EASTER && eval.lockedSeasonUpgrades[Constants.EASTER] > 0) {
		if (eval.grandmatriarchStatus >= Constants.AWOKEN) {
			val = upgradeFunctions.chickenEgg.getValue(eval);
		}
	}
	if (this.setsSeason == Constants.HALLOWEEN && eval.lockedSeasonUpgrades[Constants.HALLOWEEN] > 0) {
		if (eval.grandmatriarchStatus >= Constants.AWOKEN && !Config.skipHalloween) {
			val = upgradeFunctions.skullCookies.getValue(eval);
		}
	}
	return val;
}

// Upgrade wrapper for purchasing buildings. By including buildings as a type of upgrade it makes the 
// process of sorting the next purchase a lot simpler.
Upgrade.prototype.builds = function(index, quantity) {
	this.buildsIndex = index;
	this.buildsQuantity = quantity;
	upgradesSupported -= 1;
	buildingsSupported += 1;
	return this;
}

Upgrade.prototype.boostsBuilding = function(index, amount) {
	this.boostsBuildingIndex = index;
	this.boostsBuildingAmount = amount;
	return this;
}

Upgrade.prototype.scalesBuilding = function(index, scale) {
	this.scalesBuildingIndex = index;
	this.scalesBuildingScale = scale;
	return this;
}

Upgrade.prototype.scalesProduction = function(amount) {
	this.productionScale = amount;
	return this;
}

Upgrade.prototype.boostsGlobalProduction = function(amount) {
	this.globalProductionBoost = amount;
	return this;
}

Upgrade.prototype.scalesGoldenCookieDelay = function(scale) {
	this.goldenCookieDelayScale = scale;
	return this;
}

Upgrade.prototype.scalesGoldenCookieDuration = function(scale) {
	this.goldenCookieDurationScale = scale;
	return this;
}

Upgrade.prototype.boostsResearch = function() {
	this.isResearchBooster = true;
	return this;
}

Upgrade.prototype.startsResearch = function() {
	this.isResearchStarter = true;
	return this;
}

Upgrade.prototype.startsElderCovenant = function() {
	this.enablesElderCovenant = true;
	return this;
}

Upgrade.prototype.endsElderCovenant = function() {
	this.disablesElderCovenant = true;
	return this;
}

Upgrade.prototype.startsElderPledge = function() {
	this.beginsElderPledge = true;
	return this;
}

Upgrade.prototype.doublesElderPledge = function() {
	this.doublesElderPledgeDuration = true;
	return this;
}

Upgrade.prototype.givesPerBuildingBoost = function(receiver, source, amount) {
	this.givesPerBuildingBoostTo = receiver;
	this.givesPerBuildingBoostFrom = source;
	this.givesPerBuildingBoostAmount = amount;
	return this;
}

// Adds a flat amount to the base CpS of a building based on count of buildings
// This amount is added before any other scaling factors are applied
Upgrade.prototype.givesBuildingPerBuildingBaseCpsBoost = function(receiver, excludes, amount)
{
	this.givesBuildingPerBuildingBaseCpsBoostTo = receiver;
	this.givesBuildingPerBuildingBaseCpsBoostCounter = new BuildingCounter().addCountMost(excludes, amount);
	return this;
}

// Add a flat amount to each click. This amount doesn't scale with any other multipliers and is added
// directly to the CpC amount after all other scaling is applied.
Upgrade.prototype.givesPerBuildingFlatCpcBoost = function(excludes, amount)
{
	this.givesPerBuildingFlatCpcBoostCounter = new BuildingCounter().addCountMost(excludes, amount);
	return this;
}

Upgrade.prototype.givesTotalBuildingBonus = function(receiver, exclude, amount) {
	this.givesTotalBuildingBonusTo = receiver;
	this.givesTotalBuildingBonusExcluding = exclude;
	this.givesTotalBuildingBonusAmount = amount;
	return this;
}

Upgrade.prototype.boostsClicking = function(amount) {
	this.clickBoost = amount;
	return this;
}

Upgrade.prototype.angersGrandmas = function() {
	this.makesGrandmasAngry = true;
	return this;
}

Upgrade.prototype.scalesBaseClicking = function(scale) {
	this.baseClickScale = scale;
	return this;
}

Upgrade.prototype.boostsClickCps = function(amount) {
	this.clickCpsBoost = amount;
	return this;
}

Upgrade.prototype.unlocksMilk = function(amount) {
	this.milkUnlock = amount;
	return this;
}

Upgrade.prototype.boostsHeavenlyPower = function(amount) {
	this.heavenlyPowerBoost = amount;
	return this;
}

Upgrade.prototype.unlocksSantaLevels = function() {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.01;
	return this;
}

Upgrade.prototype.scalesBuildingCost = function(scale) {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + (1 - scale);
	this.buildingCostScale = scale;
	return this;
}

Upgrade.prototype.scalesUpgradeCost = function(scale) {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.01 * (1 - scale);
	return this;
}

Upgrade.prototype.increasesRandomDropChance = function(amount) {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001 * amount;
	return this;
}

Upgrade.prototype.scalesTotalClicking = function(scale) {
	this.totalClickScale = scale;
	return this;
}

Upgrade.prototype.boostsSantaPower = function(amount) {
	this.santaPowerBoost = amount;
	return this;
}

Upgrade.prototype.increasesSantasLevel = function() {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.005;
	this.increasesSantaLevel = true;
	return this;
}

Upgrade.prototype.scalesMilk = function(scale) {
	this.milkScale = scale;
	return this;
}

Upgrade.prototype.slowsReindeer = function(scale) {
	// Set a tiny percentage CPS value just to buy it
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001;
	return this;
}

Upgrade.prototype.scalesReindeerFrequency = function(scale) {
	this.reindeerFrequencyScale = scale;
	return this;
}

Upgrade.prototype.scalesReindeer = function(scale) {
	this.reindeerScale = scale;
	return this;
}

Upgrade.prototype.unlocksSeasonSwitching = function() {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.05;
	this.unlocksSeasons = true;
	return this;
}

Upgrade.prototype.changesSeason = function(season) {
	this.setsSeason = season;
	return this;
}

Upgrade.prototype.forSeason = function(season) {
	this.season = season;
	return this;
}

Upgrade.prototype.boostsBaseCps = function(amount) {
	this.baseCpsBoost = amount;
	return this;
}

Upgrade.prototype.boostsCenturyProduction = function(amount) {
	this.centuryProductionBoost = amount;
	return this;
}

Upgrade.prototype.scalesWrinklers = function(scale) {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.05;
	this.wrinklerScale = scale;
	return this;
}

Upgrade.prototype.increasesEggDropChance = function(amount) {
	this.valueFromTotalCps = (this.valueFromTotalCps ? this.valueFromTotalCps : 0) + 0.0001 * amount;
	return this;
}

Upgrade.prototype.scalesCookieBank = function(scale) {
	return this;
}

upgrade = function(name, supported=1) {
	var u = new Upgrade(name, supported);
	upgradeIndex[name] = u;
	upgradeFunctions[u.getVariableName()] = u;
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
upgrade("Forwards from grandma"			).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Steel-plated rolling pins"		).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Lubricated dentures"			).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Double-thick glasses"			).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Prune juice"					).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Aging agents"					).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Xtreme walkers"				).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("The Unbridling"				).scalesBuilding(Constants.GRANDMA_INDEX, 2);
upgrade("Farmer grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.FARM_INDEX, Constants.GRANDMA_INDEX, 0.01);
upgrade("Miner grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.MINE_INDEX, Constants.GRANDMA_INDEX, 0.01 / 2);
upgrade("Worker grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.FACTORY_INDEX, Constants.GRANDMA_INDEX, 0.01 / 3);
upgrade("Banker grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.BANK_INDEX, Constants.GRANDMA_INDEX, 0.01 / 4);
upgrade("Priestess grandmas"			).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.TEMPLE_INDEX, Constants.GRANDMA_INDEX, 0.01 / 5);
upgrade("Witch grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.WIZARD_TOWER_INDEX, Constants.GRANDMA_INDEX, 0.01 / 6);
upgrade("Cosmic grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.SHIPMENT_INDEX, Constants.GRANDMA_INDEX, 0.01 / 7);
upgrade("Transmuted grandmas"			).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.ALCHEMY_LAB_INDEX, Constants.GRANDMA_INDEX, 0.01 / 8);
upgrade("Altered grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.PORTAL_INDEX, Constants.GRANDMA_INDEX, 0.01 / 9);
upgrade("Grandmas' grandmas"			).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.TIME_MACHINE_INDEX, Constants.GRANDMA_INDEX, 0.01 / 10);
upgrade("Antigrandmas"					).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.ANTIMATTER_CONDENSER_INDEX, Constants.GRANDMA_INDEX, 0.01 / 11);
upgrade("Rainbow grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.PRISM_INDEX, Constants.GRANDMA_INDEX, 0.01 / 12);
upgrade("Lucky grandmas"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).givesPerBuildingBoost(Constants.CHANCEMAKER_INDEX, Constants.GRANDMA_INDEX, 0.01 / 13);
upgrade("Cheap hoes"					).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Fertilizer"					).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Cookie trees"					).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Genetically-modified cookies"	).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Gingerbread scarecrows"		).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Pulsar sprinklers"				).scalesBuilding(Constants.FARM_INDEX, 2);
upgrade("Sugar gas"						).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("Megadrill"						).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("Ultradrill"					).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("Ultimadrill"					).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("H-bomb mining"					).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("Coreforge"						).scalesBuilding(Constants.MINE_INDEX, 2);
upgrade("Sturdier conveyor belts"		).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Child labor"					).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Sweatshop"						).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Radium reactors"				).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Recombobulators"				).scalesBuilding(Constants.FACTORY_INDEX, 2);
// upgrade("Deep-bake process"				).scalesBuilding(Constants.FACTORY_INDEX, 2);
upgrade("Taller tellers"				).scalesBuilding(Constants.BANK_INDEX, 2);
upgrade("Scissor-resistant credit cards").scalesBuilding(Constants.BANK_INDEX, 2);
upgrade("Acid-proof vaults"				).scalesBuilding(Constants.BANK_INDEX, 2);
upgrade("Chocolate coins"				).scalesBuilding(Constants.BANK_INDEX, 2);
upgrade("Exponential interest rates"	).scalesBuilding(Constants.BANK_INDEX, 2);
upgrade("Golden idols"					).scalesBuilding(Constants.TEMPLE_INDEX, 2);
upgrade("Sacrifices"					).scalesBuilding(Constants.TEMPLE_INDEX, 2);
upgrade("Delicious blessing"			).scalesBuilding(Constants.TEMPLE_INDEX, 2);
upgrade("Sun festival"					).scalesBuilding(Constants.TEMPLE_INDEX, 2);
upgrade("Enlarged pantheon"				).scalesBuilding(Constants.TEMPLE_INDEX, 2);
upgrade("Pointier hats"					).scalesBuilding(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Beardlier beards"				).scalesBuilding(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Ancient grimoires"				).scalesBuilding(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Kitchen curses"				).scalesBuilding(Constants.WIZARD_TOWER_INDEX, 2);
upgrade("Vanilla nebulae"				).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
upgrade("Wormholes"						).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
upgrade("Frequent flyer"				).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
upgrade("Warp drive"					).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
// upgrade("Chocolate monoliths"			).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
// upgrade("Generation ship"				).scalesBuilding(Constants.SHIPMENT_INDEX, 2);
upgrade("Antimony"						).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Essence of dough"				).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("True chocolate"				).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Ambrosia"						).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
// upgrade("Aqua crustulae"				).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
// upgrade("Origin crucible"				).scalesBuilding(Constants.ALCHEMY_LAB_INDEX, 2);
upgrade("Ancient tablet"				).scalesBuilding(Constants.PORTAL_INDEX, 2);
upgrade("Insane oatling workers"		).scalesBuilding(Constants.PORTAL_INDEX, 2);
upgrade("Soul bond"						).scalesBuilding(Constants.PORTAL_INDEX, 2);
upgrade("Sanity dance"					).scalesBuilding(Constants.PORTAL_INDEX, 2);
// upgrade("Brane transplant"				).scalesBuilding(Constants.PORTAL_INDEX, 2);
// upgrade("Deity-sized portals"			).scalesBuilding(Constants.PORTAL_INDEX, 2);
upgrade("Flux capacitors"				).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Time paradox resolver"			).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Quantum conundrum"				).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Causality enforcer"			).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
// upgrade("Yestermorrow comparators"		).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
// upgrade("Far future enactment"			).scalesBuilding(Constants.TIME_MACHINE_INDEX, 2);
upgrade("Sugar bosons"					).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("String theory"					).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Large macaron collider"		).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
// upgrade("Big bang bake"					).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
// upgrade("Reverse cyclotrons"			).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
// upgrade("Nanocosmics"					).scalesBuilding(Constants.ANTIMATTER_CONDENSER_INDEX, 2);
upgrade("Gem polish"					).scalesBuilding(Constants.PRISM_INDEX, 2);
upgrade("9th color"						).scalesBuilding(Constants.PRISM_INDEX, 2);
upgrade("Chocolate light"				).scalesBuilding(Constants.PRISM_INDEX, 2);
// upgrade("Grainbow"						).scalesBuilding(Constants.PRISM_INDEX, 2);
// upgrade("Pure cosmic light"				).scalesBuilding(Constants.PRISM_INDEX, 2);
// upgrade("Glow-in-the-dark"				).scalesBuilding(Constants.PRISM_INDEX, 2);
upgrade("Your lucky cookie"				).scalesBuilding(Constants.CHANCEMAKER_INDEX, 2);
upgrade('"All Bets Are Off" magic coin' ).scalesBuilding(Constants.CHANCEMAKER_INDEX, 2);
upgrade("Winning lottery ticket" 		).scalesBuilding(Constants.CHANCEMAKER_INDEX, 2);

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
upgrade("Bingo center/Research facility").startsResearch().scalesBuilding(Constants.GRANDMA_INDEX, 4);
upgrade("Specialized chocolate chips"	).startsResearch().scalesProduction(1.01);
upgrade("Designer cocoa beans"			).startsResearch().scalesProduction(1.02);
// upgrade("Persistent memory"				).boostsResearch();
// upgrade("Ritual rolling pins"			).scalesBuilding(Constants.GRANDMA_INDEX, 2).startsResearch();
// upgrade("Underworld ovens"				).scalesProduction(3).startsResearch();
// upgrade("One mind"						).givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02).angersGrandmas().startsResearch();
// upgrade("Exotic nuts"					).scalesProduction(4).startsResearch();
// upgrade("Communal brainsweep"			).givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.GRANDMA_INDEX, 0.02).angersGrandmas().startsResearch();
// upgrade("Arcane sugar"					).scalesProduction(5).startsResearch();
// upgrade("Elder Pact"					).givesPerBuildingBoost(Constants.GRANDMA_INDEX, Constants.PORTAL_INDEX, 0.05).angersGrandmas();

// Elder pledge related upgrades
// upgrade("Elder Covenant"			).startsElderCovenant();
// upgrade("Revoke Elder Covenant"		).endsElderCovenant();
// upgrade("Elder Pledge"				).startsElderPledge();
// upgrade("Sacrificial rolling pins"	).doublesElderPledge();

// Assorted cursor / clicking upgrades
upgrade("Reinforced index finger"		).scalesBaseClicking(2).scalesBuilding(Constants.CURSOR_INDEX, 2);
upgrade("Carpal tunnel prevention cream").scalesBaseClicking(2).scalesBuilding(Constants.CURSOR_INDEX, 2);
upgrade("Ambidextrous"					).scalesBaseClicking(2).scalesBuilding(Constants.CURSOR_INDEX, 2);
upgrade("Thousand fingers"				).givesBuildingPerBuildingBaseCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 0.1).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 0.1);
upgrade("Million fingers"				).givesBuildingPerBuildingBaseCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 0.5).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 0.5);
upgrade("Billion fingers"				).givesBuildingPerBuildingBaseCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 5).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 5);
upgrade("Trillion fingers"				).givesBuildingPerBuildingBaseCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 50).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 50);
upgrade("Quadrillion fingers"			).givesBuildingPerBuildingBaseCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 500).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 500);
upgrade("Quintillion fingers"			).givesBuildingPerBuildingBaseCpsBoost(Constants.CURSOR_INDEX, [Constants.CURSOR_INDEX], 5000).givesPerBuildingFlatCpcBoost([Constants.CURSOR_INDEX], 5000);
// upgrade("Sextillion fingers"			).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 200);
// upgrade("Septillion fingers"			).givesTotalBuildingBonus(Constants.CURSOR_INDEX, Constants.CURSOR_INDEX, 400);
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

// Milk and heavenly power increases
upgrade("Kitten helpers"		).unlocksMilk(0.1);
upgrade("Kitten workers"		).unlocksMilk(0.125);
upgrade("Kitten engineers"		).unlocksMilk(0.15);
upgrade("Kitten overseers"		).unlocksMilk(0.175);
// upgrade("Kitten managers"		).unlocksMilk(0.2);
// upgrade("Heavenly chip secret"	).boostsHeavenlyPower(0.05);
// upgrade("Heavenly cookie stand"	).boostsHeavenlyPower(0.20);
// upgrade("Heavenly bakery"		).boostsHeavenlyPower(0.25);
// upgrade("Heavenly confectionery").boostsHeavenlyPower(0.25);
// upgrade("Heavenly key"			).boostsHeavenlyPower(0.25);

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
// upgrade("A festive hat"				).unlocksSantaLevels().forSeason(Constants.CHRISTMAS);
// upgrade("Santa Level"				).increasesSantasLevel().forSeason(Constants.CHRISTMAS);
// upgrade("Weighted sleighs"			).slowsReindeer(2).forSeason(Constants.CHRISTMAS);
// upgrade("Reindeer baking grounds"	).scalesReindeerFrequency(2).forSeason(Constants.CHRISTMAS);
// upgrade("Ho ho ho-flavored frosting").scalesReindeer(2).forSeason(Constants.CHRISTMAS);
// upgrade("Season savings"			).scalesBuildingCost(0.99).forSeason(Constants.CHRISTMAS);
// upgrade("Toy workshop"				).scalesUpgradeCost(0.95).forSeason(Constants.CHRISTMAS);
// upgrade("Santa's bottomless bag"	).increasesRandomDropChance(10).forSeason(Constants.CHRISTMAS);
// upgrade("Santa's helpers"			).scalesTotalClicking(1.1).forSeason(Constants.CHRISTMAS);
// upgrade("Santa's legacy"			).boostsSantaPower(10).forSeason(Constants.CHRISTMAS);
// upgrade("Santa's milk and cookies"	).scalesMilk(1.05).forSeason(Constants.CHRISTMAS);
// upgrade("A lump of coal"			).scalesProduction(1).forSeason(Constants.CHRISTMAS);
// upgrade("An itchy sweater"			).scalesProduction(1).forSeason(Constants.CHRISTMAS);
// upgrade("Improved jolliness"		).scalesProduction(15).forSeason(Constants.CHRISTMAS);
// upgrade("Increased merriness"		).scalesProduction(15).forSeason(Constants.CHRISTMAS);
// upgrade("Christmas tree biscuits"	).scalesProduction(20).forSeason(Constants.CHRISTMAS);
// upgrade("Snowflake biscuits"		).scalesProduction(20).forSeason(Constants.CHRISTMAS);
// upgrade("Snowman biscuits"			).scalesProduction(20).forSeason(Constants.CHRISTMAS);
// upgrade("Holly biscuits"			).scalesProduction(20).forSeason(Constants.CHRISTMAS);
// upgrade("Candy cane biscuits"		).scalesProduction(20).forSeason(Constants.CHRISTMAS);
// upgrade("Bell biscuits"				).scalesProduction(20).forSeason(Constants.CHRISTMAS);
// upgrade("Present biscuits"			).scalesProduction(20).forSeason(Constants.CHRISTMAS);
// upgrade("Santa's dominion"			).scalesProduction(50).scalesBuildingCost(0.99).scalesUpgradeCost(0.98).forSeason(Constants.CHRISTMAS);
// upgrade("Naughty list"				).scalesBuilding(Constants.GRANDMA_INDEX, 2).forSeason(Constants.CHRISTMAS);

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
// upgrade("Faberge egg"				).scalesUpgradeCost(0.99).scalesBuildingCost(0.99).forSeason(Constants.EASTER);
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

console.log("Ultimate Cookie starting at " + new Date() + " supporting " + upgradesSupported + " upgrades and " + buildingsSupported + " buildings.");

// Create the upgradeInfo and Ultimate Cookie instances
var ultimateCookie = new UltimateCookie();
