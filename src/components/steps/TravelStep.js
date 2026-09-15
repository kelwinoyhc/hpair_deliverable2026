import React from 'react';
import { useFormikContext } from 'formik';
import { TextField, TextAreaField, RadioGroup, CheckboxGroup } from '../FormFields';
import { AID_TYPES } from '../../validation/schemas';

const YES_NO = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
];

/**
 * Travel and support.
 *
 * The visa questions nest: the invitation-letter question only appears for people
 * who need a visa, and the passport-name field only for those who want a letter.
 * Each level reads the same value its schema branches on, so what is displayed
 * and what is validated cannot disagree.
 */
export default function TravelStep() {
  const { values } = useFormikContext();

  const needsVisa = values.needsVisa === 'yes';
  const wantsLetter = needsVisa && values.needsVisaLetter === 'yes';
  const wantsAid = values.needsFinancialAid === 'yes';

  return (
    <div className="step-panel">
      <p className="step-lede">
        Two things that affect how we support delegates. Neither answer affects whether your
        application is accepted.
      </p>

      <RadioGroup
        name="needsVisa"
        label="Will you need a visa to attend?"
        hint="Based on the passport you will travel on, not where you live."
        required
        options={YES_NO}
      />

      {needsVisa && (
        <RadioGroup
          name="needsVisaLetter"
          label="Do you need an invitation letter to support your visa application?"
          hint="We can issue a signed letter confirming your acceptance and the conference dates."
          required
          options={YES_NO}
        />
      )}

      {wantsLetter && (
        <TextField
          name="passportName"
          label="Full name as printed in your passport"
          hint="Invitation letters are rejected if the name does not match the passport exactly, including middle names."
          required
          placeholder="ADA AUGUSTA LOVELACE"
        />
      )}

      <hr className="field-divider" />

      <RadioGroup
        name="needsFinancialAid"
        label="Would you like to apply for financial aid?"
        hint="Aid is assessed separately from your application and is confidential."
        required
        options={YES_NO}
      />

      {wantsAid && (
        <>
          <CheckboxGroup
            name="aidTypes"
            label="What would you like support with?"
            required
            options={AID_TYPES}
          />
          <TextAreaField
            name="financialAidNotes"
            label="Tell us about your circumstances"
            hint="A couple of sentences is plenty. This is read only by the aid committee."
            required
            rows={5}
            maxLength={800}
            placeholder="What makes attending difficult without support?"
          />
        </>
      )}
    </div>
  );
}
