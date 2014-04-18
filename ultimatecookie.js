function UltimateCookie() {

	this.nextBuilding = this.determineNextBuilding();

	this.autoClicker = setInterval(Game.ClickCookie, 1);
	this.autoBuyer = setInterval(AutoBuy, 500);
}

UltimateCookie.prototype.determineNextBuilding = function() {
	var i;
	var next = Game.ObjectsById[0];

	for (i = 1; i < Game.ObjectsById.length; ++i) {
		if (Game.ObjectsById[i].getPrice() / Game.ObjectsById[i].storedCps <= next.getPrice() / next.storedCps) {
			next = Game.ObjectsById[i];
		}
	}
	console.log("Next building: " + next.displayName + " number " + (next.amount + 1));

	return next;
}

UltimateCookie.prototype.autoBuy = function() {

	if (Game.cookies >= this.nextBuilding.getPrice()) {
		this.nextBuilding.buy(1);
		this.nextBuilding = this.determineNextBuilding();
	}

	if (Game.UpgradesInStore.length > 0) {
		var nextUpgrade = Game.UpgradesInStore[0];

		for (i = 1; i < Game.UpgradesInStore.length; ++i) {
			if (Game.UpgradesInStore[i].getPrice() <= nextUpgrade.getPrice()) {
				nextUpgrade = Game.UpgradesInStore[i];
			}
		}
		if (nextUpgrade != undefined) {
			nextUpgrade.buy(0);
		}
	}
}

UltimateCookie.prototype.effectiveCps = function() {
	// Assume 250 clicks per second
	return Game.cookiesPs + 250 * Game.mouseCps;
}

var ultimateCookie = new UltimateCookie();

function AutoBuy() { ultimateCookie.autoBuy(); }
