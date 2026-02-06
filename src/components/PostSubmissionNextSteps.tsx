import { useEffect, useMemo, useState } from 'react'
import type { Policy, Vehicle } from '../server/fakeDb'
import type { RepairShop, RentalBooking, RideBooking, TowStatus } from '../server/nextStepsApi'
import { getRecommendedRepairShops } from '../server/nextStepsApi'
import enterpriseLogo from '../assets/enterprise_logo.png'
import uberLogo from '../assets/uber_logo.png'
import lyftLogo from '../assets/lyft_logo.png'

interface PostSubmissionNextStepsProps {
  claimId: string
  drivable: boolean
  vehicle: Vehicle
  policy: Policy | null
  tow: { towId?: string; status?: TowStatus } | null
  towDestination: 'home' | 'shop' | 'custom' | ''
  towCustomAddress: string
  towLoading: boolean
  selectedShopId: string | null
  rentalBooking: RentalBooking | null
  rideBooking: RideBooking | null
  onRequestTow: () => void
  onSelectShop: (shopId: string) => void
  onBookRental: (args: { startDate: string; days: number }) => void
  onBookRide: (provider: 'Uber' | 'Lyft') => void
}

const getTomorrowDate = () => {
  const now = new Date()
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
  return tomorrow.toISOString().slice(0, 10)
}

