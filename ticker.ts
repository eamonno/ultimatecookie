//
// Ticker
//
// The ticker class can be used to check when a fixed interval of time has passed. The
// ticked function returns false except when the interval has expired. Note that this
// class guarantees a minimum interval between ticks, it will not tick multiple times
// in a situation where a multiple of the interval have passed. In that case it ticks
// once then won't tick again until the interval has hassed in entirity again.
//

class Ticker {
	last: number = 0

	constructor(public span: number) {
	}

	get ticked(): boolean {
		let now: number = Date.now();
		if (this.last + this.span <= now) {
			this.last = now;
			return true;
		}
		return false;
    }
    
    restart() {
        this.last = Date.now();
    }
}
