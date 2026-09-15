import React from 'react';
import { useFormikContext } from 'formik';
import { TextField, SelectField, RadioGroup } from '../FormFields';
import CvUpload from '../CvUpload';
import { LANGUAGES } from '../../data/options';

export default function ProfessionalStep({ restoredCvName, onRestoredCvNameCleared }) {
  const { values } = useFormikContext();

  return (
    <div className="step-panel">
      <p className="step-lede">Your background, and how you would like us to correspond.</p>

      <TextField
        name="currentRole"
        label="Current role or field of study"
        autoComplete="organization-title"
        placeholder="Optional — e.g. Economics undergraduate"
      />

      <CvUpload
        restoredName={restoredCvName}
        onRestoredNameCleared={onRestoredCvNameCleared}
      />

      <RadioGroup
        name="hasLinkedIn"
        label="Do you have a LinkedIn profile?"
        required
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]}
      />

      {/*
        The conditional question the brief calls for. Rendering is driven by the
        same value the schema branches on, so the field shown and the field
        validated can never disagree.
      */}
      {values.hasLinkedIn === 'yes' && (
        <TextField
          name="linkedinUrl"
          label="LinkedIn URL"
          required
          placeholder="linkedin.com/in/your-name"
          hint="The profile URL, not a search result link."
        />
      )}

      <SelectField
        name="preferredLanguage"
        label="Preferred language"
        hint="The language we will use for correspondence and materials."
        options={LANGUAGES}
        required
        placeholder="Select a language"
      />
    </div>
  );
}
