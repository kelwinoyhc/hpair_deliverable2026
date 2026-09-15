import React from 'react';
import { TextField, SelectField } from '../FormFields';
import { COUNTRIES } from '../../data/options';

export default function ContactStep() {
  return (
    <div className="step-panel">
      <p className="step-lede">How we reach you, and where you are based.</p>

      <div className="field-row">
        <TextField
          name="email"
          label="Email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
        />
        <TextField
          name="phone"
          label="Phone number"
          type="tel"
          required
          autoComplete="tel"
          placeholder="+14155551234"
          hint="Include your country code — +1 for the US, +44 for the UK."
        />
      </div>

      <TextField
        name="addressLine1"
        label="Street address"
        required
        autoComplete="address-line1"
        placeholder="24 Kirkland Street"
      />
      <TextField
        name="addressLine2"
        label="Apartment, suite, etc."
        autoComplete="address-line2"
        placeholder="Optional"
      />

      <div className="field-row">
        <TextField name="city" label="City" required autoComplete="address-level2" placeholder="Cambridge" />
        <TextField
          name="region"
          label="State / Province / Region"
          autoComplete="address-level1"
          placeholder="Optional in some countries"
        />
      </div>

      <div className="field-row">
        <TextField
          name="postalCode"
          label="Postal code"
          required
          autoComplete="postal-code"
          placeholder="02138"
        />
        <SelectField
          name="country"
          label="Country of residence"
          options={COUNTRIES}
          required
          placeholder="Select a country"
        />
      </div>
    </div>
  );
}
