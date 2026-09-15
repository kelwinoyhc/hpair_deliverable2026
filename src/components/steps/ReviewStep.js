import React from 'react';
import { useFormikContext } from 'formik';
import { CheckboxField } from '../FormFields';
import { buildSummary } from '../../utils/summary';

/**
 * A review step exists because this form asks for a CV and a home address: the
 * cost of a typo is a submission the applicant can't correct. Each section can be
 * jumped back to rather than forcing a walk backwards through every step.
 */
export default function ReviewStep({ onEditStep }) {
  const { values } = useFormikContext();
  const sections = buildSummary(values);

  return (
    <div className="step-panel">
      <p className="step-lede">Please check your answers before submitting.</p>

      {sections.map((section) => (
        <section className="summary-section" key={section.title} aria-labelledby={`summary-${section.step}`}>
          <div className="summary-head">
            <h3 className="summary-title" id={`summary-${section.step}`}>
              {section.title}
            </h3>
            <button
              type="button"
              className="link-button"
              onClick={() => onEditStep(section.step)}
            >
              Edit
              <span className="sr-only"> {section.title}</span>
            </button>
          </div>
          <dl className="summary-list">
            {section.items.map((item) => (
              <div className="summary-item" key={item.label}>
                <dt className="summary-label">{item.label}</dt>
                <dd className="summary-value">{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <CheckboxField
        name="consent"
        label="I confirm the information above is accurate and consent to HPAIR processing it for my application."
      />
    </div>
  );
}
