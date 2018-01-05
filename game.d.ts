// Definitions for Cookie Clicker v2.0042
// Project: Cookie Clicker, http://orteil.dashnet.org/cookieclicker
// Partial definitions by Eamonn O'Brien, github.com/eamonno
//
// This is by no means meant to be a complete .d.ts file for Cookie Clicker. It includes
// just the bare minimum it takes to make the typescript compiler stop complaining.

declare namespace Game {
    namespace Object {
        let level: number
        let amount: number
        let free: number

        function sacrifice(number): void
    }

    interface Upgrade {
        name: string
        bought: number
        unlocked: number
    }

    interface Shimmer {
        type: string
        pop(): void
    }

    interface Wrinkler {
        sucked: number
        hp: number
    }

    interface Buff {
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
