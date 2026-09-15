import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Formik, Form, useFormikContext } from 'formik';
import { FiAlertCircle, FiSave } from 'react-icons/fi';

import StepIndicator from './StepIndicator';
import PersonalInfoStep from './steps/PersonalInfoStep';
import ContactStep from './steps/ContactStep';
import ProfessionalStep from './steps/ProfessionalStep';
import TravelStep from './steps/TravelStep';
import ReviewStep from './steps/ReviewStep';
import Confirmation from './Confirmation';

import {
  INITIAL_VALUES,
  STEP_FIELDS,
  STEP_SCHEMAS,
  STEP_TITLES,
  fullSchema,
} from '../validation/schemas';
import { submitApplication, loadReceipt, clearReceipt } from '../services/submissionService';
import { useAutoSave, readDraft, clearDraft } from '../hooks/useAutoSave';

const LAST_STEP = STEP_TITLES.length - 1;

/**
 * Moves focus to a field by name. Text inputs and selects use the field name as
 * their DOM id; radios can't (each option needs its own id), so fall back to a
 * name attribute lookup.
 */
function focusField(name) {
  const byId = document.getElementById(name);
  const target = byId || document.querySelector(`[name="${name}"]`);
  if (!target || typeof target.focus !== 'function') return;
  target.focus();
  // Guarded: scrollIntoView is missing in jsdom and in some older browsers, and
  // scrolling is a nicety -- it must never be the reason focusing a field throws.
  if (typeof target.scrollIntoView === 'function') {
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
}

/** Which step a given field lives on -- used to jump to a failed field after submit. */
function stepForField(name) {
  const index = STEP_FIELDS.findIndex((fields) => fields.includes(name));
  return index === -1 ? 0 : index;
}

/**
 * The wizard's body is its own component rather than a render prop on <Formik>,
 * because it calls hooks (useAutoSave, useEffect). Hooks inside a render callback
 * belong to the parent's render and break the rules of hooks; this also keeps
 * MultiStepForm readable as "state and submission" versus "layout".
 */
function WizardBody({
  step,
  furthestReached,
  goToStep,
  submitError,
  draftNoticeVisible,
  onStartOver,
  restoredCvName,
  onRestoredCvNameCleared,
}) {
  const { values, errors, touched, isSubmitting, validateForm, setTouched } = useFormikContext();
  const savedAt = useAutoSave(values, step, { enabled: !isSubmitting });

  const headingRef = useRef(null);
  const isInitialRender = useRef(true);

  // After a step change the previous panel is gone; without this a keyboard user's
  // focus would sit on a Next button that now belongs to a different step.
  useEffect(() => {
    if (isInitialRender.current) {
      isInitialRender.current = false;
      return;
    }
    if (headingRef.current) headingRef.current.focus();
  }, [step]);

  const fieldsOnThisStep = STEP_FIELDS[step];

  const goNext = async () => {
    const stepErrors = await validateForm();
    const offending = fieldsOnThisStep.filter((name) => stepErrors[name]);

    if (offending.length) {
      // Mark only this step's fields as touched, so errors appear here and never
      // on a step the user hasn't reached yet.
      setTouched(
        {
          ...touched,
          ...fieldsOnThisStep.reduce((acc, name) => ({ ...acc, [name]: true }), {}),
        },
        false
      );
      focusField(offending[0]);
      return;
    }

    goToStep(Math.min(step + 1, LAST_STEP));
  };

  const hasVisibleErrorOnStep = fieldsOnThisStep.some((name) => errors[name] && touched[name]);

  return (
    <Form
      noValidate
      // Enter advances the wizard rather than submitting it from step 1. Only the
      // review step's Enter reaches the real submit handler.
      onKeyDown={(event) => {
        if (event.key !== 'Enter') return;
        if (step === LAST_STEP) return;
        const tag = event.target.tagName;
        if (tag === 'TEXTAREA' || tag === 'BUTTON') return;
        event.preventDefault();
        goNext();
      }}
    >
      <StepIndicator
        titles={STEP_TITLES}
        current={step}
        furthestReached={furthestReached}
        onJump={goToStep}
      />

      {draftNoticeVisible && (
        <div className="notice notice-info" role="status">
          <span>We restored your answers from last time.</span>
          <button type="button" className="link-button" onClick={onStartOver}>
            Start over
          </button>
        </div>
      )}

      <h2 className="step-heading" ref={headingRef} tabIndex={-1}>
        {STEP_TITLES[step]}
      </h2>

      {step === 0 && <PersonalInfoStep />}
      {step === 1 && <ContactStep />}
      {step === 2 && (
        <ProfessionalStep
          restoredCvName={restoredCvName}
          onRestoredCvNameCleared={onRestoredCvNameCleared}
        />
      )}
      {step === 3 && <TravelStep />}
      {step === LAST_STEP && <ReviewStep onEditStep={goToStep} />}

      {submitError && (
        <div className="submit-message error" role="alert">
          <FiAlertCircle aria-hidden="true" /> {submitError}
        </div>
      )}

      <div className="form-actions">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => goToStep(Math.max(step - 1, 0))}
          disabled={step === 0 || isSubmitting}
        >
          Back
        </button>

        <div className="form-actions-right">
          <span className="autosave-note" role="status" aria-live="polite">
            {savedAt && (
              <>
                <FiSave aria-hidden="true" /> Progress saved
              </>
            )}
          </span>

          {step === LAST_STEP ? (
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <span className="spinner" aria-hidden="true" /> Submitting…
                </>
              ) : (
                'Submit application'
              )}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={goNext}
              // Disabled only once the user has actually produced a visible error
              // on this step. Disabling a pristine form's Next button leaves people
              // stuck with nothing explaining why.
              disabled={hasVisibleErrorOnStep}
            >
              Next
            </button>
          )}
        </div>
      </div>
    </Form>
  );
}

