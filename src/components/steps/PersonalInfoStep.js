import React from 'react';
import { useFormikContext } from 'formik';
import { TextField, SelectField } from '../FormFields';
import { COUNTRIES, GENDERS } from '../../data/options';

export default function PersonalInfoStep() {
  const { values } = useFormikContext();

  return (
    <div className="step-panel">
      <p className="step-lede">Tell us who you are. This should match your ID.</p>

      <div className="field-row">
        <TextField name="firstName" label="First name" required autoComplete="given-name" placeholder="Ada" />
        <TextField name="lastName" label="Last name" required autoComplete="family-name" placeholder="Lovelace" />
      </div>

      <TextField name="dateOfBirth" label="Date of birth" type="date" required autoComplete="bday" />

      <SelectField name="gender" label="Gender" options={GENDERS} required placeholder="Select an option" />

      {/* Conditional follow-up: only asked of people who chose to self-describe. */}
      {values.gender === 'self-describe' && (
        <TextField
          name="genderSelfDescribed"
          label="How do you identify?"
          required
          placeholder="In your own words"
        />
      )}

      <SelectField
        name="nationality"
        label="Nationality"
        hint="Your country of citizenship. If you hold more than one, choose the passport you will travel on."
        options={COUNTRIES}
        required
        placeholder="Select a country"
      />
    </div>
  );
}
