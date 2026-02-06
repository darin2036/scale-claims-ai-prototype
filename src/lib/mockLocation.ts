export interface MockLocationLookup {
  streetAddress: string
  city: string
  state: string
  nearestCrossStreet: string
  formattedAddress: string
  mapsQuery: string
}

const fnv1a32 = (input: string) => {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

const pick = <T,>(items: T[], seed: number) => items[seed % items.length]!

const CITIES: Array<{ city: string; state: string }> = [
  { city: 'Austin', state: 'TX' },
  { city: 'Denver', state: 'CO' },
  { city: 'Seattle', state: 'WA' },
  { city: 'Phoenix', state: 'AZ' },
  { city: 'Charlotte', state: 'NC' },
  { city: 'Nashville', state: 'TN' },
  { city: 'Columbus', state: 'OH' },
  { city: 'San Diego', state: 'CA' },
  { city: 'Tampa', state: 'FL' },
  { city: 'Minneapolis', state: 'MN' },
]

const STREET_NAMES = [
  'Maple',
  'Cedar',
  'Oak',
  'Pine',
  'Willow',
  'Spruce',
  'Sunset',
  'Riverside',
  'Meadow',
  'Hillcrest',
  'Lakeview',
  'Park',
  'Highland',
  'Washington',
  'Jefferson',
  'Madison',
  'Franklin',
  'Elm',
]

const STREET_SUFFIXES = ['St', 'Ave', 'Blvd', 'Rd', 'Ln', 'Dr', 'Way', 'Ct']

export function mockLookupLocation(coords: { lat: number; lng: number }): MockLocationLookup {
  const seed = `${coords.lat.toFixed(5)},${coords.lng.toFixed(5)}`
  const hash = fnv1a32(seed)

  const cityState = pick(CITIES, hash)
  const streetName = pick(STREET_NAMES, hash >>> 3)
  const streetSuffix = pick(STREET_SUFFIXES, hash >>> 7)
  const crossStreetName = pick(STREET_NAMES, hash >>> 11)
  const crossStreetSuffix = pick(STREET_SUFFIXES, hash >>> 15)

  const houseNumber = 100 + (hash % 8900)
  const streetAddress = `${houseNumber} ${streetName} ${streetSuffix}`
  const nearestCrossStreet =
    crossStreetName === streetName && crossStreetSuffix === streetSuffix
      ? `${pick(STREET_NAMES, hash >>> 19)} ${pick(STREET_SUFFIXES, hash >>> 21)}`
      : `${crossStreetName} ${crossStreetSuffix}`

  const formattedAddress = `${streetAddress}, ${cityState.city}, ${cityState.state}`

  return {
    streetAddress,
    city: cityState.city,
    state: cityState.state,
    nearestCrossStreet,
    formattedAddress,
    mapsQuery: formattedAddress,
  }
}

