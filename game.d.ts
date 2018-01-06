// Definitions for Cookie Clicker v2.0042
// Project: Cookie Clicker, http://orteil.dashnet.org/cookieclicker
// Partial definitions by Eamonn O'Brien, github.com/eamonno
//
// This is by no means meant to be a complete .d.ts file for Cookie Clicker. It includes
// just the bare minimum it takes to make the typescript compiler stop complaining.

declare namespace Game {
    class Object {
        level: number
        amount: number
        free: number
        name: string

        buy(number): void
        sacrifice(number): void
        getPrice(): number
        cps(Object): number
    }

    class Upgrade {
        name: string
        bought: number
        unlocked: number
    }

    class Shimmer {
        type: string
        pop(): void
    }

    class Wrinkler {
        sucked: number
        hp: number
    }

    class Buff {
    }

    let cookies: number
    let cookieClicks: number
    let heavenlyChips: number
    let prestige: number
    let santaLevel: number
    let dragonAura: number
    let dragonLevel: number
    let season: string
    let recalculateGains: number
    let cookiesPs: number
    let specialTab: string
    let startDate: number
    let seasonUses: number
    let pledges: number
    let AchievementsOwned: number

    let buffs: { [index: string]: Buff }
    let shimmers: Shimmer[]
    let wrinklers: Wrinkler[]
    let Upgrades: Upgrade[]
    let UpgradesInStore: Upgrade[]
    let UpgradesById: Upgrade[]
    let ObjectsById: Object[]

    function Has(string): number
    function ClickCookie(event?: any, amount?: number): void
    function mouseCps(): number
    function WriteSave(type: number): string
    function hasBuff(string): number | Buff
    function UpgradeSanta(): void
    function UpgradeDragon(): void
}