export default function MultiStepForm() {
  // The draft is read once, synchronously, so Formik can be initialised with it
  // rather than mounting empty and then overwriting what the user already sees.
  const [draft] = useState(() => readDraft());
  const [step, setStep] = useState(draft?.step ?? 0);
  const [furthestReached, setFurthestReached] = useState(draft?.step ?? 0);
  const [restoredCvName, setRestoredCvName] = useState(draft?.cvName ?? null);
  const [draftNoticeVisible, setDraftNoticeVisible] = useState(Boolean(draft));
  const [submitError, setSubmitError] = useState(null);
  const [receipt, setReceipt] = useState(() => loadReceipt());

  const initialValues = draft ? { ...INITIAL_VALUES, ...draft.values, cv: null } : INITIAL_VALUES;

  const goToStep = useCallback((next) => {
    setStep(next);
    setFurthestReached((furthest) => Math.max(furthest, next));
  }, []);

  const startOver = useCallback(() => {
    clearDraft();
    setDraftNoticeVisible(false);
    setRestoredCvName(null);
    window.location.reload();
  }, []);

  const startAnother = useCallback(() => {
    clearDraft();
    clearReceipt();
    setReceipt(null);
    window.location.reload();
  }, []);

  const handleSubmit = async (values, helpers) => {
    setSubmitError(null);

    // Per-step validation has already run, but the wizard is the only thing
    // guaranteeing every step was visited. Validating the whole schema here means
    // a gap in that logic cannot produce a partial submission.
    try {
      await fullSchema.validate(values, { abortEarly: false });
    } catch (validationError) {
      const collected = {};
      (validationError.inner || []).forEach((issue) => {
        if (issue.path && !collected[issue.path]) collected[issue.path] = issue.message;
      });
      helpers.setErrors(collected);
      helpers.setTouched(
        Object.keys(collected).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
        false
      );
      const firstBadField = Object.keys(collected)[0];
      if (firstBadField) {
        goToStep(stepForField(firstBadField));
        window.requestAnimationFrame(() => focusField(firstBadField));
      }
      setSubmitError('Some answers still need attention. We’ve taken you back to them.');
      return;
    }

    const result = await submitApplication(values);

    if (result.ok) {
      clearDraft();
      setReceipt(result.receipt);
    } else {
      setSubmitError(result.error);
    }
  };

  if (receipt) {
    return <Confirmation receipt={receipt} onStartAnother={startAnother} />;
  }

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={STEP_SCHEMAS[step]}
      // Real-time validation. Formik defaults both to true; they are spelled out
      // because they are the requirement here, not an incidental default.
      validateOnChange
      validateOnBlur
      onSubmit={handleSubmit}
    >
      <WizardBody
        step={step}
        furthestReached={furthestReached}
        goToStep={goToStep}
        submitError={submitError}
        draftNoticeVisible={draftNoticeVisible}
        onStartOver={startOver}
        restoredCvName={restoredCvName}
        onRestoredCvNameCleared={() => setRestoredCvName(null)}
      />
    </Formik>
  );
}
