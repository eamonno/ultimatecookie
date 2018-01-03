// Definitions for Cookie Clicker v2.0042
// Project: Cookie Clicker, http://orteil.dashnet.org/cookieclicker
// Partial definitions by Eamonn O'Brien, github.com/eamonno
//
// This is by no means meant to be a complete .d.ts file for Cookie Clicker. It includes
// just the bare minimum it takes to make the typescript compiler stop complaining.

declare namespace Game {
    interface Object {
        level: number
        amount: number
        free: number
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
    let season: string
    let recalculateGains: number
    let cookiesPs: number

    let shimmers: Shimmer[]
    let wrinklers: Wrinkler[]
    let UpgradesInStore: Upgrade[]
    let UpgradesById: Upgrade[]
    let ObjectsById: Game.Object[]

    function ClickCookie(event?: any, amount?: number): void
    function mouseCps(): number
    function WriteSave(type: number): string
    function hasBuff(string): number | Buff
}
