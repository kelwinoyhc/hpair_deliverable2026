import React, { useEffect, useRef } from 'react';
import { useFormikContext } from 'formik';
import { TextField, SelectField } from '../FormFields';
import { COUNTRIES } from '../../data/options';
import { nextPhoneValue } from '../../utils/phonePrefill';

/**
 * Supplies the phone field's dialling code from what the form already knows.
 *
 * Validating phone numbers as E.164 means the user must type a country code;
 * since nationality and country of residence are already answered, the form can
 * fill that part in. The decision of *whether* to write anything lives in
 * `nextPhoneValue`, which is pure and tested -- this hook only wires it up.
 *
 * Two deliberate details:
 *  - `phone` is read through a ref and is NOT a dependency. If it were, every
 *    keystroke would re-run the effect and fight the user for control of the
 *    field. The effect should fire when the *country* changes, and only then.
 *  - The write passes `shouldValidate: false`. A bare "+81" is not valid E.164,
 *    so validating immediately would show an error about a value the user has not
 *    had a chance to finish typing.
 */
function usePhoneDialPrefill() {
  const { values, setFieldValue } = useFormikContext();
  const { country, nationality } = values;

  const phoneRef = useRef(values.phone);
  phoneRef.current = values.phone;

  useEffect(() => {
    const next = nextPhoneValue({ current: phoneRef.current, country, nationality });
    if (next !== null) setFieldValue('phone', next, false);
  }, [country, nationality, setFieldValue]);
}

export default function ContactStep() {
  usePhoneDialPrefill();

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
          hint="The country code is filled in from your country — add the rest."
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