function Stars({ rating }: { rating: number }) {
  const full = Math.max(0, Math.min(5, Math.round(rating)))
  return (
    <span className="stars" aria-label={`Rating ${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, index) => (
        <span key={index} className={`stars__star ${index < full ? 'stars__star--on' : ''}`}>
          ★
        </span>
      ))}
    </span>
  )
}

export default function PostSubmissionNextSteps({
  claimId,
  drivable,
  vehicle,
  policy,
  tow,
  towDestination,
  towCustomAddress,
  towLoading,
  selectedShopId,
  rentalBooking,
  rideBooking,
  onRequestTow,
  onSelectShop,
  onBookRental,
  onBookRide,
}: PostSubmissionNextStepsProps) {
  const [shops, setShops] = useState<RepairShop[]>([])
  const [rentalStart, setRentalStart] = useState(getTomorrowDate())
  const [rentalDays, setRentalDays] = useState(3)
  const resolvedTowDestination = useMemo(() => {
    if (!towDestination) {
      return 'Not selected earlier.'
    }
    if (towDestination === 'shop') {
      return selectedShopId ? 'Selected repair shop' : 'Repair shop (to be selected)'
    }
    return towDestination === 'home' ? 'Home' : 'Custom address'
  }, [selectedShopId, towDestination])
  const [shopConfirmed, setShopConfirmed] = useState(false)
  const [rideProviderChoice, setRideProviderChoice] = useState<'Uber' | 'Lyft' | ''>('')

  useEffect(() => {
    let active = true
    getRecommendedRepairShops(vehicle).then((results) => {
      if (active) {
        setShops(results)
      }
    })
    return () => {
      active = false
    }
  }, [vehicle])

  const rentalCovered = policy?.rentalCoverage ?? false
  const rentalLabel = rentalCovered ? 'Covered by your policy' : 'May require approval'

  const towStatusText = tow?.status ? `Tow status: ${tow.status}` : 'Tow not requested yet.'

  const rideStatusText = rideBooking
    ? `${rideBooking.provider} driver arriving in ${rideBooking.etaMin} minutes`
    : 'Book a ride home if needed.'

  const shopCards = useMemo(() => shops.slice(0, 4), [shops])

  return (
    <div className="form-grid">
      <div className="support callout">
        <p className="support__headline">You did the right thing. We've got it from here.</p>
        <p className="muted">Your claim is submitted - we'll keep you updated.</p>
        <p className="muted">Claim ID: {claimId}</p>
      </div>

      <div className="field-group">
        <h3>Recommended repair shops</h3>
        <p className="muted">
          Choose a nearby shop and we'll send them your claim. If you request a tow, we'll share
          the destination with the tow driver en route.
        </p>
        <div className="shop-grid">
          {shopCards.map((shop) => {
            if (shopConfirmed && selectedShopId && selectedShopId !== shop.id) {
              return null
            }
            return (
              <div key={shop.id} className="shop-card">
                <div>
                  <span className="summary__label">Shop</span>
                  <span className="summary__value">{shop.name}</span>
                </div>
                <div className="shop-card__meta">
                  <span className="muted">{shop.distanceMi} mi</span>
                  <span className="shop-card__dot" aria-hidden="true">
                    •
                  </span>
                  <Stars rating={shop.rating} />
                  <span className="muted">{shop.rating.toFixed(1)}</span>
                </div>
                <p className="muted">{shop.earliestAppt}</p>
                <p className="muted">{shop.addressLine}</p>
                <button
                  type="button"
                  className={`button ${
                    selectedShopId === shop.id ? 'button--primary' : 'button--ghost'
                  }`}
                  onClick={() => onSelectShop(shop.id)}
                  disabled={shopConfirmed}
                >
                  {selectedShopId === shop.id ? 'Selected' : 'Select this shop'}
                </button>
                {selectedShopId === shop.id && !shopConfirmed && (
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => setShopConfirmed(true)}
                  >
                    Confirm this shop
                  </button>
                )}
                {selectedShopId === shop.id && shopConfirmed && (
                  <div className="callout callout--success">Shop confirmed</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="field-group">
        <div className="summary summary--compact">
          <div>
            <span className="summary__label">Book a rental</span>
            <span className="summary__value">Enterprise Rent-A-Car</span>
          </div>
          <img
            src={enterpriseLogo}
            alt="Enterprise Rent-A-Car logo"
            className="enterprise-logo"
          />
        </div>
        <div className="form-grid">
          <div className="summary summary--compact">
            <div>
              <span className="summary__label">Partner</span>
              <span className="summary__value">Enterprise Rent-A-Car</span>
            </div>
            <div>
              <span className="summary__label">Coverage</span>
              <span className="summary__value">{rentalLabel}</span>
            </div>
          </div>
          <p className="muted">
            Enterprise is our preferred partner. They will contact you to confirm pickup or drop-off
            details.
          </p>
        </div>
        {!rentalBooking && (
          <>
            <div className="form-grid form-grid--three">
              <label className="field">
                <span className="field__label">Start date</span>
                <input
                  className="field__input"
                  type="date"
                  value={rentalStart}
                  onChange={(event) => setRentalStart(event.target.value)}
                />
              </label>
              <label className="field">
                <span className="field__label">Days</span>
                <select
                  className="field__input"
                  value={String(rentalDays)}
                  onChange={(event) => setRentalDays(Number(event.target.value))}
                >
                  {[3, 5, 7].map((days) => (
                    <option key={days} value={days}>
                      {days}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <button
              type="button"
              className="button button--primary"
              onClick={() => onBookRental({ startDate: rentalStart, days: rentalDays })}
            >
              Book rental
            </button>
          </>
        )}
        {rentalBooking && (
          <div className="field-group">
            <p className="muted">
              {rentalBooking.provider} confirmed | Pickup {rentalBooking.pickupAt}
            </p>
            <p className="muted">Confirmation number: {rentalBooking.rentalId}</p>
            <p className="muted">
              Enterprise will reach out shortly to confirm pickup or drop-off details.
            </p>
          </div>
        )}
      </div>

      {!drivable && (
        <div className="field-group">
          <h3>Get a ride home (covered)</h3>
          <p className="muted">Covered for this incident.</p>
          <div className="form-grid">
            <div className="summary summary--compact">
              <div>
                <span className="summary__label">Choose a provider</span>
                <span className="summary__value">
                  {rideProviderChoice || 'Select Uber or Lyft'}
                </span>
              </div>
            </div>
            {!rideBooking && (
              <div className="form-grid form-grid--three">
                <button
                  type="button"
                  className={`button ${
                    rideProviderChoice === 'Uber' ? 'button--primary' : 'button--ghost'
                  }`}
                  onClick={() => setRideProviderChoice('Uber')}
                >
                  <span className="ride-choice">
                    Uber
                    <img src={uberLogo} alt="Uber logo" className="ride-logo" />
                  </span>
                </button>
                <button
                  type="button"
                  className={`button ${
                    rideProviderChoice === 'Lyft' ? 'button--primary' : 'button--ghost'
                  }`}
                  onClick={() => setRideProviderChoice('Lyft')}
                >
                  <span className="ride-choice">
                    Lyft
                    <img src={lyftLogo} alt="Lyft logo" className="ride-logo" />
                  </span>
                </button>
              </div>
            )}
          </div>
          {!rideBooking && (
            <button
              type="button"
              className="button button--primary"
              onClick={() => onBookRide(rideProviderChoice as 'Uber' | 'Lyft')}
              disabled={!rideProviderChoice}
            >
              Book ride
            </button>
          )}
          <p className="muted">
            {rideBooking
              ? `Ride confirmed. Please open the ${rideProviderChoice} app to follow your driver.`
              : rideStatusText}
          </p>
        </div>
      )}

      {(!drivable || tow?.towId) && (
        <div className="field-group">
          <h3>Tow status</h3>
          <p className="muted">{towStatusText}</p>
          <div className="form-grid">
            <div className="field">
              <span className="field__label">Tow destination</span>
              <p className="muted">
                Locked in: {resolvedTowDestination}
              </p>
              {towDestination === 'custom' && towCustomAddress && (
                <p className="muted">Address: {towCustomAddress}</p>
              )}
              <p className="muted">Destination changes are locked after submission.</p>
            </div>
          </div>
          <button
            type="button"
            className="button button--primary"
            onClick={onRequestTow}
            disabled={towLoading}
          >
            {tow?.towId ? (towLoading ? 'Updating...' : 'Update tow status') : 'Request a tow'}
          </button>
          {tow?.towId && towDestination && (
            <p className="muted">
              Destination: {towDestination === 'home' ? 'Home' : towCustomAddress || 'Custom address'}
            </p>
          )}
        </div>
      )}

      <div className="support callout">
        <p className="support__headline">You're all set. No further action is needed right now.</p>
        <p className="muted">We'll keep you updated as your claim progresses.</p>
      </div>
    </div>
  )
}
