import type { Vehicle } from './fakeDb'
import { hashString } from './hash'

export type TowStatus = 'requested' | 'dispatched' | 'arriving' | 'complete'

export interface RepairShop {
  id: string
  name: string
  distanceMi: number
  rating: number
  earliestAppt: string
  addressLine: string
}

export interface RentalBooking {
  rentalId: string
  provider: string
  status: 'confirmed'
  pickupAt: string
}

export interface RideBooking {
  rideId: string
  provider: 'Uber' | 'Lyft'
  etaMin: number
  status: 'confirmed'
}

const withLatency = async <T,>(key: string, task: () => T | Promise<T>) => {
  const hash = hashString(key)
  const delay = 250 + (hash % 351)
  return new Promise<T>((resolve, reject) => {
    setTimeout(async () => {
      try {
        resolve(await task())
      } catch (error) {
        reject(error)
      }
    }, delay)
  })
}

let claimCounter = 1
let towCounter = 1
const towStatusOrder: TowStatus[] = ['requested', 'dispatched', 'arriving', 'complete']
const towProgress = new Map<string, number>()

const baseTimestamp = new Date('2025-01-01T12:00:00Z').getTime()

export async function submitClaim(payload: {
  vehicle: Vehicle
  drivable: boolean | null
  photos: { damage: boolean; vehicle: boolean; otherInsurance: boolean }
  estimate?: {
    estimatedRepairCost: number
    aboveDeductible: boolean
    customerPays: number
    insurerPays: number
  } | null
  tow?: { requested: boolean; status?: TowStatus }
}): Promise<{ claimId: string; submittedAt: string }> {
  const claimId = `CLM-${String(claimCounter).padStart(6, '0')}`
  const submittedAt = new Date(baseTimestamp + claimCounter * 60_000).toISOString()
  claimCounter += 1
  return withLatency(`claim-${claimId}-${payload.vehicle.make}-${payload.vehicle.model}`, () => ({
    claimId,
    submittedAt,
  }))
}

export async function requestTow(args: {
  seed: string
}): Promise<{ towId: string; status: TowStatus }> {
  const towId = `TOW-${String(towCounter).padStart(5, '0')}-${hashString(args.seed) % 1000}`
  towCounter += 1
  towProgress.set(towId, 0)
  return withLatency(`tow-${towId}`, () => ({ towId, status: 'requested' }))
}

export async function getTowStatus(towId: string): Promise<{ status: TowStatus }> {
  return withLatency(`tow-status-${towId}`, () => {
    const current = towProgress.get(towId) ?? 0
    const next = Math.min(current + 1, towStatusOrder.length - 1)
    towProgress.set(towId, next)
    return { status: towStatusOrder[next] }
  })
}

const shopCatalog: RepairShop[] = [
  {
    id: 'shop-aurora',
    name: 'Aurora Auto Body',
    distanceMi: 1.2,
    rating: 4.8,
    earliestAppt: 'Tomorrow 10:30am',
    addressLine: '214 Maple Ave',
  },
  {
    id: 'shop-harbor',
    name: 'Harbor Collision',
    distanceMi: 2.4,
    rating: 4.6,
    earliestAppt: 'Tomorrow 1:15pm',
    addressLine: '88 Harbor Blvd',
  },
  {
    id: 'shop-cedar',
    name: 'Cedar Creek Auto',
    distanceMi: 3.1,
    rating: 4.7,
    earliestAppt: 'Friday 9:00am',
    addressLine: '502 Cedar St',
  },
  {
    id: 'shop-summit',
    name: 'Summit Repair Center',
    distanceMi: 1.9,
    rating: 4.5,
    earliestAppt: 'Tomorrow 3:40pm',
    addressLine: '77 Summit Way',
  },
  {
    id: 'shop-lakeview',
    name: 'Lakeview Auto Works',
    distanceMi: 2.7,
    rating: 4.4,
    earliestAppt: 'Friday 11:45am',
    addressLine: '15 Lakeview Dr',
  },
]

export async function getRecommendedRepairShops(vehicle: Vehicle): Promise<RepairShop[]> {
  const seed = `${vehicle.make}-${vehicle.model}-${vehicle.year}`
  return withLatency(`shops-${seed}`, () => {
    const start = hashString(seed) % shopCatalog.length
    return [0, 1, 2].map((offset) => shopCatalog[(start + offset) % shopCatalog.length])
  })
}

export async function bookRental(args: {
  claimId: string
  startDate: string
  days: number
}): Promise<RentalBooking> {
  const providerOptions = ['Enterprise']
  const seed = `${args.claimId}-${args.startDate}-${args.days}`
  const provider = providerOptions[hashString(seed) % providerOptions.length]
  const rentalId = `RNT-${hashString(seed) % 100000}`
  const pickupAt = `${args.startDate} 10:00 AM`
  return withLatency(`rental-${seed}`, () => ({
    rentalId,
    provider,
    status: 'confirmed',
    pickupAt,
  }))
}

export async function bookRideHome(args: {
  claimId: string
  provider?: RideBooking['provider']
}): Promise<RideBooking> {
  const provider: RideBooking['provider'] =
    args.provider ?? (hashString(args.claimId) % 2 === 0 ? 'Uber' : 'Lyft')
  const etaMin = 4 + (hashString(args.claimId) % 6)
  const rideId = `RIDE-${hashString(args.claimId) % 100000}`
  return withLatency(`ride-${args.claimId}`, () => ({
    rideId,
    provider,
    etaMin,
    status: 'confirmed',
  }))
}
